defmodule Castmill.Feeds.Media do
  @moduledoc """
  Feed media: copies of the images and videos that feed entries reference, so
  that expiring URLs (e.g. social network CDNs) keep working on screens. See
  "Media in entries" in agents/systems/DATA-FEEDS.md.

  After every write, `sync/1` (called with the feed row locked) reconciles the
  feed's media records with the URLs found at its `copy` media fields:

    * new URLs get a `pending` record and a download job,
    * records no longer referenced are marked `deleting` and purged after the
      transaction (and by the daily cleanup job),
    * the stored URL of every `ready` record replaces its original in the data,
      keeping the original in `<field>_original`.

  Records are unique per feed and original URL. Downloads with the same content
  share one stored file.
  """

  import Ecto.Query, warn: false

  require Logger

  alias Castmill.Feeds
  alias Castmill.Feeds.{Feed, FeedEntry, FeedMedia, MediaPaths, MediaStorage, MediaType}
  alias Castmill.{Quotas, Repo, SafeHttp}
  alias Castmill.Workers.FeedMediaDownloader

  @max_per_holder 20
  @default_max_file_bytes 20 * 1024 * 1024
  @accept "image/avif;q=0.1, image/webp, image/*, video/*;q=0.9, */*;q=0.5"
  @transient ~w(timeout network_error server_error rate_limited connection_refused storage_failed)a
  @stale_pending_seconds 3_600

  @doc "The paths of media fields whose files are copied (mode `copy`, the default)."
  def copy_paths(%Feed{media_fields: fields}) do
    for field <- fields || [],
        (field["mode"] || "copy") == "copy",
        path = field["path"],
        is_binary(path),
        do: path
  end

  # ---------------------------------------------------------------------------
  # Sync (inside write transactions, with the feed row locked)
  # ---------------------------------------------------------------------------

  @doc """
  Reconciles media records with the feed's data and swaps in stored URLs.
  Returns the (possibly updated) feed and the actions to run after commit with
  `after_commit/1`.
  """
  def sync(%Feed{} = feed) do
    paths = copy_paths(feed)
    holders = holders(feed)

    wanted_urls =
      holders
      |> Enum.flat_map(fn {_holder, data} ->
        data |> MediaPaths.collect(paths) |> Enum.take(@max_per_holder)
      end)
      |> Enum.uniq()

    wanted = MapSet.new(wanted_urls)
    records = Repo.all(from(m in FeedMedia, where: m.feed_id == ^feed.id))
    known = MapSet.new(records, & &1.original_url)

    created =
      wanted_urls
      |> Enum.reject(&MapSet.member?(known, &1))
      |> Enum.map(&insert_pending(feed, &1))

    {records, revived} = revive(records, wanted)

    retired =
      for m <- records,
          m.status != "deleting",
          not MapSet.member?(wanted, m.original_url),
          do: m.id

    if retired != [] do
      Repo.update_all(from(m in FeedMedia, where: m.id in ^retired),
        set: [status: "deleting", updated_at: DateTime.utc_now()]
      )
    end

    ready =
      for m <- records, m.status == "ready", MapSet.member?(wanted, m.original_url), into: %{} do
        {m.original_url, m.url}
      end

    feed = write_holders(feed, holders, &MediaPaths.apply(&1, paths, ready))

    {feed,
     %{enqueue: Enum.map(created ++ revived, & &1.id), purge: if(retired != [], do: feed.id)}}
  end

  @doc "Restores the original URLs at `paths` (used when media fields change)."
  def restore(%Feed{} = feed, paths) do
    write_holders(feed, holders(feed), &MediaPaths.apply(&1, paths, %{}))
  end

  @doc "Runs the downloads and purges that `sync/1` scheduled. Call it after commit."
  def after_commit(%{enqueue: ids, purge: purge}) do
    Enum.each(ids, &FeedMediaDownloader.enqueue/1)
    if purge, do: purge(purge)
    :ok
  end

  def after_commit(_actions), do: :ok

  defp holders(%Feed{mode: "document", document: document}) when is_map(document),
    do: [{:document, document}]

  defp holders(%Feed{mode: "list", id: id}) do
    from(e in FeedEntry, where: e.feed_id == ^id, select: {e.id, e.data})
    |> Repo.all()
    |> Enum.map(fn {entry_id, data} -> {{:entry, entry_id}, data} end)
  end

  defp holders(_feed), do: []

  defp write_holders(feed, holders, fun) do
    Enum.reduce(holders, feed, fn {holder, data}, feed ->
      case fun.(data) do
        ^data -> feed
        new_data -> write_holder(feed, holder, new_data)
      end
    end)
  end

  defp write_holder(feed, :document, document),
    do: feed |> Ecto.Changeset.change(document: document) |> Repo.update!()

  defp write_holder(feed, {:entry, id}, data) do
    Repo.update_all(from(e in FeedEntry, where: e.id == ^id),
      set: [data: data, updated_at: DateTime.utc_now()]
    )

    feed
  end

  defp insert_pending(feed, url) do
    Repo.insert!(%FeedMedia{
      feed_id: feed.id,
      organization_id: feed.organization_id,
      original_url: url,
      url_hash: FeedMedia.hash_url(url),
      status: "pending"
    })
  end

  # Records referenced again before their purge get their previous state back.
  defp revive(records, wanted) do
    Enum.map_reduce(records, [], fn
      %FeedMedia{status: "deleting"} = m, revived ->
        if MapSet.member?(wanted, m.original_url) do
          status =
            cond do
              m.storage_key -> "ready"
              m.failure_reason -> "failed"
              true -> "pending"
            end

          m = m |> Ecto.Changeset.change(status: status) |> Repo.update!()
          {m, if(status == "pending", do: [m | revived], else: revived)}
        else
          {m, revived}
        end

      m, revived ->
        {m, revived}
    end)
  end

  # ---------------------------------------------------------------------------
  # Downloads
  # ---------------------------------------------------------------------------

  @doc """
  Downloads and stores a pending media, then swaps it into the feed's data.

  Returns `:ok` when done (including permanent failures, which mark the media
  `failed`) or `{:retry, reason}` for transient errors unless `final: true`.
  """
  def download(media_id, opts \\ []) do
    final? = Keyword.get(opts, :final, true)

    case Repo.get(FeedMedia, media_id) do
      %FeedMedia{status: "pending", feed_id: feed_id} = media when is_binary(feed_id) ->
        case fetch_and_store(media) do
          {:ok, stored} ->
            finalize(media, stored, final?)

          {:error, reason} ->
            if reason in @transient and not final?,
              do: {:retry, reason},
              else: fail(media, reason)
        end

      _ ->
        :ok
    end
  end

  defp fetch_and_store(media) do
    with {:ok, %{body: body, content_type: content_type}} <- fetch(media),
         {:ok, type} <- MediaType.detect(body, content_type) do
      hash = :crypto.hash(:sha256, body) |> Base.encode16(case: :lower)

      case shared_copy(media, hash) do
        %FeedMedia{} = other ->
          {:ok,
           other
           |> Map.take([:storage_key, :url, :size, :content_type, :width, :height, :duration])
           |> Map.merge(%{content_hash: hash, shared: true})}

        nil ->
          store(media, type, body, hash)
      end
    end
  end

  defp fetch(media) do
    case SafeHttp.get(media.original_url,
           max_body_bytes: max_file_bytes(media.organization_id),
           accept: @accept
         ) do
      {:error, :feed_too_large} -> {:error, :too_large}
      other -> other
    end
  end

  defp shared_copy(media, hash) do
    Repo.one(
      from(m in FeedMedia,
        where:
          m.feed_id == ^media.feed_id and m.content_hash == ^hash and m.status == "ready" and
            m.id != ^media.id,
        limit: 1
      )
    )
  end

  defp store(media, type, body, hash) do
    size = byte_size(body)
    key = "#{media.organization_id}/feeds/#{media.feed_id}/#{media.id}.#{type.extension}"

    with :ok <- check_quota(media.organization_id, size),
         {:ok, url} <- put(key, body, type.content_type) do
      {:ok,
       Map.merge(metadata(type, body), %{
         storage_key: key,
         url: url,
         size: size,
         content_type: type.content_type,
         content_hash: hash,
         shared: false
       })}
    end
  end

  defp put(key, body, content_type) do
    case MediaStorage.put(key, body, content_type) do
      {:ok, url} ->
        {:ok, url}

      {:error, reason} ->
        Logger.error("[FeedMedia] Storing #{key} failed: #{inspect(reason)}")
        {:error, :storage_failed}
    end
  end

  defp check_quota(organization_id, size) do
    used = Quotas.get_quota_used_for_organization(organization_id, :storage)
    limit = Quotas.get_quota_for_organization_bytes(organization_id, :storage)
    if used + size > limit, do: {:error, :quota_exceeded}, else: :ok
  end

  @doc "The largest file copied for an organization: the configured limit or its upload limit."
  def max_file_bytes(organization_id) do
    configured =
      Application.get_env(:castmill, __MODULE__, [])
      |> Keyword.get(:max_file_bytes, @default_max_file_bytes)

    case Quotas.get_quota_for_organization_bytes(organization_id, :max_upload_size) do
      upload when is_integer(upload) and upload > 0 -> min(configured, upload)
      _ -> configured
    end
  end

  defp finalize(media, stored, final?) do
    Repo.transaction(fn ->
      feed =
        Repo.one(from(f in Feed, where: f.id == ^media.feed_id, lock: "FOR UPDATE")) ||
          Repo.rollback(:gone)

      current = Repo.get(FeedMedia, media.id)

      cond do
        is_nil(current) or current.status != "pending" ->
          Repo.rollback(:gone)

        stored.shared and not live_key?(stored.storage_key) ->
          Repo.rollback(:shared_copy_removed)

        true ->
          current
          |> Ecto.Changeset.change(
            stored
            |> Map.drop([:shared])
            |> Map.merge(%{status: "ready", failure_reason: nil})
          )
          |> Repo.update!()

          {feed, actions} = sync(feed)
          {Feeds.touch(feed), actions}
      end
    end)
    |> case do
      {:ok, {feed, actions}} ->
        Feeds.broadcast(feed)
        after_commit(actions)
        :ok

      {:error, :gone} ->
        unless stored.shared, do: delete_file(stored.storage_key)
        :ok

      {:error, :shared_copy_removed} when not final? ->
        {:retry, :shared_copy_removed}

      {:error, reason} ->
        fail(media, reason)
    end
  end

  defp live_key?(key) do
    Repo.exists?(from(m in FeedMedia, where: m.storage_key == ^key and m.status == "ready"))
  end

  defp fail(media, reason) do
    Logger.warning(
      "[FeedMedia] Copying media #{media.id} from #{FeedMedia.original_host(media)} failed: #{reason}"
    )

    Repo.update_all(from(m in FeedMedia, where: m.id == ^media.id and m.status == "pending"),
      set: [status: "failed", failure_reason: to_string(reason), updated_at: DateTime.utc_now()]
    )

    :ok
  end

  defp metadata(%{kind: :image}, body) do
    case Image.from_binary(body) do
      {:ok, image} -> %{width: Image.width(image), height: Image.height(image)}
      _ -> %{}
    end
  rescue
    _ -> %{}
  end

  defp metadata(%{kind: :video, extension: extension}, body) do
    path =
      Path.join(
        System.tmp_dir!(),
        "feed-media-#{System.unique_integer([:positive])}.#{extension}"
      )

    try do
      File.write!(path, body)
      probe_video(path)
    rescue
      _ -> %{}
    after
      File.rm(path)
    end
  end

  defp probe_video(path) do
    system_cmd = Application.get_env(:castmill, :system_cmd, Castmill.Workers.SystemCmd)

    args =
      ~w(-v error -select_streams v:0 -show_entries stream=width,height:format=duration -of json) ++
        [path]

    with {output, 0} <- system_cmd.cmd("ffprobe", args, stderr_to_stdout: false),
         {:ok, %{} = info} <- Jason.decode(output) do
      stream = info |> Map.get("streams", []) |> List.first() || %{}

      duration =
        case Float.parse(to_string(get_in(info, ["format", "duration"]))) do
          {value, _} -> value
          :error -> nil
        end

      %{width: stream["width"], height: stream["height"], duration: duration}
    else
      _ -> %{}
    end
  end

  # ---------------------------------------------------------------------------
  # Cleanup
  # ---------------------------------------------------------------------------

  @doc "Deletes a feed's `deleting` media records and the files no other record uses."
  def purge(feed_id) when is_binary(feed_id) do
    purge_where(dynamic([m], m.feed_id == ^feed_id and m.status == "deleting"), feed_id)
  end

  @doc "Deletes media left by deleted feeds or organizations, with their files."
  def purge_orphans do
    purge_where(dynamic([m], is_nil(m.feed_id) or is_nil(m.organization_id)), nil)
  end

  def purge_orphans(organization_id) do
    purge_where(dynamic([m], is_nil(m.feed_id) and m.organization_id == ^organization_id), nil)
  end

  defp purge_where(condition, feed_id) do
    {:ok, keys} =
      Repo.transaction(fn ->
        if feed_id, do: Repo.one(from(f in Feed, where: f.id == ^feed_id, lock: "FOR UPDATE"))

        doomed = Repo.all(from(m in FeedMedia, where: ^condition, select: {m.id, m.storage_key}))
        keys = doomed |> Enum.map(&elem(&1, 1)) |> Enum.reject(&is_nil/1) |> Enum.uniq()
        Repo.delete_all(from(m in FeedMedia, where: m.id in ^Enum.map(doomed, &elem(&1, 0))))

        live =
          Repo.all(from(m in FeedMedia, where: m.storage_key in ^keys, select: m.storage_key))

        keys -- live
      end)

    Enum.each(keys, &delete_file/1)
    length(keys)
  end

  defp delete_file(key) do
    case MediaStorage.delete(key) do
      :ok -> :ok
      {:error, reason} -> Logger.error("[FeedMedia] Deleting #{key} failed: #{inspect(reason)}")
    end
  end

  @doc """
  Daily maintenance: purges unreferenced and orphaned media and re-queues
  downloads that have been pending for more than an hour (lost jobs).
  """
  def cleanup do
    feed_ids =
      Repo.all(
        from(m in FeedMedia,
          where: m.status == "deleting" and not is_nil(m.feed_id),
          distinct: true,
          select: m.feed_id
        )
      )

    purged = Enum.reduce(feed_ids, purge_orphans(), fn id, acc -> acc + purge(id) end)

    cutoff = DateTime.add(DateTime.utc_now(), -@stale_pending_seconds, :second)

    stale =
      Repo.all(
        from(m in FeedMedia,
          where: m.status == "pending" and m.updated_at < ^cutoff and not is_nil(m.feed_id),
          select: m.id
        )
      )

    Repo.update_all(from(m in FeedMedia, where: m.id in ^stale),
      set: [updated_at: DateTime.utc_now()]
    )

    Enum.each(stale, &FeedMediaDownloader.enqueue/1)

    %{purged_files: purged, requeued: length(stale)}
  end

  # ---------------------------------------------------------------------------
  # Reads
  # ---------------------------------------------------------------------------

  @doc """
  A feed's media for the dashboard, newest first, with the number of entries
  using each one. Original URLs are reduced to their host.
  """
  def list_media(%Feed{} = feed) do
    paths = copy_paths(feed)

    counts =
      feed
      |> holders()
      |> Enum.flat_map(fn {_holder, data} -> MediaPaths.collect(data, paths) end)
      |> Enum.frequencies()

    from(m in FeedMedia,
      where: m.feed_id == ^feed.id and m.status != "deleting",
      order_by: [desc: m.inserted_at]
    )
    |> Repo.all()
    |> Enum.map(fn m ->
      m
      |> Map.take([
        :id,
        :status,
        :failure_reason,
        :url,
        :content_type,
        :size,
        :width,
        :height,
        :duration,
        :inserted_at,
        :updated_at
      ])
      |> Map.put(:original_host, FeedMedia.original_host(m))
      |> Map.put(:entries, Map.get(counts, m.original_url, 0))
    end)
  end

  @doc "Bytes stored for a feed (files shared by several records count once)."
  def feed_storage(feed_id), do: storage(dynamic([m], m.feed_id == ^feed_id))

  @doc "Bytes of feed media stored for an organization; counts towards its storage quota."
  def storage_used(organization_id),
    do: storage(dynamic([m], m.organization_id == ^organization_id))

  defp storage(condition) do
    files =
      from(m in FeedMedia,
        where: ^condition,
        where: not is_nil(m.storage_key) and m.status in ["ready", "deleting"],
        distinct: true,
        select: %{key: m.storage_key, size: m.size}
      )

    Repo.one(from(f in subquery(files), select: type(coalesce(sum(f.size), 0), :integer))) || 0
  end

  @doc "The media referenced by `data` (entries or a document), as API clients see them."
  def statuses(%Feed{} = feed, data_list) do
    paths = copy_paths(feed)
    urls = data_list |> Enum.flat_map(&MediaPaths.collect(&1, paths)) |> Enum.uniq()

    if urls == [] do
      []
    else
      by_url =
        from(m in FeedMedia, where: m.feed_id == ^feed.id and m.original_url in ^urls)
        |> Repo.all()
        |> Map.new(&{&1.original_url, &1})

      for url <- urls, media = by_url[url] do
        %{"id" => media.id, "original_url" => url, "status" => media.status}
      end
    end
  end

  @doc "Queues a failed media for another download."
  def retry(%Feed{id: feed_id}, media_id) do
    with {:ok, uuid} <- Ecto.UUID.cast(media_id),
         {1, _} <-
           Repo.update_all(
             from(m in FeedMedia,
               where: m.id == ^uuid and m.feed_id == ^feed_id and m.status == "failed"
             ),
             set: [status: "pending", failure_reason: nil, updated_at: DateTime.utc_now()]
           ) do
      FeedMediaDownloader.enqueue(uuid)
      {:ok, Repo.get!(FeedMedia, uuid)}
    else
      _ -> {:error, :not_found}
    end
  end
end
