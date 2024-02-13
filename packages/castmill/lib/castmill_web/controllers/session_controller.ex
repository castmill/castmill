defmodule CastmillWeb.SessionController do
  use CastmillWeb, :controller

  alias CastmillWeb.SessionUtils
  alias Castmill.Accounts

  @doc """
    Creates a new challenge and stores in the current cookie based session.
    This challenge will be used to verify the user when he/she tries to log-in.
  """
  def create_challenge(conn, _params) do
    challenge = SessionUtils.new_challenge()

    conn
    |> put_session(:webauthn_challenge, challenge)
    |> json(%{challenge: challenge})
  end

  @doc """
    Get the current session if the user is already logged in.
  """
  def get(conn, _params) do
    user = get_session(conn, :user)

    case user do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> json(%{status: :error, message: "Not logged in"})

      _ ->
        conn
        |> put_status(:ok)
        |> json(%{status: :ok, user: user})
    end
  end

  @doc """
    Creates a new session for a user that wants to login into the system.
  """
  def login_user(conn, %{
        "authenticator_data" => authenticator_data_b64,
        "signature" => signature_b64,
        "credential_id" => credential_id,
        "client_data_json" => client_data_json_str
      }) do
    authenticator_data = authenticator_data_b64 |> Base.decode64!()
    signature = signature_b64 |> Base.decode64!()

    with credential when not is_nil(credential) <- Accounts.get_credential(credential_id),
         # Verify that the authenticator data and client data JSON are signed with the user's key.
         true <-
           verify_signature(credential, client_data_json_str, authenticator_data, signature),
         # Decode the client data JSON.
         {:ok, client_data_json} <- Jason.decode(client_data_json_str),
         # Make sure the values in the client data JSON are what we expect, and extract the challenge.
         {:ok, challenge} <- SessionUtils.check_client_data_json(client_data_json),
         # Make sure the challenge singed by the user's key is what we generated.
         true <- challenge == get_session(conn, :webauthn_challenge),
         # Check the user presence bit is set.
         # outcommented as I am not sure what this is used for...
         # true <- (:binary.at(authenticator_data, 32) &&& 1) == 1,
         # Make sure the signed origin matches what we expect.
         true <- :binary.part(authenticator_data, 0, 32) == :crypto.hash(:sha256, "localhost") do
      conn
      |> delete_session(:webauthn_challenge)
      |> SessionUtils.log_in_user(credential.user_id)
      |> json(%{status: :ok})
    else
      _ ->
        conn
        |> put_status(:unauthorized)
        |> json(%{status: :ok, message: "Invalid login attempt"})
    end
  end

  def logout_user(conn, _params) do
    conn
    |> delete_session(:user)
    |> delete_session(:user_session_token)
    |> delete_session(:webauthn_challenge)
    |> delete_session(:remember_me_token)
    |> put_status(:ok)
    |> json(%{status: :ok})
  end

  defp verify_signature(credential, client_data_json_str, authenticator_data, signature) do
    with {:ok, pubkey} <- X509.PublicKey.from_der(credential.public_key_spki),
         client_data_json_hash <- :crypto.hash(:sha256, client_data_json_str),
         signed_message <- authenticator_data <> client_data_json_hash,
         true <- :public_key.verify(signed_message, :sha256, signature, pubkey) do
      true
    else
      _ ->
        false
    end
  end
end
