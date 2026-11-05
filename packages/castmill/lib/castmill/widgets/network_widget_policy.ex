defmodule Castmill.Widgets.NetworkWidgetPolicy do
  @moduledoc """
  How a network offers one system or network widget to its organizations, overriding
  the default of "all organizations":

    * `selected` – only the organizations listed in `Castmill.Widgets.NetworkWidgetOrganization`,
    * `except` – every organization except the listed ones,
    * `hidden` – no organization.
  """
  use Castmill.Schema

  @modes ~w(selected except hidden)

  @primary_key false
  schema "network_widget_policies" do
    belongs_to(:network, Castmill.Networks.Network, type: Ecto.UUID, primary_key: true)
    belongs_to(:widget, Castmill.Widgets.Widget, primary_key: true)
    field(:mode, :string)

    timestamps(type: :utc_datetime)
  end

  def modes, do: @modes
end
