defmodule Castmill.Encryption do
  @moduledoc """
  Versioned encryption module with key derivation from master secret.

  This module provides secure encryption for sensitive data (like OAuth credentials)
  using a master key stored in environment variables, NOT in the database.

  ## Security Model

  - Master key(s) stored in environment variables (never in DB)
  - Per-resource keys derived using HMAC-SHA256
  - Version byte embedded in ciphertext for future key rotation
  - AES-256-GCM for authenticated encryption

  ## Key Derivation

  Each resource (network, organization, widget) gets a unique encryption key derived from:
  1. The master key (from environment)
  2. The resource type and ID

  This means:
  - Database breach doesn't expose the master key
  - Each resource has a unique derived key
  - Compromising one resource's key doesn't affect others

  ## Key Rotation

  When rotating keys:
  1. Add new master key to environment (e.g., ENCRYPTION_MASTER_KEY_V2)
  2. Update current_version in config
  3. Deploy - new encryptions use new key, old data still readable
  4. Run background re-encryption job
  5. Remove old key after all data migrated

  ## Usage

      # Encrypt credentials for a network
      {:ok, encrypted} = Encryption.encrypt_for_resource(
        %{"client_id" => "xxx", "client_secret" => "yyy"},
        :network,
        network_id
      )

      # Decrypt
      {:ok, credentials} = Encryption.decrypt(encrypted, :network, network_id)
  """

  require Logger

  @aad "Castmill.Encryption.V1"

  @type resource_type :: :network | :organization | :widget
  @type encryption_result :: {:ok, binary()} | {:error, atom()}
  @type decryption_result :: {:ok, map()} | {:error, atom()}

  @doc """
  Encrypts data for a specific resource using derived key.

  The ciphertext format is:
  - Version byte (1 byte) - for future key rotation
  - IV (12 bytes) - random initialization vector
  - Tag (16 bytes) - authentication tag
  - Ciphertext (variable) - encrypted JSON data

  ## Parameters

    - data: Map to encrypt (will be JSON-encoded)
    - resource_type: :network, :organization, or :widget
    - resource_id: The UUID or integer ID of the resource

  ## Returns

    - `{:ok, binary}` - Encrypted data with version prefix
    - `{:error, reason}` - If encryption fails

  ## Examples

      iex> Encryption.encrypt_for_resource(%{"key" => "value"}, :network, "uuid-here")
      {:ok, <<1, ...>>}
  """
  @spec encrypt_for_resource(map(), resource_type(), String.t() | integer()) ::
          encryption_result()
  def encrypt_for_resource(data, resource_type, resource_id) when is_map(data) do
    with {:ok, version} <- get_current_version(),
         {:ok, key} <- derive_key(version, resource_type, resource_id) do
      encrypt_with_version(data, key, version)
    end
  end

  @doc """
  Decrypts data that was encrypted with encrypt_for_resource/3.

  Automatically detects the key version from the ciphertext and uses
  the appropriate master key for decryption.

  ## Parameters

    - encrypted: Binary from encrypt_for_resource/3
    - resource_type: :network, :organization, or :widget
    - resource_id: The UUID or integer ID of the resource

  ## Returns

    - `{:ok, map}` - Decrypted data
    - `{:error, reason}` - If decryption fails

  ## Examples

      iex> {:ok, encrypted} = Encryption.encrypt_for_resource(%{"key" => "value"}, :network, id)
      iex> Encryption.decrypt(encrypted, :network, id)
      {:ok, %{"key" => "value"}}
  """
  @spec decrypt(binary(), resource_type(), String.t() | integer()) :: decryption_result()
  def decrypt(
        <<version::8, iv::binary-12, tag::binary-16, ciphertext::binary>>,
        resource_type,
        resource_id
      ) do
    with {:ok, key} <- derive_key(version, resource_type, resource_id) do
      decrypt_aead(ciphertext, key, iv, tag)
    end
  end

  def decrypt(_encrypted, _resource_type, _resource_id) do
    {:error, :invalid_format}
  end

  @doc """
  Re-encrypts data from an old key version to the current version.

  Used during key rotation to migrate data to the new key.

  ## Parameters

    - encrypted: Binary encrypted with old key
    - resource_type: :network, :organization, or :widget
    - resource_id: The UUID or integer ID of the resource

  ## Returns

    - `{:ok, binary}` - Re-encrypted with current key version
    - `{:error, reason}` - If re-encryption fails
    - `{:ok, :already_current}` - If already on current version
  """
  @spec re_encrypt(binary(), resource_type(), String.t() | integer()) ::
          {:ok, binary()} | {:ok, :already_current} | {:error, atom()}
  def re_encrypt(<<version::8, _rest::binary>> = encrypted, resource_type, resource_id) do
    with {:ok, current_version} <- get_current_version() do
      if version == current_version do
        {:ok, :already_current}
      else
        with {:ok, data} <- decrypt(encrypted, resource_type, resource_id),
             {:ok, new_encrypted} <- encrypt_for_resource(data, resource_type, resource_id) do
          {:ok, new_encrypted}
        end
      end
    end
  end

  def re_encrypt(_encrypted, _resource_type, _resource_id) do
    {:error, :invalid_format}
  end

  @doc """
  Gets the key version from encrypted data without decrypting.

  Useful for checking if data needs re-encryption.
  """
  @spec get_version(binary()) :: {:ok, integer()} | {:error, :invalid_format}
  def get_version(<<version::8, _rest::binary>>), do: {:ok, version}
  def get_version(_), do: {:error, :invalid_format}

  @doc """
  Checks if encrypted data is using the current key version.
  """
  @spec is_current_version?(binary()) :: boolean()
  def is_current_version?(<<version::8, _rest::binary>>) do
    case get_current_version() do
      {:ok, current} -> version == current
      _ -> false
    end
  end

  def is_current_version?(_), do: false

  @doc """
  Returns the current encryption key version.
  """
  @spec get_current_version() :: {:ok, integer()} | {:error, :not_configured}
  def get_current_version do
    case get_encryption_config() do
      {:ok, config} -> {:ok, config.current_version}
      error -> error
    end
  end

  @doc """
  Lists all available key versions.
  """
  @spec available_versions() :: {:ok, [integer()]} | {:error, :not_configured}
  def available_versions do
    case get_encryption_config() do
      {:ok, config} -> {:ok, Map.keys(config.keys)}
      error -> error
    end
  end

  # Private functions

  defp encrypt_with_version(data, key, version) do
    try do
      iv = :crypto.strong_rand_bytes(12)
      json = Jason.encode!(data)

      {ciphertext, tag} =
        :crypto.crypto_one_time_aead(
          :aes_256_gcm,
          key,
          iv,
          json,
          @aad,
          true
        )

      # Version byte + IV + Tag + Ciphertext
      {:ok, <<version::8, iv::binary, tag::binary, ciphertext::binary>>}
    rescue
      e ->
        Logger.error("Encryption failed: #{inspect(e)}")
        {:error, :encryption_failed}
    end
  end

  defp decrypt_aead(ciphertext, key, iv, tag) do
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
    _ -> {:error, :decryption_failed}
  end

  defp derive_key(version, resource_type, resource_id) do
    with {:ok, master_key} <- get_master_key(version) do
      # Derive a unique key for this resource using HMAC-SHA256
      context = "#{resource_type}:#{resource_id}"
      derived = :crypto.mac(:hmac, :sha256, master_key, context)
      {:ok, derived}
    end
  end

  defp get_master_key(version) do
    case get_encryption_config() do
      {:ok, config} ->
        case Map.get(config.keys, version) do
          nil -> {:error, :unknown_key_version}
          key -> {:ok, key}
        end

      error ->
        error
    end
  end

  defp get_encryption_config do
    # Try to get from application config first (for runtime config)
    case Application.get_env(:castmill, :encryption) do
      nil ->
        # Fall back to building config from environment variables
        build_config_from_env()

      config when is_map(config) ->
        {:ok, config}
    end
  end

  defp build_config_from_env do
    # Check for versioned keys (V1, V2, etc.) or single key
    keys =
      1..10
      |> Enum.reduce(%{}, fn version, acc ->
        env_var =
          if version == 1,
            do: "ENCRYPTION_MASTER_KEY",
            else: "ENCRYPTION_MASTER_KEY_V#{version}"

        case get_key_from_env(env_var) do
          {:ok, key} -> Map.put(acc, version, key)
          :not_set -> acc
        end
      end)

    if map_size(keys) == 0 do
      # In dev/test, generate a deterministic key for convenience
      if Application.get_env(:castmill, :env) in [:dev, :test] do
        Logger.warning("No ENCRYPTION_MASTER_KEY set, using development fallback key")
        dev_key = :crypto.hash(:sha256, "castmill-dev-encryption-key-not-for-production")
        {:ok, %{keys: %{1 => dev_key}, current_version: 1}}
      else
        {:error, :not_configured}
      end
    else
      # Current version is the highest available
      current_version =
        case System.get_env("ENCRYPTION_CURRENT_VERSION") do
          nil -> Enum.max(Map.keys(keys))
          v -> String.to_integer(v)
        end

      {:ok, %{keys: keys, current_version: current_version}}
    end
  end

  defp get_key_from_env(env_var) do
    case System.get_env(env_var) do
      nil ->
        :not_set

      "" ->
        :not_set

      value ->
        # Key can be raw 32 bytes or Base64 encoded
        case Base.decode64(value) do
          {:ok, key} when byte_size(key) == 32 -> {:ok, key}
          # Hash if wrong size
          {:ok, _} -> {:ok, :crypto.hash(:sha256, value)}
          # Hash if not base64
          :error -> {:ok, :crypto.hash(:sha256, value)}
        end
    end
  end
end
