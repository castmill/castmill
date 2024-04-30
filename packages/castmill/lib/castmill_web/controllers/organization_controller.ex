defmodule CastmillWeb.OrganizationController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Networks
  alias Castmill.Organizations
  alias Castmill.Organizations.Organization
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, :list_users_organizations, %{"user_id" => user_id}) do
    {:ok, actor_id == user_id}
  end

  # Not really needed other than to explictily show that we don't allow access to this action
  # unless you are the root user.
  def check_access(_actor_id, :list_networks_organizations, _params) do
    {:ok, false}
  end

  def check_access(actor_id, :list_devices, %{"organization_id" => organization_id}) do
    if Organizations.is_admin?(organization_id, actor_id) or
         Organizations.has_access(organization_id, actor_id, "devices", "list") do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  def check_access(actor_id, :register_device, %{"organization_id" => organization_id}) do
    if Organizations.is_admin?(organization_id, actor_id) or
         Organizations.has_access(organization_id, actor_id, "devices", "register") do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  # Default implementation for other actions not explicitly handled above
  def check_access(_actor_id, _action, _params) do
    # Default to false or implement your own logic based on other conditions
    {:ok, false}
  end

  plug(AuthorizeDash)

  # TODO: We also need a Quota plug to check if the user has enough quota to create resources in
  # the organization. This is not implemented yet.

  def list_users_organizations(conn, %{"user_id" => user_id}) do
    organizations = Organizations.list_user_organizations(user_id)
    render(conn, :index, organizations: organizations)
  end

  def list_networks_organizations(conn, %{"network_id" => network_id}) do
    organizations = Networks.list_organizations(network_id)
    render(conn, :index, organizations: organizations)
  end

  def index(conn, _params) do
    organizations = Organizations.list_organizations()
    render(conn, :index, organizations: organizations)
  end

  def create(conn, %{"organization" => organization_params, "network_id" => network_id}) do
    create_attrs = Map.merge(organization_params, %{"network_id" => network_id})

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

    with {:ok, %Organization{} = organization} <-
           Organizations.update_organization(organization, organization_params) do
      render(conn, :show, organization: organization)
    end
  end

  def delete(conn, %{"id" => id}) do
    organization = Organizations.get_organization!(id)

    with {:ok, %Organization{}} <- Organizations.delete_organization(organization) do
      send_resp(conn, :no_content, "")
    end
  end

  # Devices (Maybe this should be in a separate controller)
  @doc """
    Creates a device and adds it to an organization.
  """
  def register_device(conn, %{
        "name" => name,
        "pincode" => pincode,
        "organization_id" => organization_id
      }) do
    with {:ok, {device, _token}} <-
           Castmill.Devices.register_device(organization_id, pincode, %{name: name}) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/devices/#{device.id}")
      |> json(device)
    end
  end

  def list_devices(conn, params) do
    response = %{
      rows: Castmill.Devices.list_devices(params),
      count: Castmill.Devices.count_devices(params)
    }

    conn
    |> put_status(:ok)
    |> json(response)
  end
end
