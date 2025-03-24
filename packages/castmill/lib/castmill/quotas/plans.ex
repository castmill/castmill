defmodule Castmill.Quotas.Plan do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @doc """
    A Plan is a set of predefined quotas that can be applied to an organization or network.
  """
  schema "plans" do
    field(:name, :string)

    belongs_to(:network, Castmill.Networks.Network,
      foreign_key: :network_id,
      type: Ecto.UUID
    )

    timestamps()
  end

  @doc false
  def changeset(plan, attrs) do
    plan
    |> cast(attrs, [:name])
    |> validate_required([:name])
  end

  def base_query() do
    from(plan in Castmill.Quotas.Plan, as: :plans)
  end
end
