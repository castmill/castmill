defmodule Server.Repo.Migrations.CreateNetworks do
  use Ecto.Migration

  def change do
    create table(:networks) do
      add :id, :uuid, primary_key: true
      add :name, :string
      add :copyright, :string
      add :contact, :string
      add :logo, :string
      add :domain, :string
      add :default_language, :string

      timestamps()
    end
  end
end
