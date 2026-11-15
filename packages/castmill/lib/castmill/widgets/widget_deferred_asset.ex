defmodule Castmill.Widgets.WidgetDeferredAsset do
  @moduledoc """
  An asset key that was pruned from a widget package but is still referenced by a
  saved playlist item, or could not yet be deleted from storage.
  """
  use Ecto.Schema

  @primary_key false
  schema "widget_deferred_assets" do
    field(:slug, :string, primary_key: true)
    field(:key, :string, primary_key: true)
  end
end
