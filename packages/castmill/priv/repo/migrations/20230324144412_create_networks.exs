defmodule Castmill.Repo.Migrations.CreateNetworks do
  use Ecto.Migration

  def change do
    create table(:networks) do
      add :name, :string
      add :copyright, :string
      add :email, :string
      add :logo, :string
      add :domain, :string
      add :default_language, :string

      timestamps()
    end
  end
end
