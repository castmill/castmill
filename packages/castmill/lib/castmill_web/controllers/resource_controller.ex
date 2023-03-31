defmodule CastmillWeb.ResourceController do
  use CastmillWeb, :controller

  alias Castmill.Organizations
  alias Castmill.Plug.Authorize
  alias Castmill.Resources.Media

  action_fallback CastmillWeb.FallbackController

  plug Authorize, %{parent: :organization, resource: :not_needed, action: :index} when action in [:index]
  plug Authorize, %{parent: :organization, resource: :not_needed, action: :create} when action in [:create]


  def index(conn, %{"resources" => "medias", "organization_id" => organization_id}) do
    medias = Organizations.list_medias(organization_id)
    render(conn, :index, medias: medias)
  end

  def index(conn, %{"resources" => "playlists", "organization_id" => organization_id}) do
    playlists = Organizations.list_playlists(organization_id)
    render(conn, :index, playlists: playlists)
  end


  def create(conn, %{"resources" => "medias", "organization_id" => organization_id, "media" => media}) do

    create_attrs = Map.merge(media, %{"organization_id" => organization_id})

    with {:ok, %Media{} = media} <- Castmill.Resources.create_media(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/organizations/#{organization_id}/medias/#{media.id}")
      |> render(:show, media: media)
    end
  end

  def create(conn, %{"resources" => "medias", "organization_id" => organization_id, "media" => media}) do

    create_attrs = Map.merge(media, %{"organization_id" => organization_id})

    with {:ok, %Media{} = media} <- Castmill.Resources.create_media(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/organizations/#{organization_id}/medias/#{media.id}")
      |> render(:show, media: media)
    end
  end

end
