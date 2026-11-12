defmodule Castmill.AdminPasskeysFixtures do
  @moduledoc false

  def authenticator_fixture do
    {<<4, x::binary-size(32), y::binary-size(32)>>, private} =
      :crypto.generate_key(:ecdh, :secp256r1)

    %{
      id: :crypto.strong_rand_bytes(32),
      private: private,
      cose_key: %{1 => 2, 3 => -7, -1 => 1, -2 => x, -3 => y}
    }
  end

  def rsa_authenticator_fixture do
    private = :public_key.generate_key({:rsa, 2048, 65537})
    {:RSAPublicKey, modulus, exponent} = X509.PublicKey.derive(private)

    %{
      id: :crypto.strong_rand_bytes(32),
      private: private,
      cose_key: %{
        1 => 3,
        3 => -257,
        -1 => :binary.encode_unsigned(modulus),
        -2 => :binary.encode_unsigned(exponent)
      }
    }
  end

  def registration_fixture(authenticator, options, overrides \\ %{}) do
    origin = Map.get(overrides, :origin, CastmillWeb.Endpoint.url())
    rp_id = Map.get(overrides, :rp_id, options["rp"]["id"])
    flags = Map.get(overrides, :flags, 0x45)

    cose =
      Map.new(authenticator.cose_key, fn
        {key, value} when is_binary(value) -> {key, bytes(value)}
        pair -> pair
      end)

    auth_data =
      :crypto.hash(:sha256, rp_id) <>
        <<flags, 0::32, 0::128, byte_size(authenticator.id)::16>> <>
        authenticator.id <> CBOR.encode(cose)

    attestation = %{"fmt" => "none", "attStmt" => %{}, "authData" => bytes(auth_data)}

    %{
      "name" => "Test passkey",
      "attestation_object" => encode(CBOR.encode(attestation)),
      "client_data" => client_data("webauthn.create", options["challenge"], origin, overrides)
    }
  end

  def assertion_fixture(authenticator, options, user_id, overrides \\ %{}) do
    origin = Map.get(overrides, :origin, CastmillWeb.Endpoint.url())
    rp_id = Map.get(overrides, :rp_id, options["rpId"])
    flags = Map.get(overrides, :flags, 0x05)
    count = Map.get(overrides, :sign_count, 0)
    auth_data = :crypto.hash(:sha256, rp_id) <> <<flags, count::32>>

    client_data =
      client_data("webauthn.get", options["challenge"], origin, overrides)

    message = auth_data <> :crypto.hash(:sha256, Base.url_decode64!(client_data, padding: false))

    signature =
      if is_binary(authenticator.private),
        do: :crypto.sign(:ecdsa, :sha256, message, [authenticator.private, :secp256r1]),
        else: :public_key.sign(message, :sha256, authenticator.private)

    %{
      "id" => encode(authenticator.id),
      "user_handle" => encode(user_id),
      "authenticator_data" => encode(auth_data),
      "client_data" => client_data,
      "signature" => encode(signature)
    }
  end

  defp client_data(type, challenge, origin, overrides) do
    %{
      "type" => Map.get(overrides, :type, type),
      "challenge" => challenge,
      "origin" => origin,
      "crossOrigin" => Map.get(overrides, :cross_origin, false)
    }
    |> Jason.encode!()
    |> encode()
  end

  defp bytes(value), do: %CBOR.Tag{tag: :bytes, value: value}
  defp encode(value), do: Base.url_encode64(value, padding: false)
end
