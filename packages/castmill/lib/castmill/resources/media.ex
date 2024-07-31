defmodule Castmill.Resources.Media do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "medias" do
    field(:mimetype, :string)
    field(:name, :string)

    field(:status, Ecto.Enum, values: [:uploading, :transcoding, :ready, :failed])
    field(:status_message, :string)

    field(:meta, :map)

    belongs_to(:organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID
    )

    belongs_to(:resource, Castmill.Resources.Resource, foreign_key: :resource_id)

    has_many(:files_medias, Castmill.Files.FilesMedias)

    timestamps()
  end

  @doc false
  def changeset(media, attrs) do
    media
    |> cast(attrs, [
      :name,
      :mimetype,
      :meta,
      :organization_id,
      :resource_id,
      :status,
      :status_message
    ])
    |> validate_required([:name, :mimetype, :organization_id])
    |> validate_status_and_message()
  end

  def update_changeset(media, attrs) do
    media
    |> cast(attrs, [:name, :status, :status_message])
    |> validate_status_and_message()
  end

  def base_query() do
    from(media in __MODULE__, as: :media)
  end

  def preloads() do
    [files_medias: :file]
  end

  defp validate_status_and_message(changeset) do
    status = get_field(changeset, :status)
    status_message = get_field(changeset, :status_message)

    cond do
      status == :failed and is_nil(status_message) ->
        add_error(changeset, :status_message, "must be present when status is :failed")

      status == :transcoding and is_nil(status_message) ->
        add_error(changeset, :status_message, "must be present when status is :transcoding")

      true ->
        changeset
    end
  end
end

defimpl Jason.Encoder, for: Castmill.Resources.Media do
  def encode(%Castmill.Resources.Media{} = media, opts) do
    files_medias =
      case media.files_medias do
        %Ecto.Association.NotLoaded{} -> []
        files_medias -> files_medias
      end

    files =
      Enum.reduce(files_medias, %{}, fn files_media, acc ->
        Map.put(acc, files_media.context, files_media.file)
      end)

    map = %{
      id: media.id,
      organization_id: media.organization_id,
      mimetype: media.mimetype,
      name: media.name,
      status: media.status,
      status_message: media.status_message,
      meta: media.meta,
      files: files,
      inserted_at: media.inserted_at,
      updated_at: media.updated_at,
      size: Enum.reduce(files, 0, fn {_, file}, acc -> acc + file.size end)
    }

    Jason.Encode.map(map, opts)
  end
end
