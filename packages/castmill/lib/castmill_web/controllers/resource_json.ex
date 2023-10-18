defmodule CastmillWeb.ResourceJSON do
  alias Castmill.Resources.Media
  alias Castmill.Resources.Playlist
  alias Castmill.Resources.Calendar
  alias Castmill.Resources.CalendarEntry
  alias Castmill.Devices.Device

  @doc """
  Renders a list of medias.
  """
  def index(%{medias: medias, count: count}) do
    %{
      count: count,
      data: for(media <- medias, do: data(media))
    }
  end

  def index(%{playlists: playlists, count: count}) do
    %{
      count: count,
      data: for(playlist <- playlists, do: data(playlist))
    }
  end

  def index(%{calendars: calendars, count: count}) do
    %{
      count: count,
      data: for(calendar <- calendars, do: data(calendar))
    }
  end

  def index(%{devices: devices, count: count}) do
    %{
      count: count,
      data: for(device <- devices, do: data(device))
    }
  end

  @doc """
  Renders a single media.
  """
  def show(%{media: media}) do
    %{data: data(media)}
  end

  def show(%{calendar: calendar}) do
    %{data: data(calendar)}
  end

  def show(%{entry: entry}) do
    %{data: data(entry)}
  end

  def show(%{playlist: playlist}) do
    %{data: data(playlist)}
  end

  def show(%{device: device}) do
    %{data: data(device)}
  end

  defp data(%Media{files: %Ecto.Association.NotLoaded{}} = media) do
    %{
      id: media.id,
      name: media.name,
      mimetype: media.mimetype,
      meta: media.meta,
      status: media.status,
      status_message: media.status_message,
      files: []
    }
  end

  defp data(%Media{} = media) do
    %{
      id: media.id,
      name: media.name,
      mimetype: media.mimetype,
      meta: media.meta,
      status: media.status,
      status_message: media.status_message,
      files: media.files
    }
  end

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

  defp data(%Calendar{entries: %Ecto.Association.NotLoaded{}} = calendar) do
    %{
      id: calendar.id,
      name: calendar.name,
      timezone: calendar.timezone,
      default_playlist_id: calendar.default_playlist_id,
      entries: []
    }
  end

  defp data(%Calendar{} = calendar) do
    %{
      id: calendar.id,
      name: calendar.name,
      timezone: calendar.timezone,
      default_playlist_id: calendar.default_playlist_id,
      entries: calendar.entries
    }
  end

  defp data(%CalendarEntry{} = entry) do
    %{
      id: entry.id,
      start: entry.start,
      end: entry.end,
      playlist_id: entry.playlist_id
    }
  end

  defp data(%Device{} = device) do
    %{
      id: device.id,
      name: device.name,
      timezone: device.timezone,
      hardware_id: device.hardware_id,
      last_ip: device.last_ip
    }
  end
end
