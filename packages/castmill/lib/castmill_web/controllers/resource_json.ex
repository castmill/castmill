defmodule CastmillWeb.ResourceJSON do
  alias Castmill.Resources.Media
  alias Castmill.Resources.Playlist

  @doc """
  Renders a list of medias.
  """
  def index(%{medias: medias}) do
    %{data: for(media <- medias, do: data(media))}
  end

  def index(%{playlists: playlists}) do
    %{data: for(playlist <- playlists, do: data(playlist))}
  end

  @doc """
  Renders a single user.
  """
  def show(%{media: media}) do
    %{data: data(media)}
  end

  defp data(%Media{} = media) do
    %{
      id: media.id,
      name: media.name,
      uri: media.uri,
      size: media.size,
      mimetype: media.mimetype
    }
  end

  defp data(%Playlist{} = playlist) do
    %{
      id: playlist.id,
      name: playlist.name,
    }
  end
end
