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
    # `logo` is shown on dark backgrounds; `logo_light` is an optional variant
    # for light backgrounds (e.g. the dashboard light theme).
    field(:logo, :string)
    field(:logo_light, :string)
    field(:name, :string)
    field(:default_locale, :string, default: "en")
    field(:privacy_policy_url, :string)
    field(:terms_url, :string)

    field(:invitation_only, :boolean, default: true)
    field(:invitation_only_org_admins, :boolean, default: false)

    field(:meta, :map)

    # Most devices the network's organizations may have together; nil means
    # no limit. Set by trusted callers only (see `device_limit_changeset/2`),
    # for example from a licence subscription; network admins cannot change it.
    field(:max_devices, :integer)
    # Most storage (MB) the network's organizations may use together; nil
    # means no limit. Trusted callers only, like `max_devices`.
    field(:max_storage_mb, :integer)

    has_many(:organizations, Castmill.Organizations.Organization)

    many_to_many(:users, Castmill.Accounts.User,
      join_through: "networks_users",
      on_replace: :delete
    )

    has_many(:plans, Castmill.Quotas.Plan)

    belongs_to(:default_plan, Castmill.Quotas.Plan,
      foreign_key: :default_plan_id,
      type: :integer
    )

    timestamps()
  end

  @doc false
  def storage_limit_changeset(network, max_storage_mb) do
    network
    |> cast(%{max_storage_mb: max_storage_mb}, [:max_storage_mb])
    |> validate_number(:max_storage_mb, greater_than_or_equal_to: 0)
  end

  @doc false
  def device_limit_changeset(network, max_devices) do
    network
    |> cast(%{max_devices: max_devices}, [:max_devices])
    |> validate_number(:max_devices, greater_than_or_equal_to: 0)
  end

  @doc false
  # `require_domain: false` is used to validate forms where an empty domain is
  # generated on save (see Castmill.Networks.DomainProvider).
  def changeset(network, attrs, opts \\ []) do
    required =
      if Keyword.get(opts, :require_domain, true),
        do: [:name, :email, :domain],
        else: [:name, :email]

    network
    |> cast(attrs, [
      :name,
      :copyright,
      :email,
      :logo,
      :logo_light,
      :domain,
      :meta,
      :default_plan_id,
      :default_locale,
      :privacy_policy_url,
      :terms_url,
      :invitation_only,
      :invitation_only_org_admins
    ])
    |> validate_required(required)
    |> validate_format(:email, ~r/@/, message: "must be a valid email address")
    # Shown as links on the login page and in the footer: web addresses only.
    |> validate_web_url(:privacy_policy_url)
    |> validate_web_url(:terms_url)
    |> validate_format(
      :domain,
      ~r/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*(:\d+)?$/,
      message: "must be a valid domain (e.g., app.example.com or localhost:3000)"
    )
    |> unique_constraint(:name)
    |> unique_constraint(:domain)
  end

  # An http(s) URL with a host (nil clears the link).
  defp validate_web_url(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      case URI.parse(value) do
        %URI{scheme: scheme, host: host}
        when scheme in ["http", "https"] and is_binary(host) and host != "" ->
          []

        _ ->
          [{field, "must be an http(s) URL"}]
      end
    end)
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
