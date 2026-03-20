defmodule CastmillWeb.SessionController do
  use CastmillWeb, :controller

  alias CastmillWeb.SessionUtils
  alias Castmill.Accounts

  # Max age for challenge tokens — derived from the ChallengeStore TTL
  # so both the signed token and the stored challenge share the same window.
  @challenge_token_max_age CastmillWeb.ChallengeStore.challenge_ttl_seconds()
  @challenge_token_salt "CastmillWeb.SessionController.challenge.v1"

  @doc """
    Creates a new challenge for WebAuthn authentication.
    Returns both the raw challenge and a signed challenge_token that the
    client must send back with the login request. This avoids relying on
    session cookies, which are blocked in cross-origin scenarios (e.g.
    custom-domain dashboards calling api.castmill.dev).
  """
  def create_challenge(conn, _params) do
    challenge = SessionUtils.new_challenge()

    # Store for single-use enforcement (consumed on successful login)
    CastmillWeb.ChallengeStore.put(challenge)

    challenge_token =
      Phoenix.Token.sign(CastmillWeb.Endpoint, @challenge_token_salt, challenge)

    conn
    |> put_session(:webauthn_challenge, challenge)
    |> json(%{challenge: challenge, challenge_token: challenge_token})
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
        token =
          Phoenix.Token.sign(
            CastmillWeb.Endpoint,
            CastmillWeb.Secrets.get_dashboard_user_token_salt(),
            user.id
          )

        conn
        |> put_status(:ok)
        |> json(%{status: :ok, user: user, token: token})
    end
  end

  @doc """
    Creates a new session for a user that wants to login into the system.
  """
  def login_user(
        conn,
        %{
          "authenticator_data" => authenticator_data_b64,
          "signature" => signature_b64,
          "credential_id" => credential_id,
          "client_data_json" => client_data_json_str
        } = params
      ) do
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
         # Verify the challenge matches what we generated.
         # Prefer the signed challenge_token (cookie-less, works cross-origin);
         # fall back to session for same-origin clients.
         true <- verify_challenge(conn, params, challenge),
         # Check the user presence bit is set.
         # outcommented as I am not sure what this is used for...
         # true <- (:binary.at(authenticator_data, 32) &&& 1) == 1,
         # Make sure the signed RP ID matches the origin from client_data_json.
         # The browser sets the RP ID to window.location.hostname and hashes it
         # into the first 32 bytes of authenticator_data. We derive the expected
         # RP ID from the already-validated origin in client_data_json.
         rp_id when is_binary(rp_id) <- URI.parse(client_data_json["origin"]).host,
         true <- :binary.part(authenticator_data, 0, 32) == :crypto.hash(:sha256, rp_id),
         # Log in the user (returns {:error, reason} if blocked)
         conn when is_map(conn) <-
           SessionUtils.log_in_user(
             conn |> delete_session(:webauthn_challenge),
             credential.user_id
           ) do
      # Return user data and WebSocket token directly so the frontend
      # doesn't need a follow-up GET /sessions/ that depends on cookies
      # (which are blocked cross-origin due to SameSite=Lax).
      user = get_session(conn, :user)

      token =
        Phoenix.Token.sign(
          CastmillWeb.Endpoint,
          CastmillWeb.Secrets.get_dashboard_user_token_salt(),
          user.id
        )

      conn
      |> json(%{status: :ok, user: user, token: token})
    else
      {:error, {:user_blocked, reason}} ->
        conn
        |> put_status(:forbidden)
        |> json(%{status: :error, message: reason, code: "user_blocked"})

      {:error, {:organization_blocked, reason}} ->
        conn
        |> put_status(:forbidden)
        |> json(%{status: :error, message: reason, code: "organization_blocked"})

      _ ->
        conn
        |> put_status(:unauthorized)
        |> json(%{status: :error, message: "Invalid login attempt"})
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

  # Verify the challenge from the login request.
  # First tries the signed challenge_token (cookie-less, works cross-origin).
  # Falls back to the session-based challenge for backwards compatibility.
  # In both paths the challenge is consumed from the store so it cannot
  # be replayed.
  defp verify_challenge(_conn, %{"challenge_token" => challenge_token}, challenge)
       when is_binary(challenge_token) do
    case Phoenix.Token.verify(CastmillWeb.Endpoint, @challenge_token_salt, challenge_token,
           max_age: @challenge_token_max_age
         ) do
      {:ok, expected_challenge} ->
        Plug.Crypto.secure_compare(challenge, expected_challenge) &&
          CastmillWeb.ChallengeStore.consume(challenge)

      {:error, _reason} ->
        false
    end
  end

  defp verify_challenge(conn, _params, challenge) do
    # Fallback: session-based challenge (same-origin only)
    case get_session(conn, :webauthn_challenge) do
      nil ->
        false

      session_challenge ->
        Plug.Crypto.secure_compare(challenge, session_challenge) &&
          CastmillWeb.ChallengeStore.consume(challenge)
    end
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
