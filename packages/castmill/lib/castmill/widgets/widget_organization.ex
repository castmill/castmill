defmodule Castmill.Widgets.WidgetOrganization do
  @moduledoc """
  Enables a restricted system or network widget for an organization.
  """
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key false
  schema "widgets_organizations" do
    belongs_to(:widget, Castmill.Widgets.Widget, primary_key: true)

    belongs_to(:organization, Castmill.Organizations.Organization,
      type: Ecto.UUID,
      primary_key: true
    )

    timestamps()
  end

  def changeset(widget_organization, attrs) do
    widget_organization
    |> cast(attrs, [:widget_id, :organization_id])
    |> validate_required([:widget_id, :organization_id])
    |> unique_constraint([:widget_id, :organization_id], name: :widgets_organizations_pkey)
    |> foreign_key_constraint(:widget_id)
    |> foreign_key_constraint(:organization_id)
  end
end
