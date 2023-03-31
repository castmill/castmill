defmodule CastmillWeb.OrganizationController do
  use CastmillWeb, :controller

  alias Castmill.Organizations
  alias Castmill.Organizations.Organization

  action_fallback CastmillWeb.FallbackController

  alias Castmill.Plug.Authorize
  plug Authorize, %{parent: :network, resource: :organization, action: :index} when action in [:index]
  plug Authorize, %{parent: :network, resource: :organization, action: :create} when action in [:create]

  alias Castmill.Networks
  def index(conn, %{"network_id" => network_id}) do
    organizations = Networks.list_organizations(network_id)
    render(conn, :index, organizations: organizations)
  end

  def index(conn, _params) do
    organizations = Organizations.list_organizations()
    render(conn, :index, organizations: organizations)
  end

  def create(conn, %{"organization" => organization_params, "network_id" => network_id}) do

    create_attrs = Map.merge(organization_params, %{"network_id" => network_id})

    IO.inspect create_attrs

    with {:ok, %Organization{} = organization} <- Organizations.create_organization(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/organizations/#{organization}")
      |> render(:show, organization: organization)
    end
  end

  def show(conn, %{"id" => id}) do
    organization = Organizations.get_organization!(id)
    render(conn, :show, organization: organization)
  end

  def update(conn, %{"id" => id, "organization" => organization_params}) do
    organization = Organizations.get_organization!(id)

    with {:ok, %Organization{} = organization} <- Organizations.update_organization(organization, organization_params) do
      render(conn, :show, organization: organization)
    end
  end

  def delete(conn, %{"id" => id}) do
    organization = Organizations.get_organization!(id)

    with {:ok, %Organization{}} <- Organizations.delete_organization(organization) do
      send_resp(conn, :no_content, "")
    end
  end
end
