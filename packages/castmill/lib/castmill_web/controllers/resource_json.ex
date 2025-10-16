defmodule CastmillWeb.ResourceJSON do
  alias Castmill.Resources.Media
  alias Castmill.Resources.Playlist
  alias Castmill.Resources.Channel
  alias Castmill.Resources.ChannelEntry
  alias Castmill.Devices.Device
  alias Castmill.Teams.Team

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

  def index(%{channels: channels, count: count}) do
    %{
      count: count,
      data: for(channel <- channels, do: data(channel))
    }
  end

  def index(%{devices: devices, count: count}) do
    %{
      count: count,
      data: for(device <- devices, do: data(device))
    }
  end

  def index(%{teams: teams, count: count}) do
    %{
      count: count,
      data: for(team <- teams, do: data(team))
    }
  end

  @doc """
  Renders a single media.
  """
  def show(%{media: media}) do
    %{data: data(media)}
  end

  def show(%{channel: channel}) do
    %{data: data(channel)}
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

  def show(%{team: team}) do
    %{data: data(team)}
  end

  defp data(%Media{files_medias: %Ecto.Association.NotLoaded{}} = media) do
    %{
      id: media.id,
      name: media.name,
      mimetype: media.mimetype,
      meta: media.meta,
      status: media.status,
      status_message: media.status_message,
      files: %{}
    }
  end

  defp data(%Media{} = media) do
    files =
      case Map.get(media, :files) do
        files when is_map(files) ->
          files

        _ ->
          case media.files_medias do
            %Ecto.Association.NotLoaded{} ->
              %{}

            files_medias ->
              Enum.reduce(files_medias, %{}, fn files_media, acc ->
                case Map.get(files_media, :file) do
                  nil -> acc
                  file -> Map.put(acc, files_media.context, file)
                end
              end)
          end
      end

    %{
      id: media.id,
      name: media.name,
      mimetype: media.mimetype,
      meta: media.meta,
      status: media.status,
      status_message: media.status_message,
      files: files
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

  defp data(%Channel{entries: %Ecto.Association.NotLoaded{}} = channel) do
    %{
      id: channel.id,
      name: channel.name,
      timezone: channel.timezone,
      default_playlist_id: channel.default_playlist_id,
      entries: []
    }
  end

  defp data(%Channel{} = channel) do
    %{
      id: channel.id,
      name: channel.name,
      timezone: channel.timezone,
      default_playlist_id: channel.default_playlist_id,
      entries: channel.entries
    }
  end

  defp data(%ChannelEntry{} = entry) do
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

  defp data(%Team{} = team) do
    %{
      id: team.id,
      name: team.name,
      organization_id: team.organization_id
    }
  end
end
