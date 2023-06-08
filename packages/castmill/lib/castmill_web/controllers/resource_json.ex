defmodule CastmillWeb.ResourceJSON do
  alias Castmill.Resources.Media
  alias Castmill.Resources.Playlist

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
      mimetype: media.mimetype,
      meta: media.meta,
    }
  end

  defp data(%Playlist{} = playlist) do
    %{
      id: playlist.id,
      name: playlist.name,
    }
  end
end
