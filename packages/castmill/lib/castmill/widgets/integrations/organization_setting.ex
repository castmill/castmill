defmodule Castmill.Widgets.Integrations.OrganizationSetting do
  @moduledoc """
  Non-secret integration settings of an organization, shared by every
  integration that declares the same settings `key` (e.g. the agency and office
  IDs used by all property listing widgets). See
  `Castmill.Widgets.Integrations.OrganizationSettings`.
  """
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "organization_integration_settings" do
    field(:key, :string)
    field(:settings, :map, default: %{})
    field(:updated_by_id, :binary_id)

    belongs_to(:organization, Castmill.Organizations.Organization)

    timestamps(type: :utc_datetime_usec)
  end
end
