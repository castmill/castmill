defmodule Castmill.Files.FilesMedias do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key(false)

  schema "files_medias" do
    field :context, :string, default: "default"

    belongs_to :files, Castmill.Files.File, foreign_key: :file_id, primary_key: true
    belongs_to :medias, Castmill.Resources.Media, foreign_key: :media_id, primary_key: true

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [:file_id, :media_id, :context])
    |> validate_required([:file_id, :media_id, :context])
  end
end
