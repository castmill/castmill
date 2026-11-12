defmodule CastmillWeb.AdminPasskeyController do
  use CastmillWeb, :controller

  alias Castmill.Accounts
  alias Castmill.Accounts.AdminPasskeys
  alias CastmillWeb.{Admin.UserAuth, ChallengeStore}

  plug :rate_limit

  def login_options(conn, _params) do
    challenge = challenge(:authentication)

    issue(conn, challenge, :login, nil, false, %{
      challenge: encode(challenge.bytes),
      rpId: challenge.rp_id,
      userVerification: "required",
      timeout: 60_000
    })
  end

  def login(conn, params) do
    with {:ok, challenge, _} <- consume(conn, :login),
         {:ok, id} <- decode(params["id"]),
         key when not is_nil(key) <- AdminPasskeys.get(encode(id)),
         {:ok, handle} <- decode(params["user_handle"]),
         true <- handle == AdminPasskeys.user_handle(key.user_id),
         {:ok, client_data} <- client_data(params["client_data"]),
         {:ok, auth_data} <- decode(params["authenticator_data"]),
         {:ok, signature} <- decode(params["signature"]),
         {:ok, verified} <-
           Wax.authenticate(
             id,
             auth_data,
             signature,
             client_data,
             challenge,
             [{id, :erlang.binary_to_term(key.public_key, [:safe])}]
           ),
         {:ok, {_user, token}} <- AdminPasskeys.authenticate(key, verified) do
      return_to = get_session(conn, :user_return_to) || ~p"/admin"

      conn
      |> UserAuth.start_session(token, params)
      |> json(%{redirect: return_to})
    else
      _ -> failure(conn, :unauthorized, "Unable to verify admin passkey. Please try again.")
    end
  end

  def registration_options(conn, _params) do
    with {:ok, user, bootstrap?, _auth_token} <- enrollment_user(conn) do
      challenge = challenge(:attestation)

      issue(conn, challenge, :register, user.id, bootstrap?, %{
        challenge: encode(challenge.bytes),
        rp: %{id: challenge.rp_id, name: "Castmill Admin"},
        user: %{
          id: encode(AdminPasskeys.user_handle(user.id)),
          name: user.email,
          displayName: user.name
        },
        pubKeyCredParams: [%{type: "public-key", alg: -7}, %{type: "public-key", alg: -257}],
        authenticatorSelection: %{residentKey: "required", userVerification: "required"},
        attestation: "none",
        excludeCredentials:
          Enum.map(AdminPasskeys.list(user.id), &%{type: "public-key", id: &1.id}),
        timeout: 60_000
      })
    else
      _ -> failure(conn, :unauthorized, "Sign in again before registering an admin passkey.")
    end
  end

  def register(conn, params) do
    with {:ok, challenge, pending} <- consume(conn, :register),
         {:ok, user, bootstrap?, auth_token} <- enrollment_user(conn),
         true <- pending.user_id == user.id && pending.bootstrap? == bootstrap?,
         {:ok, attestation} <- decode(params["attestation_object"]),
         {:ok, %{"fmt" => "none", "attStmt" => stmt, "authData" => bytes}, ""} <-
           Wax.Utils.CBOR.decode(attestation),
         true <- stmt == %{} && is_binary(bytes),
         {:ok, client_data} <- client_data(params["client_data"]),
         {:ok, {auth_data, _}} <- Wax.register(attestation, client_data, challenge),
         %Wax.AttestedCredentialData{credential_id: id} = attested <-
           auth_data.attested_credential_data,
         true <- byte_size(id) in 1..1023,
         true <- supported_key?(attested),
         {:ok, {_key, token}} <-
           AdminPasskeys.register(user.id, auth_data, params["name"], bootstrap?, auth_token) do
      conn
      |> UserAuth.start_session(token)
      |> json(%{redirect: ~p"/admin/passkeys"})
    else
      _ ->
        failure(conn, :unprocessable_entity, "Unable to register passkey. Sign in and try again.")
    end
  end

  def delete(conn, %{"id" => id}) do
    with user when not is_nil(user) <- conn.assigns[:current_user],
         {:ok, _key} <-
           AdminPasskeys.delete(user.id, id, get_session(conn, :admin_user_token)) do
      # Removing a key revokes every admin session; require a fresh assertion.
      conn |> UserAuth.log_out_user()
    else
      {:error, :last_passkey} ->
        conn
        |> put_flash(:error, "Add another passkey before removing your last one.")
        |> redirect(to: ~p"/admin/passkeys")

      _ ->
        conn
        |> put_flash(:error, "Unable to remove passkey.")
        |> redirect(to: ~p"/admin/passkeys")
    end
  end

  defp enrollment_user(conn) do
    case conn.assigns[:current_user] do
      nil ->
        token = get_session(conn, :admin_enrollment_token)
        user = token && Accounts.get_user_by_admin_enrollment_token(token)

        if is_binary(token) && user && !AdminPasskeys.enrolled?(user.id),
          do: {:ok, user, true, token},
          else: {:error, :unauthorized}

      user ->
        case get_session(conn, :admin_user_token) do
          token when is_binary(token) -> {:ok, user, false, token}
          _ -> {:error, :unauthorized}
        end
    end
  end

  defp challenge(type) do
    origin = CastmillWeb.Endpoint.url()

    opts = [
      origin: origin,
      rp_id: URI.parse(origin).host,
      user_verification: "required",
      timeout: 300
    ]

    challenge =
      case type do
        :authentication -> Wax.new_authentication_challenge(opts)
        :attestation -> Wax.new_registration_challenge(opts)
      end

    # Admin policy must not be weakened by dashboard/global Wax settings.
    %{
      challenge
      | origin: origin,
        rp_id: URI.parse(origin).host,
        user_verification: "required",
        silent_authentication_enabled: false,
        timeout: 300
    }
  end

  defp issue(conn, challenge, purpose, user_id, bootstrap?, options) do
    ChallengeStore.put(encode(challenge.bytes))

    conn
    |> put_session(:admin_webauthn, %{
      challenge: challenge,
      purpose: purpose,
      user_id: user_id,
      bootstrap?: bootstrap?
    })
    |> put_resp_header("cache-control", "no-store")
    |> json(options)
  end

  defp consume(conn, purpose) do
    case get_session(conn, :admin_webauthn) do
      %{purpose: ^purpose, challenge: challenge} = pending ->
        if ChallengeStore.consume(encode(challenge.bytes)),
          do: {:ok, challenge, pending},
          else: {:error, :expired}

      _ ->
        {:error, :missing_challenge}
    end
  end

  defp decode(value) when is_binary(value) and byte_size(value) <= 32_768,
    do: Base.url_decode64(value, padding: false)

  defp decode(_), do: :error
  defp encode(value), do: Base.url_encode64(value, padding: false)

  defp client_data(value) do
    with {:ok, bytes} <- decode(value),
         {:ok, %{"type" => type, "challenge" => encoded, "origin" => origin} = data} <-
           Jason.decode(bytes),
         true <- type in ["webauthn.get", "webauthn.create"] && is_binary(origin),
         {:ok, _challenge} <- decode(encoded),
         false <- Map.get(data, "crossOrigin", false) do
      {:ok, bytes}
    else
      _ -> {:error, :invalid_client_data}
    end
  end

  defp supported_key?(%{credential_public_key: %{1 => 2, 3 => -7, -1 => 1, -2 => x, -3 => y}})
       when is_binary(x) and byte_size(x) == 32 and is_binary(y) and byte_size(y) == 32,
       do: true

  defp supported_key?(%{credential_public_key: %{1 => 3, 3 => -257, -1 => n, -2 => e}})
       when is_binary(n) and byte_size(n) in 256..512 and is_binary(e) and byte_size(e) in 1..4 do
    exponent = :binary.decode_unsigned(e)
    exponent >= 3 && rem(exponent, 2) == 1
  end

  defp supported_key?(_), do: false

  defp failure(conn, status, message) do
    conn
    |> delete_session(:admin_webauthn)
    |> put_status(status)
    |> json(%{error: message})
  end

  defp rate_limit(conn, _opts) do
    case Castmill.RateLimiter.allow({:admin_passkey, Utils.RemoteIp.client_ip(conn)}, 30) do
      :ok ->
        conn

      {:error, :rate_limited} ->
        conn |> failure(:too_many_requests, "Too many attempts. Try again in a minute.") |> halt()
    end
  end
end
