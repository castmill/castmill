defmodule CastmillWeb.ResourceController do
  use CastmillWeb, :controller

  alias Castmill.Organizations
  alias Castmill.Plug.Authorize
  alias Castmill.Resources.Media

  action_fallback(CastmillWeb.FallbackController)

  plug(
    Authorize,
    %{parent: :organization, resource: :not_needed, action: :index} when action in [:index]
  )

  plug(
    Authorize,
    %{parent: :organization, resource: :not_needed, action: :create} when action in [:create]
  )

  @index_params_schema %{
    resources: [type: :string, required: true],
    page: [type: :integer, number: [min: 1]],
    page_size: [type: :integer, number: [min: 1, max: 100]],
    search: :string
  }

  def index(conn, %{"resources" => "medias"} = params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      medias = Organizations.list_medias(params)
      count = Organizations.count_medias(params)
      render(conn, :index, medias: medias, count: count)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def index(conn, %{"resources" => "playlists"} = params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      playlists = Organizations.list_playlists(params)
      count = Organizations.count_playlists(params)
      render(conn, :index, playlists: playlists, count: count)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def create(conn, %{
        "resources" => "medias",
        "organization_id" => organization_id,
        "media" => media
      }) do
    create_attrs = Map.merge(media, %{"organization_id" => organization_id})

    with {:ok, %Media{} = media} <- Castmill.Resources.create_media(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/organizations/#{organization_id}/medias/#{media.id}")
      |> render(:show, media: media)
    end
  end

  def delete(conn, %{
    "resources" => "medias",
    "id" => id}
  ) do
    case Castmill.Resources.get_media(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Media not found"]})
        |> halt()
      media ->
        with {:ok, %Media{}} <- Castmill.Resources.delete_media(media) do
          send_resp(conn, :no_content, "")
        else
          {:error, reason} ->
            send_resp(conn, 500, "Error deleting media: #{inspect(reason)}")
        end
    end
  end
end
