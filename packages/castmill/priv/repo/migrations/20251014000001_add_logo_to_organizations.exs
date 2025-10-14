defmodule Castmill.Repo.Migrations.AddLogoToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      add :logo_media_id, references(:medias, type: :uuid, on_delete: :nilify_all)
    end

    create index(:organizations, [:logo_media_id])
  end
end
