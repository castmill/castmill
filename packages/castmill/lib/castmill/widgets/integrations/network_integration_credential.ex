defmodule Castmill.Widgets.Integrations.NetworkIntegrationCredential do
  @moduledoc """
  Schema for network-level widget integration credentials.

  Stores encrypted Client ID/Secret, API keys that are shared across
  all organizations within a network. These are typically configured
  by the network administrator in the LiveView Admin UI.

  ## Credential Types

  - OAuth2 client credentials (client_id, client_secret)
  - API keys for services like Google Maps, Weather APIs
  - Any other network-wide integration secrets

  ## Security

  Credentials are encrypted using `Castmill.Encryption` with:
  - Master key from environment (not stored in DB)
  - Per-network derived keys
  - Version byte for key rotation support
  """
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias Castmill.Networks.Network
  alias Castmill.Widgets.Integrations.WidgetIntegration
  alias Castmill.Encryption

  @primary_key {:id, :id, autogenerate: true}

  schema "network_integration_credentials" do
    belongs_to(:network, Network, type: :binary_id)
    belongs_to(:widget_integration, WidgetIntegration, foreign_key: :integration_id)

    # Encrypted credentials (binary data)
    field(:encrypted_credentials, :binary)

    # Admin can disable even if configured
    field(:is_enabled, :boolean, default: true)

    timestamps()
  end

  @doc false
  def changeset(credential, attrs) do
    credential
    |> cast(attrs, [:network_id, :integration_id, :encrypted_credentials, :is_enabled])
    |> validate_required([:network_id, :integration_id, :encrypted_credentials])
    |> unique_constraint([:network_id, :integration_id])
    |> foreign_key_constraint(:network_id)
    |> foreign_key_constraint(:integration_id)
  end

  @doc """
  Creates a changeset with encrypted credentials.

  ## Parameters

    - credential: The credential struct or changeset
    - attrs: Attributes including :network_id, :integration_id
    - credentials_map: Plain map of credentials to encrypt (e.g., %{"client_id" => "...", "client_secret" => "..."})

  ## Returns

    Changeset with encrypted credentials
  """
  def changeset_with_encryption(credential, attrs, credentials_map) when is_map(credentials_map) do
    network_id = attrs[:network_id] || attrs["network_id"] || credential.network_id

    case Encryption.encrypt_for_resource(credentials_map, :network, network_id) do
      {:ok, encrypted} ->
        attrs_with_encrypted = Map.put(attrs, :encrypted_credentials, encrypted)
        changeset(credential, attrs_with_encrypted)

      {:error, reason} ->
        credential
        |> changeset(attrs)
        |> add_error(:encrypted_credentials, "encryption failed: #{reason}")
    end
  end

  @doc """
  Decrypts the credentials for this record.

  ## Returns

    - `{:ok, credentials_map}` - Decrypted credentials
    - `{:error, reason}` - If decryption fails
  """
  def decrypt_credentials(%__MODULE__{} = credential) do
    Encryption.decrypt(credential.encrypted_credentials, :network, credential.network_id)
  end

  @doc """
  Query for getting credentials by network and integration.
  """
  def by_network_and_integration(network_id, integration_id) do
    from(c in __MODULE__,
      where: c.network_id == ^network_id and c.integration_id == ^integration_id
    )
  end

  @doc """
  Query for getting all enabled credentials for a network.
  """
  def enabled_for_network(network_id) do
    from(c in __MODULE__,
      where: c.network_id == ^network_id and c.is_enabled == true,
      preload: [:widget_integration]
    )
  end

  @doc """
  Query for getting all networks that have configured a specific integration.
  """
  def networks_with_integration(integration_id) do
    from(c in __MODULE__,
      where: c.integration_id == ^integration_id and c.is_enabled == true,
      select: c.network_id
    )
  end
end
