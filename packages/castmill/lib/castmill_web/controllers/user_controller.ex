defmodule CastmillWeb.UserController do
  use CastmillWeb, :controller

  alias Castmill.Organizations
  alias Castmill.Networks
  alias Castmill.Accounts.User
  alias Castmill.Plug.Authorize

  action_fallback CastmillWeb.FallbackController
  # plug :authorize_network when action in [:index, :create, :show, :update, :delete]
  # plug Authorize, action: :index, resource: :network
  plug Authorize, %{parent: :network, resource: :user, action: :index} when action in [:index]
  plug Authorize, %{parent: :network, resource: :user, action: :create} when action in [:create]

  def index(conn, %{"organization_id" => organization_id}) do
    users_access = Organizations.list_users(organization_id)
    render(conn, :index, users_access: users_access)
  end

  def index(conn, %{"network_id" => network_id}) do
    users = Networks.list_users(network_id)
    render(conn, :index, users: users)
  end

  def create(conn, %{"user" => user_params, "network_id" => network_id}) do
    create_attrs = Map.merge(user_params, %{"network_id" => network_id})

    with {:ok, %User{} = user} <- Castmill.Accounts.create_user(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/networks/#{network_id}/users/#{user}")
      |> render(:show, user: user)
    end
  end

  @doc """
    Creates a user and adds it to an organization with a given access list.
  """
  def create(conn, %{"user" => user, "access" => access, "organization_id" => organization_id}) do
    # First create a user on the same network as the organization is in.
    # Then add the user to the organization with the given access list.

    # Get the network_id from the organization_id
    organization = Organizations.get_organization!(organization_id)
    network_id = organization.network_id

    create_attrs = Map.merge(user, %{"network_id" => network_id})

    with {:ok, user} <- Castmill.Accounts.create_user(create_attrs) do
      update(conn, %{"id" => user.id, "access" => access, "organization_id" => organization_id})
    end
  end

  @spec show(Plug.Conn.t(), map) :: Plug.Conn.t()
  def show(conn, %{"id" => id}) do
    user = Organizations.get_user!(id)
    render(conn, :show, user: user)
  end

  # def update(conn, %{"id" => id, "user" => user_params}) do
  #   user = Organizations.get_user!(id)

  #   with {:ok, %User{} = user} <- Organizations.update_user(user, user_params) do
  #     render(conn, :show, user: user)
  #   end
  # end

  @doc """
    Adds an existing user to an organization with a given access list.
  """
  def update(conn, %{"access" => access, "id" => user_id, "organization_id" => organization_id}) do
    with {:ok, _} <- Organizations.update_access(organization_id, user_id, access) do
      send_resp(conn, :no_content, "")
    end
  end

  def delete(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, _} <- Organizations.remove_user(organization_id, id) do
      send_resp(conn, :no_content, "")
    else
      {:error, :not_found} -> send_resp(conn, :not_found, "")
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Castmill.Accounts.delete_user(id) do
      send_resp(conn, :no_content, "")
    else
      {:error, :not_found} -> send_resp(conn, :not_found, "")
    end
  end
end
