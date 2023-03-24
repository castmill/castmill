defmodule Castmill.Repo.Migrations.CreateMedias do
  use Ecto.Migration

  def change do
    create table(:medias) do
      add :name, :string
      add :uri, :string
      add :size, :string
      add :mimetype, :string

      add :organization_id, references("organizations", column: "id", type: :uuid)

      timestamps()
    end
  end
end
