defmodule Castmill.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users) do
      add :name, :string
      add :avatar, :string
      add :email, :string

      timestamps()
    end
  end
end
