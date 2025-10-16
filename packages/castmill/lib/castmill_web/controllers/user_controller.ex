defmodule CastmillWeb.UserController do
  use CastmillWeb, :controller

  alias Castmill.Accounts
  alias Castmill.Organizations
  alias Castmill.Networks
  alias Castmill.Accounts.User
  alias Castmill.Plug.Authorize

  action_fallback(CastmillWeb.FallbackController)
  # plug :authorize_network when action in [:index, :create, :show, :update, :delete]
  # plug Authorize, action: :index, resource: :network
  plug(Authorize, %{parent: :network, resource: :user, action: :index} when action in [:index])
  plug(Authorize, %{parent: :network, resource: :user, action: :create} when action in [:create])

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
    user = Accounts.get_user(id)
    render(conn, :show, user: user)
  end

  @doc """
  Updates a user:
  - With "user" params: Updates user profile (name, etc.)
  - With "access" and "organization_id" params: Updates user role in an organization
  """
  def update(conn, params)

  def update(conn, %{"id" => user_id, "user" => user_params}) do
    user = Accounts.get_user(user_id)

    with {:ok, updated_user} <- Accounts.update_user(user, user_params) do
      # Update the session with the new user data if this is the current user's session
      conn =
        if get_session(conn, :user) && get_session(conn, :user).id == user_id do
          put_session(conn, :user, updated_user)
        else
          conn
        end

      render(conn, :show, user: updated_user)
    end
  end

  def update(conn, %{"access" => access, "id" => user_id, "organization_id" => organization_id}) do
    with {:ok, _} <- Organizations.update_role(organization_id, user_id, access) do
      send_resp(conn, :no_content, "")
    end
  end

  def delete(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, _} <- Organizations.remove_user(organization_id, id) do
      send_resp(conn, :no_content, "")
    else
      {:error, :not_found} ->
        send_resp(conn, :not_found, "")

      {:error, :last_admin} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "cannot_remove_last_organization_admin"})

      {:error, :last_organization} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "cannot_remove_user_from_last_organization"})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "failed_to_remove_user"})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Castmill.Accounts.delete_user(id) do
      send_resp(conn, :no_content, "")
    else
      {:error, :not_found} ->
        send_resp(conn, :not_found, "")

      {:error, {:sole_administrator, org_name}} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          error: "sole_administrator",
          organization_name: org_name
        })

      {:error, message} when is_binary(message) ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: message})

      {:error, _other} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "failed_to_delete_account"})
    end
  end

  @doc """
  List user's credentials/passkeys
  """
  def list_credentials(conn, %{"id" => user_id}) do
    credentials = Accounts.list_user_credentials(user_id)
    user = Accounts.get_user(user_id)

    # Add friendly names to credentials
    credentials_with_names =
      Enum.map(credentials, fn credential ->
        name =
          if user, do: Accounts.get_credential_name(user, credential.id), else: "Unnamed Device"

        %{
          id: credential.id,
          name: name,
          inserted_at: credential.inserted_at,
          updated_at: credential.updated_at
        }
      end)

    json(conn, %{credentials: credentials_with_names})
  end

  @doc """
  Delete a user's credential/passkey
  """
  def delete_credential(conn, %{"id" => user_id, "credential_id" => credential_id}) do
    with {:ok, _} <- Accounts.delete_user_credential(user_id, credential_id) do
      send_resp(conn, :no_content, "")
    else
      {:error, :not_found} -> send_resp(conn, :not_found, "")
    end
  end

  @doc """
  Update credential name
  """
  def update_credential(conn, %{"id" => user_id, "credential_id" => credential_id, "name" => name}) do
    with {:ok, _} <- Accounts.update_credential_name(user_id, credential_id, name) do
      json(conn, %{status: "ok", message: "Credential name updated"})
    else
      {:error, :user_not_found} -> send_resp(conn, :not_found, "User not found")
    end
  end

  @doc """
  Create a challenge for adding a new credential/passkey
  """
  def create_credential_challenge(conn, %{"id" => user_id}) do
    challenge = CastmillWeb.SessionUtils.new_challenge()

    conn
    |> put_session(:credential_challenge, challenge)
    |> put_session(:credential_user_id, user_id)
    |> json(%{challenge: challenge, user_id: user_id})
  end

  @doc """
  Add a new credential/passkey for the user
  """
  def add_credential(conn, %{
        "id" => user_id,
        "credential_id" => credential_id,
        "public_key_spki" => public_key_spki_base64,
        "client_data_json" => client_data_json
      }) do
    with {:ok, challenge} <- CastmillWeb.SessionUtils.check_client_data_json(client_data_json),
         true <- challenge == get_session(conn, :credential_challenge),
         true <- user_id == get_session(conn, :credential_user_id) do
      # Extract and parse User-Agent for device information
      user_agent = get_req_header(conn, "user-agent") |> List.first()

      device_info =
        Castmill.UserAgentParser.parse(user_agent)
        |> Map.put(:user_agent, user_agent)

      public_key_spki = Base.decode64!(public_key_spki_base64)

      case Accounts.add_user_credential(user_id, credential_id, public_key_spki, device_info) do
        {:ok, credential} ->
          conn
          |> delete_session(:credential_challenge)
          |> delete_session(:credential_user_id)
          |> put_status(:created)
          |> json(%{
            status: "ok",
            message: "Credential added successfully",
            credential: %{
              id: credential.id,
              name: credential.device_name || "New Passkey",
              inserted_at: credential.inserted_at
            }
          })

        {:error, _changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{status: "error", message: "Failed to add credential"})
      end
    else
      false ->
        conn
        |> delete_session(:credential_challenge)
        |> delete_session(:credential_user_id)
        |> put_status(:unauthorized)
        |> json(%{status: "error", message: "Invalid challenge or user ID"})

      {:error, message} ->
        conn
        |> put_status(:bad_request)
        |> json(%{status: "error", message: message})
    end
  end

  @doc """
  Send email verification for new email address
  """
  def send_email_verification(conn, %{"id" => user_id, "email" => new_email}) do
    with user when not is_nil(user) <- Accounts.get_user(user_id),
         {:ok, _} <- Accounts.send_email_verification(user, new_email) do
      json(conn, %{status: "ok", message: "Verification email sent"})
    else
      nil -> send_resp(conn, :not_found, "User not found")
      {:error, _} -> send_resp(conn, :unprocessable_entity, "Failed to send verification email")
    end
  end

  @doc """
  Verify email with token
  """
  def verify_email(conn, %{"token" => token, "email" => new_email}) do
    with {:ok, user} <- Accounts.verify_email_token(token, new_email) do
      json(conn, %{status: "ok", user: user})
    else
      {:error, :invalid_token} ->
        send_resp(conn, :unprocessable_entity, "Invalid or expired token")

      {:error, _} ->
        send_resp(conn, :unprocessable_entity, "Failed to verify email")
    end
  end
end
