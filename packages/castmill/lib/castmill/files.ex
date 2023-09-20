defmodule Castmill.Files do
  @moduledoc """
  The Files context.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo

  alias Castmill.Files.File
  alias Castmill.Files.FilesMedias
  alias Castmill.Protocol.Access

  defimpl Access, for: File do
    def canAccess(_team, user, _action) do
      if user == nil do
        {:error, "No user provided"}
      else
        # network_admin = Repo.get_by(Castmill.Networks.NetworksAdmins, network_id: network.id, user_id: user.id)
        # if network_admin !== nil do
        #   {:ok, true}
        # else
        #   {:ok, false}
        # end
      end
    end
  end

  @doc """
  Creates a file with the given attributes.

  ## Examples

      iex> create_file(%{field: value})
      {:ok, %File{}}

      iex> create_file(%{field: bad_value})
      {:error, %Ecto.Changeset{}}
  """
  def create_file(attrs \\ %{}) do
    %File{}
    |> File.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Returns the list of files.

  ## Examples
      iex> list_files()
      [%File{}, ...]
  """
  def list_files() do
    File.base_query()
    |> Repo.all()
  end

  def list_files(organization_id) do
    File.base_query()
    |> where([f], f.organization_id == ^organization_id)
    |> Repo.all()
  end

  @doc """
  Returns the total size in bytes of all files in the given organization.

  ## Examples

      iex> get_total_size(organization_id)
      123456789
  """
  def get_total_size(organization_id) do
    total_size =
      File.base_query()
      |> where([f], f.organization_id == ^organization_id)
      |> select([f], sum(f.size))
      |> Repo.one()

    total_size || 0
  end

  def add_file_to_media(file_id, media_id, context) do
    %FilesMedias{}
    |> FilesMedias.changeset(%{file_id: file_id, media_id: media_id, context: context})
    |> Repo.insert()
  end

  def get_media_files(media_id) do
    query =
      from(files_medias in FilesMedias,
        where: files_medias.media_id == ^media_id,
        join: file in assoc(files_medias, :file),
        order_by: [asc: file.updated_at],
        select: file
      )

    Repo.all(query)
  end

  def get_media_file(media_id, context) do
    query =
      from(files_medias in FilesMedias,
        where: files_medias.media_id == ^media_id and files_medias.context == ^context,
        join: file in assoc(files_medias, :file),
        order_by: [asc: file.updated_at],
        select: file
      )

    Repo.one(query)
  end

  def get_file(file_id) do
    File.base_query()
    |> where([f], f.id == ^file_id)
    |> Repo.one()
  end

  def get_file(media_id, file_id) do
    query =
      from(files_medias in FilesMedias,
        where: files_medias.media_id == ^media_id and files_medias.file_id == ^file_id,
        join: file in assoc(files_medias, :file),
        order_by: [asc: file.updated_at],
        select: file
      )

    Repo.one(query)
  end

  def get_file_by_name(name, organization_id) do
    File.base_query()
    |> where([f], f.name == ^name and f.organization_id == ^organization_id)
    |> Repo.one()
  end

  def delete_file(file_id, organization_id) do
    File.base_query()
    |> where([f], f.id == ^file_id and f.organization_id == ^organization_id)
    |> Repo.delete_all()
  end

  def delete_file(file_id) do
    File.base_query()
    |> where([f], f.id == ^file_id)
    |> Repo.delete_all()
  end

  def delete_file(file_id, media_id, organization_id) do
    query =
      from(fm in FilesMedias,
        where: fm.file_id == ^file_id and fm.media_id == ^media_id
      )

    case Repo.all(query) do
      [] ->
        :error

      [_ | _] ->
        case File.base_query()
             |> where([f], f.id == ^file_id and f.organization_id == ^organization_id)
             |> Repo.delete_all() do
          {count, _} when count > 0 -> {:ok, count}
          _ -> :error
        end
    end
  end
end
