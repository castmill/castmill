defmodule Castmill.Quotas.PlansOrganizations do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "plans_organizations" do
    belongs_to :plan, Castmill.Quotas.Plan

    belongs_to :organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID,
      primary_key: true
  end

  @doc false
  def changeset(plans_organization, attrs) do
    plans_organization
    |> cast(attrs, [:plan_id, :organization_id])
    |> validate_required([:plan_id, :organization_id])
    |> unique_constraint(:organization_id)
  end

  def base_query() do
    from plans_organization in Castmill.Quotas.QuotasNetworks, as: :plans_organizations
  end
end
