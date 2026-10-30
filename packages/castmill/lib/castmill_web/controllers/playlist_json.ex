defmodule CastmillWeb.PlaylistJSON do
  alias Castmill.Resources.Playlist

  @doc """
  Renders a single playlist.
  """
  def show(%{playlist: playlist}) do
    %{data: data(playlist)}
  end

  def show(%{item: item}) do
    %{
      data: %{
        id: item.id,
        playlist_id: item.playlist_id,
        prev_item_id: item.prev_item_id,
        offset: item.offset,
        duration: item.duration,
        widget_config_id: Map.get(item, :widget_config_id) || loaded_widget_config_id(item)
      }
    }
  end

  defp loaded_widget_config_id(%{widget_config: %Castmill.Widgets.WidgetConfig{id: id}}), do: id
  defp loaded_widget_config_id(_item), do: nil

  defp data(%Playlist{items: %Ecto.Association.NotLoaded{}} = playlist) do
    %{
      id: playlist.id,
      name: playlist.name,
      # or some other default value
      items: []
    }
  end

  defp data(%Playlist{} = playlist) do
    %{
      id: playlist.id,
      name: playlist.name,
      items: playlist.items
    }
  end
end
