defmodule Castmill.StorageCleanups do
  @moduledoc """
  Deletes stored objects whose database records are gone, reliably.

  Callers record what to delete (`record/1`) in the same transaction that
  deletes the records. `run/1` then deletes the objects: right after the
  commit for the recorded rows, and daily for anything left (see
  `Castmill.Workers.FeedMediaCleanup`). A row is removed only once its object
  is gone, so restarts and temporary storage errors are retried.

  Kinds:
    * `"file"` – a media file (`%{"uri", "organization_id"}`);
    * `"feed_media"` – a copied feed media object (`%{"key"}`), deleted only
      when no feed media record still uses it;
    * `"widget_assets"` – a widget's uploaded assets (`%{"slug"}`), deleted
      only when no widget with that slug exists (slugs can be reused).
  """

  import Ecto.Query
  require Logger

  alias Castmill.Repo
  alias Castmill.StorageCleanups.StorageCleanup

  @doc "Records objects to delete: `[{kind, data}]`. Returns their ids."
  def record(entries) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    rows =
      Enum.map(entries, fn {kind, data} ->
        %{kind: kind, data: data, attempts: 0, inserted_at: now, updated_at: now}
      end)

    rows
    |> Enum.chunk_every(1_000)
    |> Enum.flat_map(fn chunk ->
      {_count, ids} = Repo.insert_all(StorageCleanup, chunk, returning: [:id])
      Enum.map(ids, & &1.id)
    end)
  end

  @doc """
  Runs the given cleanups in the background (inline when
  `config :castmill, :storage_cleanups_inline` is true, as in tests).
  """
  def run_soon(ids) do
    if Application.get_env(:castmill, :storage_cleanups_inline, false),
      do: run(ids),
      else: Task.start(fn -> run(ids) end)

    :ok
  end

  @doc """
  Deletes the objects of the given cleanup ids (or of every pending
  cleanup). Returns `%{done: n, failed: n}`.
  """
  def run(ids \\ :all) do
    query = from(c in StorageCleanup, order_by: [asc: c.id])
    query = if ids == :all, do: query, else: where(query, [c], c.id in ^ids)

    query
    |> Repo.all()
    |> Enum.reduce(%{done: 0, failed: 0}, fn cleanup, acc ->
      case perform(cleanup) do
        :ok ->
          Repo.delete(cleanup)
          %{acc | done: acc.done + 1}

        {:error, reason} ->
          cleanup
          |> StorageCleanup.changeset(%{
            attempts: cleanup.attempts + 1,
            last_error: inspect(reason)
          })
          |> Repo.update()

          Logger.warning("[StorageCleanups] #{cleanup.kind} #{cleanup.id}: #{inspect(reason)}")
          %{acc | failed: acc.failed + 1}
      end
    end)
  end

  defp perform(%StorageCleanup{kind: "file", data: %{"uri" => uri, "organization_id" => org_id}}) do
    file = %Castmill.Files.File{uri: uri, organization_id: org_id}

    case safely(fn -> Castmill.Resources.delete_stored_file(file) end) do
      :ok -> :ok
      {:ok, _} -> :ok
      {:error, :enoent} -> :ok
      {:error, {:http_error, 404, _}} -> :ok
      {:error, reason} -> {:error, reason}
      other -> {:error, other}
    end
  end

  defp perform(%StorageCleanup{kind: "feed_media", data: %{"key" => key}}) do
    in_use =
      Repo.exists?(from(m in Castmill.Feeds.FeedMedia, where: m.storage_key == ^key))

    if in_use,
      do: :ok,
      else: safely(fn -> Castmill.PublicStorage.delete(key) end)
  end

  defp perform(%StorageCleanup{kind: "widget_assets", data: %{"slug" => slug}}) do
    if Repo.exists?(from(w in Castmill.Widgets.Widget, where: w.slug == ^slug)),
      do: :ok,
      else: safely(fn -> Castmill.Widgets.AssetStorage.delete_assets(slug) end)
  end

  defp perform(%StorageCleanup{} = cleanup), do: {:error, {:unknown_cleanup, cleanup.kind}}

  defp safely(fun) do
    fun.()
  rescue
    error -> {:error, Exception.message(error)}
  end
end
