defmodule Castmill.Repo.Migrations.CreateNetworks do
  use Ecto.Migration

  def change do
    create table(:networks, primary_key: false) do
      add :id, :uuid, primary_key: true

      add :name, :string, null: false, unique: true
      add :copyright, :string
      add :email, :string, null: false
      add :logo, :string
      add :domain, :string

      add :meta, :map

      timestamps()
    end

    create unique_index(:networks, [:name])
  end
end
