defmodule Castmill.Networks.Network do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID

  schema "networks" do
    field(:copyright, :string, default: "© 2024 Castmill AB")
    field(:domain, :string)
    field(:email, :string)
    field(:logo, :string, default: "https://castmill.com/images/logo.png")
    field(:name, :string)
    field(:default_locale, :string, default: "en")
    field(:privacy_policy_url, :string)

    field(:invitation_only, :boolean, default: false)
    field(:invitation_only_org_admins, :boolean, default: false)

    field(:meta, :map)

    has_many(:organizations, Castmill.Organizations.Organization)
    has_many(:users, Castmill.Accounts.User)
    has_many(:plans, Castmill.Quotas.Plan)

    belongs_to(:default_plan, Castmill.Quotas.Plan,
      foreign_key: :default_plan_id,
      type: :integer
    )

    timestamps()
  end

  @doc false
  def changeset(network, attrs) do
    network
    |> cast(attrs, [
      :name,
      :copyright,
      :email,
      :logo,
      :domain,
      :meta,
      :default_plan_id,
      :default_locale,
      :privacy_policy_url,
      :invitation_only,
      :invitation_only_org_admins
    ])
    |> validate_required([:name, :email, :domain])
    |> validate_format(:email, ~r/@/, message: "must be a valid email address")
    |> validate_format(:domain, ~r/^https?:\/\/[^\s\/$.?#].[^\s]*$/i,
      message: "must be a valid URL (e.g., https://example.com)"
    )
    |> unique_constraint(:name)
  end

  def base_query() do
    from(network in Castmill.Networks.Network, as: :network)
  end

  def where_name(query, nil) do
    query
  end

  def where_name(query, name) do
    from(network in query,
      where: network.name == ^name
    )
  end
end
