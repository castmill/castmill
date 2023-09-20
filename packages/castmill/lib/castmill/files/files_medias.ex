defmodule Castmill.Files.FilesMedias do
  use Ecto.Schema
  import Ecto.Changeset

  schema "files_medias" do
    field :context, :string, default: "default"

    belongs_to :file, Castmill.Files.File, foreign_key: :file_id
    belongs_to :media, Castmill.Resources.Media, foreign_key: :media_id

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [:file_id, :media_id, :context])
    |> validate_required([:file_id, :media_id, :context])
  end
end
