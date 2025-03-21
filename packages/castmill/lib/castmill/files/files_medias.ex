defmodule Castmill.Files.FilesMedias do
  use Castmill.Schema
  import Ecto.Changeset

  @derive {Jason.Encoder, only: [:id, :file_id, :media_id, :context]}

  schema "files_medias" do
    field(:context, :string, default: "default")

    belongs_to(:file, Castmill.Files.File, foreign_key: :file_id)
    belongs_to(:media, Castmill.Resources.Media, foreign_key: :media_id)

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [:file_id, :media_id, :context])
    |> validate_required([:file_id, :media_id, :context])
    |> foreign_key_constraint(:file_id, name: :files_medias_file_id_fkey)
    |> foreign_key_constraint(:media_id, name: :files_medias_file_id_fkey)
  end
end
