defmodule CastmillWeb.FeedController do
  @moduledoc """
  Dashboard API for an organization's data feeds:
  `/dashboard/organizations/:organization_id/feeds`.
  """
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.{Feeds, Organizations}
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  plug(AuthorizeDash)

  @permissions %{
    index: :list,
    show: :show,
    entries: :show,
    create: :create,
    update: :update,
    test_entry: :update,
    delete_entry: :update,
    clear: :update,
    tokens: :update,
    create_token: :update,
    revoke_token: :update,
    delete: :delete
  }

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, action, %{"organization_id" => organization_id}) do
    case Map.fetch(@permissions, action) do
      {:ok, permission} ->
        {:ok, Organizations.has_access(organization_id, actor_id, "feeds", permission)}

      :error ->
        {:ok, false}
    end
  end

  def check_access(_actor_id, _action, _params), do: {:ok, false}

  def index(conn, %{"organization_id" => organization_id} = params) do
    json(conn, Feeds.list_feeds(organization_id, params))
  end

  def show(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, feed} <- fetch_feed(organization_id, id) do
      json(conn, %{data: feed_details(organization_id, feed)})
    end
  end

  def create(conn, %{"organization_id" => organization_id} = params) do
    case Feeds.create_feed(organization_id, Map.get(params, "feed", %{})) do
      {:ok, feed} ->
        conn |> put_status(:created) |> json(%{data: feed_details(organization_id, feed)})

      {:error, :quota_exceeded} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "quota_exceeded", message: "The organization's feed quota is used up"})

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def update(conn, %{"organization_id" => organization_id, "id" => id} = params) do
    with {:ok, feed} <- fetch_feed(organization_id, id),
         {:ok, feed} <- Feeds.update_feed(feed, Map.get(params, "feed", %{})) do
      json(conn, %{data: feed_details(organization_id, feed)})
    end
  end

  def delete(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, feed} <- fetch_feed(organization_id, id),
         {:ok, _feed} <- Feeds.delete_feed(feed) do
      send_resp(conn, :no_content, "")
    end
  end

  def entries(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, feed} <- fetch_feed(organization_id, id) do
      json(conn, %{data: Feeds.data(feed), version: feed.version})
    end
  end

  # Sends a test entry (list feeds) or document (document feeds) from the dashboard.
  def test_entry(conn, %{"organization_id" => organization_id, "id" => id} = params) do
    with {:ok, feed} <- fetch_feed(organization_id, id) do
      result =
        case {feed.mode, params} do
          {"list", %{"entry" => entry}} -> Feeds.append_entries(feed, [entry])
          {"document", %{"document" => document}} -> Feeds.replace_data(feed, document)
          _ -> {:error, {:invalid_entry, 0, "expected an entry or a document"}}
        end

      case result do
        {:ok, _result} ->
          {:ok, feed} = fetch_feed(organization_id, id)
          json(conn, %{data: Feeds.data(feed), version: feed.version})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: write_error(reason)})
      end
    end
  end

  def delete_entry(conn, %{
        "organization_id" => organization_id,
        "id" => id,
        "entry_id" => entry_id
      }) do
    with {:ok, feed} <- fetch_feed(organization_id, id),
         {:ok, _feed} <- Feeds.delete_entry(feed, entry_id) do
      send_resp(conn, :no_content, "")
    end
  end

  def clear(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, feed} <- fetch_feed(organization_id, id),
         {:ok, _feed} <- Feeds.clear(feed) do
      send_resp(conn, :no_content, "")
    end
  end

  def tokens(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, feed} <- fetch_feed(organization_id, id) do
      json(conn, %{data: Feeds.list_tokens(feed)})
    end
  end

  def create_token(conn, %{"organization_id" => organization_id, "id" => id} = params) do
    with {:ok, feed} <- fetch_feed(organization_id, id),
         {:ok, token, secret} <- Feeds.create_token(feed, params, actor_id(conn)) do
      conn
      |> put_status(:created)
      |> json(%{data: token, secret: secret})
    end
  end

  def revoke_token(conn, %{
        "organization_id" => organization_id,
        "id" => id,
        "token_id" => token_id
      }) do
    with {:ok, feed} <- fetch_feed(organization_id, id),
         {:ok, token} <- Feeds.revoke_token(feed, token_id) do
      json(conn, %{data: token})
    end
  end

  defp fetch_feed(organization_id, id) do
    case Feeds.get_feed(organization_id, id) do
      nil -> {:error, :not_found}
      feed -> {:ok, feed}
    end
  end

  defp feed_details(organization_id, feed) do
    feed
    |> Feeds.feed_summary(Feeds.count_entries(feed))
    |> Map.put("used_by", Feeds.used_by(organization_id, feed))
    |> Map.put("endpoints", endpoints(feed))
  end

  defp endpoints(feed) do
    base = CastmillWeb.Endpoint.url() <> "/api/v1/feeds/" <> feed.id

    %{
      "append" => base <> "/entries",
      "replace" => base <> "/data",
      "read" => base
    }
  end

  defp actor_id(conn) do
    case conn.assigns[:current_actor] || conn.assigns[:current_user] do
      %{id: id} -> id
      _ -> nil
    end
  end

  defp write_error(:not_a_list_feed), do: "Entries can only be added to list feeds"
  defp write_error({:entry_too_large, _}), do: "The entry is too large"
  defp write_error(:document_too_large), do: "The document is too large"
  defp write_error({:schema_mismatch, _, message}), do: message
  defp write_error({:invalid_entry, _, message}), do: message
  defp write_error(_reason), do: "The entry could not be stored"
end
