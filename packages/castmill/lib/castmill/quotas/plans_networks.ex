defmodule Castmill.Quotas.PlansNetworks do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key(false)

  schema "plans_networks" do
    belongs_to :plan, Castmill.Quotas.Plan, type: :string, foreign_key: :plan_name
    belongs_to :network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID, primary_key: true
  end

  @doc false
  def changeset(plans_network, attrs) do
    plans_network
    |> cast(attrs, [:plan_name, :network_id])
    |> validate_required([:plan_name, :network_id])
    |> unique_constraint(:network_id)
  end

  def base_query() do
    from plans_network in Castmill.Quotas.QuotasNetworks, as: :plans_networks
  end
end
