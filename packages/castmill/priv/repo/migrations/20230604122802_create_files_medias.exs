defmodule Castmill.Repo.Migrations.CreateFilesMedias do
  use Ecto.Migration

  def change do
    create table(:files_medias, primary_key: false) do
      add :file_id, references(:files, on_delete: :delete_all), null: false, primary_key: true
      add :media_id, references(:medias, on_delete: :delete_all), null: false, primary_key: true

      add :context, :string, null: false, default: "default"

      timestamps()
    end

    create unique_index(:files_medias, [:file_id, :media_id])
  end
end
