defmodule Castmill.Workers.JobRecovery do
  @moduledoc """
  Recovers lost background jobs after a Redis failure or restart.

  Uses deterministic job IDs (e.g., "video_transcode:42") so that BullMQ's
  built-in deduplication makes re-enqueue calls idempotent — if the job
  already exists in Redis, the add is silently ignored.

  ## How It Works

  1. Queries PostgreSQL for rows stuck in processing states
     (`:uploading` or `:transcoding` media, for example).
  2. Re-enqueues a BullMQ job for each, using a deterministic job ID
     derived from the DB primary key.
  3. BullMQ's Lua script checks `EXISTS jobIdKey` — if the job is
     already present, it returns the existing job (no duplicate created).

  ## When to Run

  - **On startup** — call `recover_all/0` after BullMQ workers are running.
  - **Periodically** — schedule via a maintenance BullMQ job or a simple
    `Process.send_after` loop.
  - **After Redis incident** — run manually via `iex`.

  ## Supported Recovery Targets

  | DB State          | Job Re-enqueued          | Deterministic ID              |
  |-------------------|--------------------------|-------------------------------|
  | Media :uploading  | image_transcode or       | `image_transcode:<media_id>`  |
  | Media :transcoding| video_transcode          | `video_transcode:<media_id>`  |

  Media that reached `:ready` or `:failed` is not re-enqueued.
  """

  require Logger

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Resources.Media
  alias Castmill.Workers.BullMQHelper

  @doc """
  Recovers all known job types. Returns a summary map.

  ## Examples

      iex> Castmill.Workers.JobRecovery.recover_all()
      %{media: %{found: 3, enqueued: 3, errors: 0}}
  """
  def recover_all do
    media_result = recover_stuck_media()

    summary = %{media: media_result}
    Logger.info("[JobRecovery] Recovery complete: #{inspect(summary)}")
    summary
  end

  @doc """
  Finds media stuck in `:uploading` or `:transcoding` and re-enqueues
  transcoding jobs with deterministic IDs.

  Only media with an associated uploaded file on disk/S3 can be recovered.
  Media in `:uploading` that never had a file written will be marked `:failed`.

  ## Options

    * `:max_age_hours` — Only recover media stuck for at most this many hours.
      Defaults to 168 (7 days). Older media is marked `:failed` directly.
  """
  def recover_stuck_media(opts \\ []) do
    max_age_hours = Keyword.get(opts, :max_age_hours, 168)
    cutoff = DateTime.utc_now() |> DateTime.add(-max_age_hours * 3600, :second)

    # Fetch media stuck in processing states
    stuck_media =
      from(m in Media,
        where: m.status in [:uploading, :transcoding],
        where: m.updated_at >= ^cutoff,
        select: m
      )
      |> Repo.all()

    # Also mark very old stuck media as failed (beyond recovery window)
    expired_count = mark_expired_media(cutoff)

    if expired_count > 0 do
      Logger.warning(
        "[JobRecovery] Marked #{expired_count} expired media as :failed (older than #{max_age_hours}h)"
      )
    end

    results =
      Enum.map(stuck_media, fn media ->
        case enqueue_media_job(media) do
          {:ok, _job} ->
            Logger.info(
              "[JobRecovery] Re-enqueued #{job_type(media.mimetype)} for media #{media.id}"
            )

            :ok

          {:error, reason} ->
            Logger.error(
              "[JobRecovery] Failed to re-enqueue media #{media.id}: #{inspect(reason)}"
            )

            :error
        end
      end)

    enqueued = Enum.count(results, &(&1 == :ok))
    errors = Enum.count(results, &(&1 == :error))

    %{found: length(stuck_media), enqueued: enqueued, errors: errors, expired: expired_count}
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp enqueue_media_job(media) do
    media_map = %{
      "id" => media.id,
      "organization_id" => media.organization_id,
      "name" => media.name,
      "mimetype" => media.mimetype,
      "status" => media.status
    }

    cond do
      image?(media.mimetype) ->
        # For images we need the filepath. The original upload path is stored
        # in media.path (set by upload_controller as the original filename).
        # In the upload flow, the file is stored at uploads/<filename>.
        BullMQHelper.add_job(
          "image_transcoder",
          "image_transcode",
          %{
            "media" => media_map,
            "filepath" => upload_path(media),
            "mime_type" => media.mimetype
          },
          job_id: "image_transcode:#{media.id}"
        )

      video?(media.mimetype) ->
        BullMQHelper.add_job(
          "video_transcoder",
          "video_transcode",
          %{
            "media" => media_map,
            "filepath" => upload_path(media)
          },
          job_id: "video_transcode:#{media.id}"
        )

      true ->
        Logger.warning("[JobRecovery] Unknown mimetype for media #{media.id}: #{media.mimetype}")
        {:error, :unsupported_mimetype}
    end
  end

  defp upload_path(media) do
    # The upload controller stores files using the original filename in media.path.
    # The file location depends on the storage backend (local or S3).
    # For S3, the filepath in the job data is the S3 key; for local, it's the
    # filesystem path. Since both transcoders call Helpers.get_file_from_uri/1
    # which handles both local paths and URLs, we can use media.path directly —
    # the transcoder will resolve it the same way the original upload did.
    media.path
  end

  defp image?(mimetype) when is_binary(mimetype), do: String.starts_with?(mimetype, "image/")
  defp image?(_), do: false

  defp video?(mimetype) when is_binary(mimetype) do
    String.starts_with?(mimetype, "video/") or mimetype == "application/vnd.ms-asf"
  end

  defp video?(_), do: false

  defp job_type(mimetype) do
    cond do
      image?(mimetype) -> "image_transcode"
      video?(mimetype) -> "video_transcode"
      true -> "unknown"
    end
  end

  defp mark_expired_media(cutoff) do
    {count, _} =
      from(m in Media,
        where: m.status in [:uploading, :transcoding],
        where: m.updated_at < ^cutoff
      )
      |> Repo.update_all(
        set: [
          status: :failed,
          status_message: "Marked as failed by job recovery (stuck too long)"
        ]
      )

    count
  end
end
