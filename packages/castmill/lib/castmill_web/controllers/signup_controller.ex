defmodule CastmillWeb.SignUpController do
  use CastmillWeb, :controller
  require Logger

  alias Castmill.Accounts
  alias Castmill.Accounts.UserNotifier
  alias CastmillWeb.SessionUtils

  action_fallback(CastmillWeb.FallbackController)

  @doc """
    Create a challenge for signup (used for invitation flow - no email sent).
  """
  def create_challenge(conn, %{"email" => email, "invitation_token" => invitation_token}) do
    origin = List.first(Plug.Conn.get_req_header(conn, "origin"))

    if is_nil(origin) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{status: :error, msg: "Missing origin"})
    else
      case Accounts.get_network_id_by_domain(origin) do
        {:ok, network_id} ->
          # Validate invitation token for network invitations
          network = Castmill.Networks.get_network(network_id)
          
          valid_invitation = 
            case Castmill.Networks.get_network_invitation_by_token(invitation_token) do
              nil ->
                # Try organization invitation as fallback
                case Castmill.Organizations.get_invitation_by_token(invitation_token) do
                  nil -> false
                  org_invitation -> 
                    org_invitation.email == email && !Castmill.Organizations.OrganizationsInvitation.expired?(org_invitation)
                end
              
              net_invitation -> 
                net_invitation.email == email && !Castmill.Networks.NetworkInvitation.expired?(net_invitation)
            end
          
          # If network is invitation-only and no valid invitation, reject
          if network.invitation_only && !valid_invitation do
            conn
            |> put_status(:forbidden)
            |> json(%{status: :error, msg: "Valid invitation required for this network"})
          else
            challenge = SessionUtils.new_challenge()
            params = %{"email" => email, "challenge" => challenge, "network_id" => network_id}

            case Accounts.create_signup(params) do
              {:ok, signup} ->
                conn
                |> put_status(:created)
                |> json(%{signup_id: signup.id, challenge: challenge})

              {:error, _changeset} ->
                conn
                |> put_status(:unprocessable_entity)
                |> json(%{status: :error})
            end
          end

        {:error, :network_not_found} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{status: :error, msg: "Network not found"})
      end
    end
  end

  @doc """
    Create a new signup. The Signup starts the signup process for a new user.
  """
  def create(conn, %{"email" => nil}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{status: :error, msg: "Missing email"})
  end

  def create(conn, %{"email" => email}) do
    origin = List.first(Plug.Conn.get_req_header(conn, "origin"))

    if is_nil(origin) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{status: :error, msg: "Missing origin"})
    else
      case Accounts.get_network_id_by_domain(origin) do
        {:ok, network_id} ->
          # Check if network requires invitation-only signup
          network = Castmill.Networks.get_network(network_id)
          
          if network.invitation_only do
            conn
            |> put_status(:forbidden)
            |> json(%{status: :error, msg: "This network requires an invitation to sign up"})
          else
            challenge = SessionUtils.new_challenge()
            params = %{"email" => email, "challenge" => challenge, "network_id" => network_id}

            case Accounts.create_signup(params) do
              {:ok, signup} ->
                case UserNotifier.deliver_signup_instructions(signup, origin) do
                  {:ok, _email} ->
                    # Serialize the signup struct
                    signup_data = %{
                      id: signup.id,
                      email: signup.email,
                      inserted_at: signup.inserted_at,
                      updated_at: signup.updated_at,
                      challenge: signup.challenge,
                      status_message: signup.status_message
                    }

                    conn
                    |> put_status(:created)
                    |> json(%{status: :ok, signup: signup_data})

                  {:error, reason} ->
                    # Optionally, you might want to delete the signup if email delivery fails
                    # Accounts.delete_signup(signup)

                    conn
                    |> put_status(:unprocessable_entity)
                    |> json(%{status: :error, msg: "Failed to send email", error: inspect(reason)})
                end

              {:error, _changeset} ->
                conn
                |> put_status(:unprocessable_entity)
                |> json(%{status: :error})
            end
          end

        {:error, :network_not_found} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{status: :error, msg: "Network not found"})
      end
    end
  end

  @doc """
    Create a new user from a signup and passkey authentication.
    Optionally accepts invitation_token to skip default organization creation.
  """
  def create_user(conn, params) do
    %{
      "id" => signup_id,
      "email" => email,
      "credential_id" => credential_id,
      "public_key_spki" => public_key_spki
    } = params

    invitation_token = Map.get(params, "invitation_token")
    public_key_spki = Base.decode64!(public_key_spki)

    # Extract and parse User-Agent for device information
    user_agent = get_req_header(conn, "user-agent") |> List.first()

    device_info =
      Castmill.UserAgentParser.parse(user_agent)
      |> Map.put(:user_agent, user_agent)

    case Accounts.create_user_from_signup(
           signup_id,
           email,
           credential_id,
           public_key_spki,
           device_info,
           invitation_token
         ) do
      {:ok, %{id: user_id} = user} ->
        conn
        |> put_session(:user, user)
        |> SessionUtils.log_in_user(user_id)
        |> put_status(:created)
        |> json(%{status: :ok, user: user})

      {:error, message} when is_binary(message) ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          status: :error,
          message: message
        })

      {:error, _other} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          status: :error,
          message: "Something went wrong during signup. Please contact support."
        })
    end
  end
end
