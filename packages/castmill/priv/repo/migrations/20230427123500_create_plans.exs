defmodule Castmill.Repo.Migrations.CreatePlans do
  use Ecto.Migration

  def change do
    create table(:plans, primary_key: false) do
      add :name, :string, unique: true
      timestamps()
    end

    create unique_index(:plans, [:name])
  end
end
