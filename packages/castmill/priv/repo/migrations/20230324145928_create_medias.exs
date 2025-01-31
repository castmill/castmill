defmodule Castmill.Repo.Migrations.CreateMedias do
  use Ecto.Migration

  def change do
    create table(:medias) do
      add :name, :string
      add :mimetype, :string

      # Enum: [:uploading, :transcoding, :ready, :failed]
      add :status, :string
      add :status_message, :string

      add :meta, :map

      add :organization_id,
          references(:organizations, column: "id", type: :uuid, on_delete: :delete_all),
          null: false
      timestamps()
    end
  end
end
