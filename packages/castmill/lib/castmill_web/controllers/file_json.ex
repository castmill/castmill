defmodule CastmillWeb.FileJSON do
  alias Castmill.Files.File
  alias Castmill.Workers.Helpers

  @doc """
  Renders a list of files.
  """
  def index(%{files: files}) do
    %{data: for(file <- files, do: data(file))}
  end

  @doc """
  Renders a single file.
  """
  def show(%{file: file}) do
    %{data: data(file)}
  end

  defp data(%File{} = file) do
    %{
      id: file.id,
      name: file.name,
      uri: Helpers.resolve_media_uri(file.uri, file.organization_id),
      size: file.size,
      mimetype: file.mimetype
    }
  end

  @doc """
  Renders the status and details of a created file.
  """
  def create(%{file: file}) do
    %{status: "success", data: data(file)}
  end
end
