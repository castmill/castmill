defmodule Castmill.Crypto do
  @moduledoc """
  Encryption and decryption utilities for sensitive data.

  Uses AES-256-GCM for authenticated encryption of credentials and other
  sensitive information. Each organization has its own encryption key.
  """

  @aad "Castmill.WidgetIntegration"

  @doc """
  Encrypts data using AES-256-GCM.

  ## Parameters

    - data: The data to encrypt (will be JSON-encoded)
    - key: 32-byte encryption key (256 bits)

  ## Returns

    Binary containing: IV (12 bytes) + Tag (16 bytes) + Ciphertext

  ## Examples

      iex> key = :crypto.strong_rand_bytes(32)
      iex> encrypted = Castmill.Crypto.encrypt(%{"api_key" => "secret"}, key)
      iex> is_binary(encrypted)
      true
  """
  def encrypt(data, key) when byte_size(key) == 32 do
    # Generate random initialization vector
    iv = :crypto.strong_rand_bytes(12)

    # JSON-encode the data
    json = Jason.encode!(data)

    # Encrypt using AES-256-GCM
    {ciphertext, tag} = :crypto.crypto_one_time_aead(:aes_256_gcm, key, iv, json, @aad, true)

    # Return: IV + Tag + Ciphertext
    iv <> tag <> ciphertext
  end

  def encrypt(_data, _key) do
    raise ArgumentError, "Encryption key must be exactly 32 bytes (256 bits)"
  end

  @doc """
  Decrypts data encrypted with encrypt/2.

  ## Parameters

    - encrypted: Binary from encrypt/2 (IV + Tag + Ciphertext)
    - key: 32-byte encryption key (same as used for encryption)

  ## Returns

    {:ok, decrypted_data} or {:error, reason}

  ## Examples

      iex> key = :crypto.strong_rand_bytes(32)
      iex> data = %{"api_key" => "secret"}
      iex> encrypted = Castmill.Crypto.encrypt(data, key)
      iex> {:ok, decrypted} = Castmill.Crypto.decrypt(encrypted, key)
      iex> decrypted == data
      true
  """
  def decrypt(encrypted, key) when byte_size(key) == 32 do
    # Extract IV (12 bytes), Tag (16 bytes), and Ciphertext
    <<iv::binary-12, tag::binary-16, ciphertext::binary>> = encrypted

    # Decrypt using AES-256-GCM
    case :crypto.crypto_one_time_aead(:aes_256_gcm, key, iv, ciphertext, @aad, tag, false) do
      json when is_binary(json) ->
        case Jason.decode(json) do
          {:ok, data} -> {:ok, data}
          {:error, _} -> {:error, :invalid_json}
        end

      :error ->
        {:error, :decryption_failed}
    end
  rescue
    _ -> {:error, :invalid_format}
  end

  def decrypt(_encrypted, _key) do
    {:error, :invalid_key_size}
  end

  @doc """
  Generates a new random encryption key.

  ## Examples

      iex> key = Castmill.Crypto.generate_key()
      iex> byte_size(key)
      32
  """
  def generate_key do
    :crypto.strong_rand_bytes(32)
  end

  @doc """
  Encodes a binary key to Base64 for storage.

  ## Examples

      iex> key = Castmill.Crypto.generate_key()
      iex> encoded = Castmill.Crypto.encode_key(key)
      iex> is_binary(encoded)
      true
  """
  def encode_key(key) when is_binary(key) do
    Base.encode64(key)
  end

  @doc """
  Decodes a Base64-encoded key.

  ## Examples

      iex> key = Castmill.Crypto.generate_key()
      iex> encoded = Castmill.Crypto.encode_key(key)
      iex> {:ok, decoded} = Castmill.Crypto.decode_key(encoded)
      iex> decoded == key
      true
  """
  def decode_key(encoded) when is_binary(encoded) do
    case Base.decode64(encoded) do
      {:ok, key} when byte_size(key) == 32 -> {:ok, key}
      {:ok, _} -> {:error, :invalid_key_size}
      :error -> {:error, :invalid_encoding}
    end
  end
end
