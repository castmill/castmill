defmodule Castmill.Quotas.QuotasOrganizations do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "quotas_organizations" do
    field :max, :integer

    field :resource, Ecto.Enum,
      values: [
        :organizations,
        :medias,
        :playlists,
        :calendars,
        :calendars_entries,
        :devices,
        :users,
        :teams
      ],
      primary_key: true

    belongs_to :organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(quotas_organizations, attrs) do
    quotas_organizations
    |> cast(attrs, [:max, :resource, :organization_id])
    |> validate_required([:max, :resource, :organization_id])
  end

  def base_query() do
    from quotas_resource in Castmill.Quotas.QuotasOrganizations, as: :quotas_organizations
  end
end
