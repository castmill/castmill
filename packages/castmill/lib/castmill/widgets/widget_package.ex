defmodule Castmill.Widgets.WidgetPackage do
  @moduledoc """
  An uploaded version of a network widget's package (`widget.json` or ZIP), kept
  so network admins can download it and the platform can reinstall it. See
  `Castmill.Widgets.Packages`.
  """
  use Ecto.Schema

  schema "widget_packages" do
    field(:version, :integer)
    field(:filename, :string)
    field(:content_type, :string)
    field(:size, :integer)
    field(:sha256, :string)
    field(:content, :binary)
    field(:uploaded_by_id, Ecto.UUID)

    belongs_to(:widget, Castmill.Widgets.Widget)

    timestamps(updated_at: false)
  end
end
