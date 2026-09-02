defmodule Castmill.Workers.TranscoderEventsHandler do
  @moduledoc """
  `BullMQ.QueueEvents` handler that turns transcoder job lifecycle events into
  local `resource:media:<id>` PubSub broadcasts.

  This is the mechanism that lets a web-capable node deliver live transcode
  status to connected dashboards when the actual transcoding happens on a
  separate worker fleet that shares only PostgreSQL (no BEAM clustering).

  BullMQ already streams `:completed` / `:failed` events through the PostgreSQL
  backend, so this handler simply re-broadcasts them on the local node's
  `Castmill.PubSub`, which then reaches dashboards via the normal in-tier
  `CastmillWeb.ResourceUpdatesChannel` subscription.

  The listener is started for queues that a web-capable node does not process
  locally (see `Castmill.Application`). A co-located worker broadcasts directly,
  so its queue is excluded to prevent duplicate broadcasts.

  ## Payloads

  On `:completed`, the notification payload is taken from the job's return value
  (`returnvalue`), which the transcoders populate with everything the dashboard
  needs (`media_id`, `status`, `status_message`, `files`, `size`) — avoiding an
  extra database round-trip.

  On `:failed`, there is no return value, so the media id is derived from the
  deterministic job id (`video_transcode:<media_id>` / `image_transcode:<media_id>`)
  and the failure reason is carried in `failedReason`.
  """

  use BullMQ.QueueEvents.Handler

  require Logger

  @impl true
  def handle_event(:completed, data, state) do
    with {:ok, payload} <- decode_returnvalue(Map.get(data, "returnvalue")),
         media_id when is_binary(media_id) <- Map.get(payload, "media_id") do
      broadcast(media_id, %{
        status: Map.get(payload, "status"),
        status_message: Map.get(payload, "status_message"),
        files: Map.get(payload, "files"),
        size: Map.get(payload, "size")
      })
    else
      _ -> :ok
    end

    {:ok, state}
  end

  @impl true
  def handle_event(:failed, data, state) do
    case media_id_from_job_id(Map.get(data, "jobId")) do
      nil ->
        :ok

      media_id ->
        broadcast(media_id, %{
          status: :failed,
          status_message: Map.get(data, "failedReason"),
          files: nil,
          size: nil
        })
    end

    {:ok, state}
  end

  @impl true
  def handle_event(_event, _data, state), do: {:ok, state}

  defp broadcast(media_id, payload) do
    Logger.debug("Re-broadcasting transcoder event for media #{media_id} via QueueEvents")

    Phoenix.PubSub.broadcast(Castmill.PubSub, "resource:media:#{media_id}", payload)
  end

  # `returnvalue` is a JSON string (as produced by the BullMQ backend) but be
  # defensive and also accept an already-decoded map.
  defp decode_returnvalue(value) when is_map(value), do: {:ok, value}

  defp decode_returnvalue(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, map} when is_map(map) -> {:ok, map}
      _ -> :error
    end
  end

  defp decode_returnvalue(_), do: :error

  # Job ids for transcode jobs are deterministic and shaped as
  # `"<job_name>:<media_id>"` (e.g. `"video_transcode:<uuid>"`). Media ids are
  # UUIDs and never contain a colon, so splitting on the first colon is safe.
  defp media_id_from_job_id(job_id) when is_binary(job_id) do
    case String.split(job_id, ":", parts: 2) do
      [_prefix, media_id] when media_id != "" -> media_id
      _ -> nil
    end
  end

  defp media_id_from_job_id(_), do: nil
end
