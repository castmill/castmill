defmodule Castmill.Quotas.PlansQuotas do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "plans_quotas" do
    field :max, :integer

    field :resource, Ecto.Enum,
      values: [
        :organizations,
        :medias,
        :playlists,
        :channels,
        :channels_entries,
        :devices,
        :users,
        :teams
      ],
      primary_key: true

    belongs_to :plan, Castmill.Quotas.Plan, primary_key: true
  end

  @doc false
  def changeset(quotas_networks, attrs) do
    quotas_networks
    |> cast(attrs, [:max, :resource, :network_id])
    |> validate_required([:max, :resource, :network_id])
  end

  def base_query() do
    from plans_quotas in Castmill.Quotas.PlansQuotas, as: :plans_quotas
  end
end
