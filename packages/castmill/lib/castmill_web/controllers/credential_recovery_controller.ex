defmodule CastmillWeb.CredentialRecoveryController do
  use CastmillWeb, :controller
  require Logger

  alias Castmill.Accounts

  action_fallback(CastmillWeb.FallbackController)

  @doc """
  Request credential recovery. Sends an email if the user exists, but doesn't reveal if the email exists or not.
  """
  def request_recovery(conn, %{"email" => email}) do
    # Always get the origin to build the recovery URL
    origin =
      List.first(Plug.Conn.get_req_header(conn, "origin")) || System.get_env("DASHBOARD_URL") ||
        "http://localhost:3000"

    # Try to get user, but don't reveal if it exists
    if user = Accounts.get_user_by_email(email) do
      # Build recovery URL function
      recover_url_fun = fn token ->
        "#{origin}/recover-credentials?token=#{token}&email=#{URI.encode_www_form(email)}"
      end

      # Send recovery email
      Accounts.deliver_user_recover_credentials_instructions(user, recover_url_fun)
    end

    # Always return the same response to prevent email enumeration
    conn
    |> put_status(:ok)
    |> json(%{
      status: :ok,
      message:
        "If your email is in our system, you will receive instructions to recover your credentials shortly."
    })
  end

  @doc """
  Verify the recovery token and return user information if valid
  """
  def verify_token(conn, %{"token" => token}) do
    case Accounts.get_user_by_recover_credentials_token(token) do
      nil ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{status: :error, message: "Invalid or expired token"})

      user ->
        conn
        |> put_status(:ok)
        |> json(%{
          status: :ok,
          user: %{
            id: user.id,
            email: user.email
          }
        })
    end
  end

  @doc """
  Create a challenge for adding a new credential during recovery
  """
  def create_recovery_challenge(conn, %{"token" => token}) do
    case Accounts.get_user_by_recover_credentials_token(token) do
      nil ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{status: :error, message: "Invalid or expired token"})

      user ->
        challenge = CastmillWeb.SessionUtils.new_challenge()

        conn
        |> put_session(:recovery_challenge, challenge)
        |> put_session(:recovery_token, token)
        |> put_session(:recovery_user_id, user.id)
        |> json(%{challenge: challenge, user_id: user.id, email: user.email})
    end
  end

  @doc """
  Add a new credential during recovery process
  """
  def add_recovery_credential(conn, %{
        "token" => token,
        "credential_id" => credential_id,
        "public_key_spki" => public_key_spki_base64,
        "client_data_json" => client_data_json
      }) do
    with {:ok, challenge} <- CastmillWeb.SessionUtils.check_client_data_json(client_data_json),
         true <- challenge == get_session(conn, :recovery_challenge),
         true <- token == get_session(conn, :recovery_token),
         user when not is_nil(user) <- Accounts.get_user_by_recover_credentials_token(token) do
      # Extract and parse User-Agent for device information
      user_agent = get_req_header(conn, "user-agent") |> List.first()

      device_info =
        Castmill.UserAgentParser.parse(user_agent)
        |> Map.put(:user_agent, user_agent)

      public_key_spki = Base.decode64!(public_key_spki_base64)

      case Accounts.add_user_credential(user.id, credential_id, public_key_spki, device_info) do
        {:ok, credential} ->
          # Log the user in after successful recovery
          conn
          |> delete_session(:recovery_challenge)
          |> delete_session(:recovery_token)
          |> delete_session(:recovery_user_id)
          |> put_session(:user, user)
          |> CastmillWeb.SessionUtils.log_in_user(user.id)
          |> put_status(:created)
          |> json(%{
            status: "ok",
            message: "Credential added successfully. You are now logged in.",
            credential: %{
              id: credential.id,
              name: credential.device_name || "Recovered Passkey",
              inserted_at: credential.inserted_at
            }
          })

        {:error, _changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{status: "error", message: "Failed to add credential"})
      end
    else
      nil ->
        conn
        |> delete_session(:recovery_challenge)
        |> delete_session(:recovery_token)
        |> delete_session(:recovery_user_id)
        |> put_status(:unprocessable_entity)
        |> json(%{status: "error", message: "Invalid or expired token"})

      false ->
        conn
        |> delete_session(:recovery_challenge)
        |> delete_session(:recovery_token)
        |> delete_session(:recovery_user_id)
        |> put_status(:unauthorized)
        |> json(%{status: "error", message: "Invalid challenge or token"})

      {:error, message} ->
        conn
        |> put_status(:bad_request)
        |> json(%{status: "error", message: message})
    end
  end
end
