defmodule Castmill.Repo.Migrations.CreateFilesMedias do
  use Ecto.Migration

  def change do
    create table(:files_medias) do
      add :context, :string, null: false, default: "default"

      add :file_id, references("files", column: "id", on_delete: :delete_all), null: false
      add :media_id, references("medias", column: "id", on_delete: :delete_all), null: false

      timestamps()
    end

    create unique_index(:files_medias, [:file_id, :media_id])
  end
end
