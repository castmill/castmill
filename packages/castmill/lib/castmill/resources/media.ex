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

    many_to_many(:files, Castmill.Files.FilesMedias,
      join_through: "files_medias",
      on_replace: :delete
    )

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
    |> validate_required([:name])
    |> validate_status_and_message()
  end

  def base_query() do
    from(media in Castmill.Resources.Media, as: :media)
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
