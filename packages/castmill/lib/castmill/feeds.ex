defmodule Castmill.Feeds do
  @moduledoc """
  Data feeds: organization resources that external systems write to (through
  `/api/v1/feeds`) and widgets read from. See agents/systems/DATA-FEEDS.md.

  - `list` feeds keep the latest `keep` entries, newest first. An entry with an
    `external_id` that already exists replaces that entry in place.
  - `document` feeds hold one JSON document that is replaced on each write.

  Every write increments the feed's `version` and notifies dashboard previews.
  Devices read the data with their next playlist load.
  """

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Feeds.{Feed, FeedEntry, FeedToken}
  alias Castmill.Widgets.Schema

  @max_entry_bytes 64 * 1024
  @max_document_bytes 256 * 1024
  @max_batch 100
  @token_prefix "cmfeed_"
  @reserved_entry_keys ["id", "received_at", "external_id"]

  def max_entry_bytes, do: @max_entry_bytes
  def max_document_bytes, do: @max_document_bytes
  def max_batch, do: @max_batch
  def token_prefix, do: @token_prefix

  # ---------------------------------------------------------------------------
  # Feeds
  # ---------------------------------------------------------------------------

  @doc """
  Lists an organization's feeds with their entry counts.

  Params: `page`, `page_size` (max 100), `search`.
  Returns `%{data: [map], count: integer}`.
  """
  def list_feeds(organization_id, params \\ %{}) do
    page = positive_integer(params["page"] || params[:page], 1)
    page_size = positive_integer(params["page_size"] || params[:page_size], 20) |> min(100)
    search = params["search"] || params[:search]

    query =
      from(f in Feed, where: f.organization_id == ^organization_id)
      |> maybe_search(search)

    count = Repo.aggregate(query, :count)

    counts =
      from(e in FeedEntry, group_by: e.feed_id, select: %{feed_id: e.feed_id, count: count(e.id)})

    data =
      from(f in query,
        left_join: c in subquery(counts),
        on: c.feed_id == f.id,
        order_by: [asc: f.name],
        limit: ^page_size,
        offset: ^((page - 1) * page_size),
        select: {f, coalesce(c.count, 0)}
      )
      |> Repo.all()

    usage = usage_counts(organization_id, Enum.map(data, fn {feed, _} -> feed.id end))

    data =
      Enum.map(data, fn {feed, entry_count} ->
        feed |> feed_summary(entry_count) |> Map.put("usage_count", Map.get(usage, feed.id, 0))
      end)

    %{data: data, count: count}
  end

  defp maybe_search(query, search) when is_binary(search) and search != "" do
    pattern = "%" <> String.replace(search, ~r/[\\%_]/, "\\\\\\0") <> "%"
    where(query, [f], ilike(f.name, ^pattern))
  end

  defp maybe_search(query, _search), do: query

  @doc "A feed as listed in the dashboard."
  def feed_summary(%Feed{} = feed, entry_count) do
    feed
    |> Jason.encode!()
    |> Jason.decode!()
    |> Map.put("entry_count", if(feed.mode == "list", do: entry_count, else: nil))
  end

  @doc "Gets a feed of an organization, or nil."
  def get_feed(organization_id, id) do
    with {:ok, uuid} <- Ecto.UUID.cast(id) do
      Repo.one(from(f in Feed, where: f.id == ^uuid and f.organization_id == ^organization_id))
    else
      _ -> nil
    end
  end

  @doc "Gets a feed by id, or nil."
  def get_feed(id) do
    case Ecto.UUID.cast(id) do
      {:ok, uuid} -> Repo.get(Feed, uuid)
      :error -> nil
    end
  end

  def count_entries(%Feed{id: id}),
    do: Repo.aggregate(from(e in FeedEntry, where: e.feed_id == ^id), :count)

  @doc "Creates a feed, within the organization's `:feeds` quota."
  def create_feed(organization_id, attrs) do
    used = Repo.aggregate(from(f in Feed, where: f.organization_id == ^organization_id), :count)

    if used < Castmill.Quotas.get_quota_for_organization(organization_id, :feeds) do
      %Feed{}
      |> Feed.create_changeset(organization_id, attrs)
      |> Repo.insert()
    else
      {:error, :quota_exceeded}
    end
  end

  @doc """
  Updates a feed's settings. Lowering `keep` drops the oldest entries; any change
  that affects the data increments the version.
  """
  def update_feed(%Feed{} = feed, attrs) do
    Repo.transaction(fn ->
      changeset = Feed.changeset(lock(feed), attrs)
      data_changed? = Enum.any?([:mode, :keep], &Map.has_key?(changeset.changes, &1))

      case Repo.update(changeset) do
        {:ok, updated} when data_changed? ->
          if updated.mode == "list", do: trim(updated)
          {bump_version(updated), true}

        {:ok, updated} ->
          {updated, false}

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
    |> case do
      {:ok, {feed, changed?}} -> notify_if_changed({:ok, feed}, changed?)
      error -> error
    end
  end

  def delete_feed(%Feed{} = feed), do: Repo.delete(feed)

  def change_feed(%Feed{} = feed, attrs \\ %{}), do: Feed.changeset(feed, attrs)

  @doc """
  How many playlist items of the organization show each feed. Returns a map of
  feed id to count (feeds without items are missing).
  """
  def usage_counts(organization_id, feed_ids) when is_list(feed_ids) do
    feed_ids = Enum.map(feed_ids, &to_string/1)

    organization_id
    |> usage_query(feed_ids)
    |> group_by([_wc, _pi, _p, kv], fragment("?.value", kv))
    |> select([wc, _pi, _p, kv], {fragment("?.value", kv), count(wc.id)})
    |> Repo.all()
    |> Map.new()
  end

  @doc "The playlists of the organization that show the feed, as `%{id, name, items}`."
  def used_by(organization_id, %Feed{id: id}) do
    organization_id
    |> usage_query([id])
    |> group_by([_wc, _pi, p, _kv], [p.id, p.name])
    |> order_by([_wc, _pi, p, _kv], asc: p.name)
    |> select([wc, _pi, p, _kv], %{id: p.id, name: p.name, items: count(wc.id)})
    |> Repo.all()
  end

  # Widget configs whose options hold one of the feed ids as a top-level value.
  defp usage_query(organization_id, feed_ids) do
    from(wc in Castmill.Widgets.WidgetConfig,
      join: pi in Castmill.Resources.PlaylistItem,
      on: pi.id == wc.playlist_item_id,
      join: p in Castmill.Resources.Playlist,
      on: p.id == pi.playlist_id,
      join: kv in fragment("jsonb_each_text(?)", wc.options),
      on: true,
      where: p.organization_id == ^organization_id and fragment("?.value", kv) in ^feed_ids
    )
  end

  # ---------------------------------------------------------------------------
  # Tokens
  # ---------------------------------------------------------------------------

  @doc """
  Creates a write token for a feed. Returns `{:ok, token, secret}`; the secret is
  not stored and can't be shown again.
  """
  def create_token(%Feed{} = feed, attrs, created_by_id \\ nil) do
    secret = @token_prefix <> Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
    name = attrs["name"] || attrs[:name]

    %FeedToken{}
    |> FeedToken.changeset(%{
      name: if(is_binary(name) and String.trim(name) != "", do: name, else: "Token"),
      secret_hash: hash_secret(secret),
      hint: String.slice(secret, -4, 4),
      feed_id: feed.id,
      created_by_id: created_by_id
    })
    |> Repo.insert()
    |> case do
      {:ok, token} -> {:ok, token, secret}
      error -> error
    end
  end

  def list_tokens(%Feed{id: feed_id}) do
    Repo.all(
      from(t in FeedToken,
        where: t.feed_id == ^feed_id,
        order_by: [asc: not is_nil(t.revoked_at), desc: t.inserted_at, asc: t.name]
      )
    )
  end

  @doc "Revokes a token of the feed. Revoked tokens stay listed for reference."
  def revoke_token(%Feed{id: feed_id}, token_id) do
    with {:ok, uuid} <- Ecto.UUID.cast(token_id),
         %FeedToken{} = token <- Repo.get_by(FeedToken, id: uuid, feed_id: feed_id) do
      token
      |> Ecto.Changeset.change(revoked_at: token.revoked_at || now_seconds())
      |> Repo.update()
    else
      _ -> {:error, :not_found}
    end
  end

  @doc """
  Authenticates a feed token secret. Returns `{:ok, token}` with its feed
  preloaded, or `{:error, :invalid_token}`.
  """
  def authenticate_token(@token_prefix <> _ = secret) do
    hash = hash_secret(secret)

    case Repo.one(
           from(t in FeedToken,
             where: t.secret_hash == ^hash and is_nil(t.revoked_at),
             preload: [:feed]
           )
         ) do
      %FeedToken{} = token ->
        now = now_seconds()
        Repo.update_all(from(t in FeedToken, where: t.id == ^token.id), set: [last_used_at: now])
        {:ok, %{token | last_used_at: now}}

      nil ->
        {:error, :invalid_token}
    end
  end

  def authenticate_token(_secret), do: {:error, :invalid_token}

  defp hash_secret(secret), do: :crypto.hash(:sha256, secret) |> Base.encode16(case: :lower)

  # ---------------------------------------------------------------------------
  # Writes
  # ---------------------------------------------------------------------------

  @doc """
  Appends entries to a `list` feed. Entries are in chronological order (the last
  one is the newest). Returns `{:ok, %{entries: stored, version: version}}`, where
  `stored` excludes entries already dropped by `keep`.
  """
  def append_entries(%Feed{mode: "list"} = feed, entries) when is_list(entries) do
    with :ok <- check_batch(entries),
         {:ok, normalized} <- normalize_entries(feed, entries) do
      Repo.transaction(fn ->
        feed = lock(feed)
        stored = insert_entries(feed, normalized)
        trim(feed)
        kept = kept_entries(stored)
        {bump_version(feed), kept}
      end)
      |> case do
        {:ok, {feed, kept}} ->
          notify(feed)
          {:ok, %{entries: Enum.map(kept, &FeedEntry.to_map/1), version: feed.version}}

        error ->
          error
      end
    end
  end

  def append_entries(%Feed{}, entries) when is_list(entries), do: {:error, :not_a_list_feed}
  def append_entries(%Feed{}, _entries), do: {:error, {:invalid_entry, 0, "must be an object"}}

  @doc """
  Appends one entry to several feeds of the same organization. Returns
  `{:ok, [%{feed_id, entries, version}]}`; nothing is written if any feed rejects
  the entry.
  """
  def append_to_feeds(feeds, entry) when is_list(feeds) do
    feeds = Enum.uniq_by(feeds, & &1.id)

    with :ok <- if(feeds == [], do: {:error, :no_feeds}, else: :ok),
         :ok <- if(length(feeds) > @max_batch, do: {:error, :too_many_feeds}, else: :ok),
         nil <- Enum.find(feeds, &(&1.mode != "list")),
         {:ok, normalized} <- normalize_for_feeds(feeds, entry) do
      Repo.transaction(fn ->
        Enum.map(normalized, fn {feed, entries} ->
          feed = lock(feed)
          stored = insert_entries(feed, entries)
          trim(feed)
          {bump_version(feed), kept_entries(stored)}
        end)
      end)
      |> case do
        {:ok, results} ->
          Enum.each(results, fn {feed, _} -> notify(feed) end)

          {:ok,
           Enum.map(results, fn {feed, kept} ->
             %{
               feed_id: feed.id,
               entries: Enum.map(kept, &FeedEntry.to_map/1),
               version: feed.version
             }
           end)}

        error ->
          error
      end
    else
      %Feed{} = feed -> {:error, {:not_a_list_feed, feed.id}}
      error -> error
    end
  end

  defp normalize_for_feeds(feeds, entry) do
    Enum.reduce_while(feeds, {:ok, []}, fn feed, {:ok, acc} ->
      case normalize_entries(feed, [entry]) do
        {:ok, normalized} -> {:cont, {:ok, acc ++ [{feed, normalized}]}}
        {:error, reason} -> {:halt, {:error, {:feed, feed.id, reason}}}
      end
    end)
  end

  @doc """
  Replaces all data: a `document` feed's document (any JSON object), or a `list`
  feed's entries (`%{"entries" => [...]}`).
  """
  def replace_data(%Feed{mode: "document"} = feed, document) when is_map(document) do
    with :ok <- check_size(document, @max_document_bytes, :document_too_large),
         :ok <- document_schema(feed, document) do
      Repo.transaction(fn ->
        feed = lock(feed)

        feed
        |> Ecto.Changeset.change(document: document)
        |> Repo.update!()
        |> bump_version()
      end)
      |> notify_if_changed(true)
      |> case do
        {:ok, feed} -> {:ok, %{document: feed.document, version: feed.version}}
        error -> error
      end
    end
  end

  def replace_data(%Feed{mode: "list"} = feed, %{"entries" => entries}) when is_list(entries) do
    with :ok <- check_batch(entries),
         {:ok, normalized} <- normalize_entries(feed, entries) do
      Repo.transaction(fn ->
        feed = lock(feed)
        Repo.delete_all(from(e in FeedEntry, where: e.feed_id == ^feed.id))
        stored = insert_entries(feed, normalized)
        trim(feed)
        {bump_version(feed), kept_entries(stored)}
      end)
      |> case do
        {:ok, {feed, kept}} ->
          notify(feed)
          {:ok, %{entries: Enum.map(kept, &FeedEntry.to_map/1), version: feed.version}}

        error ->
          error
      end
    end
  end

  def replace_data(%Feed{mode: "list"}, _payload),
    do: {:error, {:invalid_entry, 0, ~s(expected {"entries": [...]})}}

  def replace_data(%Feed{}, _payload),
    do: {:error, {:invalid_entry, 0, "the document must be an object"}}

  @doc "Deletes one entry of a feed."
  def delete_entry(%Feed{} = feed, entry_id) do
    with {:ok, uuid} <- Ecto.UUID.cast(entry_id) do
      Repo.transaction(fn ->
        feed = lock(feed)

        case Repo.delete_all(from(e in FeedEntry, where: e.feed_id == ^feed.id and e.id == ^uuid)) do
          {0, _} -> Repo.rollback(:not_found)
          _ -> bump_version(feed)
        end
      end)
      |> notify_if_changed(true)
    else
      :error -> {:error, :not_found}
    end
  end

  @doc "Removes all entries (list feeds) or the document (document feeds)."
  def clear(%Feed{} = feed) do
    Repo.transaction(fn ->
      feed = lock(feed)
      Repo.delete_all(from(e in FeedEntry, where: e.feed_id == ^feed.id))

      feed
      |> Ecto.Changeset.change(document: nil)
      |> Repo.update!()
      |> bump_version()
    end)
    |> notify_if_changed(true)
  end

  defp check_batch(entries) do
    cond do
      entries == [] -> {:error, :no_entries}
      length(entries) > @max_batch -> {:error, :too_many_entries}
      true -> :ok
    end
  end

  # Validates and prepares entries; duplicate external ids in a batch keep the last one.
  defp normalize_entries(feed, entries) do
    entries
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {entry, index}, {:ok, acc} ->
      case normalize_entry(feed, entry) do
        {:ok, normalized} -> {:cont, {:ok, [Map.put(normalized, :index, index) | acc]}}
        {:error, reason} -> {:halt, {:error, error_with_index(reason, index)}}
      end
    end)
    |> case do
      {:ok, reversed} ->
        {without_id, with_id} = Enum.split_with(Enum.reverse(reversed), &is_nil(&1.external_id))

        deduped =
          with_id
          |> Enum.reverse()
          |> Enum.uniq_by(& &1.external_id)
          |> Enum.reverse()

        {:ok, Enum.sort_by(without_id ++ deduped, & &1.index)}

      error ->
        error
    end
  end

  defp error_with_index(:entry_too_large, index), do: {:entry_too_large, index}
  defp error_with_index({:schema, message}, index), do: {:schema_mismatch, index, message}

  defp error_with_index(message, index) when is_binary(message),
    do: {:invalid_entry, index, message}

  defp normalize_entry(feed, entry) when is_map(entry) do
    with {:ok, external_id} <- external_id(entry["external_id"]),
         data = Map.drop(entry, @reserved_entry_keys),
         :ok <- check_size(entry, @max_entry_bytes, :entry_too_large),
         :ok <- check_schema(feed, data) do
      {:ok, %{external_id: external_id, data: data}}
    end
  end

  defp normalize_entry(_feed, _entry), do: {:error, "must be an object"}

  defp external_id(nil), do: {:ok, nil}

  defp external_id(id) when is_binary(id) do
    id = String.trim(id)

    cond do
      id == "" -> {:ok, nil}
      String.length(id) > 255 -> {:error, "external_id is longer than 255 characters"}
      true -> {:ok, id}
    end
  end

  defp external_id(id) when is_integer(id), do: {:ok, Integer.to_string(id)}
  defp external_id(_id), do: {:error, "external_id must be a string or an integer"}

  defp check_size(value, max, error) do
    if byte_size(Jason.encode!(value)) <= max, do: :ok, else: {:error, error}
  end

  defp document_schema(feed, document) do
    case check_schema(feed, document) do
      {:error, {:schema, message}} -> {:error, {:schema_mismatch, 0, message}}
      other -> other
    end
  end

  defp check_schema(%Feed{schema: schema}, data) when is_map(schema) and map_size(schema) > 0 do
    case Schema.validate_data(schema, data) do
      {:ok, _} -> :ok
      {:error, message} -> {:error, {:schema, message}}
    end
  end

  defp check_schema(_feed, _data), do: :ok

  defp lock(%Feed{id: id}),
    do: Repo.one!(from(f in Feed, where: f.id == ^id, lock: "FOR UPDATE"))

  # Entries of a batch get increasing timestamps so their order is kept.
  defp insert_entries(feed, normalized) do
    base = DateTime.utc_now()

    normalized
    |> Enum.with_index()
    |> Enum.map(fn {%{external_id: external_id, data: data}, offset} ->
      received_at = DateTime.add(base, offset, :microsecond)

      existing =
        external_id &&
          Repo.one(
            from(e in FeedEntry, where: e.feed_id == ^feed.id and e.external_id == ^external_id)
          )

      case existing do
        %FeedEntry{} = entry ->
          entry |> Ecto.Changeset.change(data: data) |> Repo.update!()

        nil ->
          Repo.insert!(%FeedEntry{
            feed_id: feed.id,
            external_id: external_id,
            data: data,
            received_at: received_at
          })
      end
    end)
  end

  defp trim(%Feed{id: id, keep: keep}) do
    kept =
      from(e in FeedEntry,
        where: e.feed_id == ^id,
        order_by: [desc: e.received_at, desc: e.id],
        limit: ^keep,
        select: e.id
      )

    Repo.delete_all(from(e in FeedEntry, where: e.feed_id == ^id and e.id not in subquery(kept)))
  end

  defp kept_entries(stored) do
    ids = Enum.map(stored, & &1.id)
    present = MapSet.new(Repo.all(from(e in FeedEntry, where: e.id in ^ids, select: e.id)))
    stored |> Enum.filter(&MapSet.member?(present, &1.id)) |> Enum.reverse()
  end

  defp bump_version(%Feed{} = feed) do
    feed
    |> Ecto.Changeset.change(version: feed.version + 1, data_updated_at: DateTime.utc_now())
    |> Repo.update!()
  end

  defp notify_if_changed({:ok, %Feed{} = feed} = result, true) do
    notify(feed)
    result
  end

  defp notify_if_changed(result, _changed), do: result

  # Dashboard previews showing this feed update immediately (see WidgetView).
  defp notify(%Feed{} = feed) do
    Phoenix.PubSub.broadcast(
      Castmill.PubSub,
      "organization:#{feed.organization_id}",
      {:widget_config_data_update,
       %{
         type: "widget_config_data_update",
         widget_id: nil,
         integration_id: nil,
         discriminator_id: "feed:" <> feed.id,
         feed_id: feed.id,
         data: data(feed),
         version: feed.version,
         updated_at: DateTime.utc_now() |> DateTime.to_iso8601()
       }}
    )
  end

  # ---------------------------------------------------------------------------
  # Reads
  # ---------------------------------------------------------------------------

  @doc """
  The data widgets receive: `%{"entries" => [...], "updated_at" => iso}` for list
  feeds (newest first) or `%{"document" => map, "updated_at" => iso}`.
  """
  def data(%Feed{mode: "list"} = feed) do
    %{"entries" => Enum.map(list_entries(feed), &FeedEntry.to_map/1), "updated_at" => iso(feed)}
  end

  def data(%Feed{} = feed), do: %{"document" => feed.document, "updated_at" => iso(feed)}

  def list_entries(%Feed{id: id, keep: keep}) do
    Repo.all(
      from(e in FeedEntry,
        where: e.feed_id == ^id,
        order_by: [desc: e.received_at, desc: e.id],
        limit: ^keep
      )
    )
  end

  defp iso(%Feed{data_updated_at: nil}), do: nil
  defp iso(%Feed{data_updated_at: at}), do: DateTime.to_iso8601(at)

  # ---------------------------------------------------------------------------
  # Widgets
  # ---------------------------------------------------------------------------

  @doc "The choice list name of options that pick a feed."
  def choice_list, do: "feeds"

  @doc """
  The options_schema field of a widget that picks a feed
  (`"choices": {"list": "feeds"}`), or nil.
  """
  def feed_option(%{options_schema: schema}) when is_map(schema) do
    Enum.find_value(schema, fn
      {key, %{"choices" => %{"list" => "feeds"}}} -> key
      _ -> nil
    end)
  end

  def feed_option(_widget), do: nil

  @doc """
  Data for a widget that shows a feed:

    * `:not_a_feed_widget` when the widget doesn't pick a feed;
    * `{:ok, nil}` when no feed is selected yet;
    * `{:ok, %{data: map, version: integer, feed: feed}}`;
    * `{:error, :feed_not_found}` when the feed doesn't exist in the organization.
  """
  def widget_data(widget, organization_id, options) do
    case feed_option(widget) do
      nil ->
        :not_a_feed_widget

      key ->
        case (options || %{})[key] do
          id when is_binary(id) and id != "" ->
            case get_feed(organization_id, id) do
              %Feed{} = feed -> {:ok, %{data: data(feed), version: feed.version, feed: feed}}
              nil -> {:error, :feed_not_found}
            end

          _ ->
            {:ok, nil}
        end
    end
  end

  @doc """
  Choices for options that pick a feed: the organization's feeds, searchable by
  name. Selected values are listed first.
  """
  def choices(organization_id, params) do
    query = params["query"] || ""
    offset = positive_integer(params["cursor"], 0, 0)
    values = Enum.filter(params["values"] || [], &match?({:ok, _}, Ecto.UUID.cast(&1)))
    page_size = 50

    selected =
      if offset == 0 and values != [] do
        Repo.all(
          from(f in Feed, where: f.organization_id == ^organization_id and f.id in ^values)
        )
      else
        []
      end

    feeds =
      from(f in Feed,
        where: f.organization_id == ^organization_id,
        order_by: [asc: f.name],
        offset: ^offset,
        limit: ^(page_size + 1)
      )
      |> maybe_search(query)
      |> Repo.all()

    next = if length(feeds) > page_size, do: Integer.to_string(offset + page_size)

    items =
      (selected ++ Enum.take(feeds, page_size))
      |> Enum.uniq_by(& &1.id)
      |> Enum.map(fn feed ->
        %{value: feed.id, label: feed.name}
        |> then(&if feed.description, do: Map.put(&1, :description, feed.description), else: &1)
      end)

    {:ok, %{items: items, next: next}}
  end

  # ---------------------------------------------------------------------------

  defp positive_integer(value, default, min \\ 1)
  defp positive_integer(value, _default, min) when is_integer(value) and value >= min, do: value

  defp positive_integer(value, default, min) when is_binary(value) do
    case Integer.parse(value) do
      {n, ""} when n >= min -> n
      _ -> default
    end
  end

  defp positive_integer(_value, default, _min), do: default

  defp now_seconds, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
