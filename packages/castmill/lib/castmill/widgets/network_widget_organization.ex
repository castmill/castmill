defmodule Castmill.Widgets.NetworkWidgetOrganization do
  @moduledoc """
  An organization listed in its network's policy for a widget (see
  `Castmill.Widgets.NetworkWidgetPolicy`): included for `selected` policies, excluded
  for `except` policies.
  """
  use Castmill.Schema

  @primary_key false
  schema "network_widget_organizations" do
    belongs_to(:widget, Castmill.Widgets.Widget, primary_key: true)

    belongs_to(:organization, Castmill.Organizations.Organization,
      type: Ecto.UUID,
      primary_key: true
    )

    timestamps(type: :utc_datetime)
  end
end
