defmodule Castmill.Quotas.QuotasNetworks do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key(false)

  schema "quotas_networks" do
    field :max, :integer

    field :resource, Ecto.Enum, values: [
      :organizations,
      :users
    ], primary_key: true

    belongs_to :network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID, primary_key: true

    timestamps()
  end

  @doc false
  def changeset(quotas_networks, attrs) do
    quotas_networks
    |> cast(attrs, [:max, :resource, :network_id])
    |> validate_required([:max, :resource, :network_id])
  end

  def base_query() do
    from quotas_networks in Castmill.Quotas.QuotasNetworks, as: :quotas_networks
  end
end
