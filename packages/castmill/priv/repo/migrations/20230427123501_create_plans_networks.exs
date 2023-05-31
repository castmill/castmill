defmodule Castmill.Repo.Migrations.CreatePlansNetworks do
  use Ecto.Migration

  def change do
    create table(:plans_networks, primary_key: false) do
      add :plan_id, references(:plans, on_delete: :delete_all, column: :id), null: false
      add :network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: false, unique: true, primary_key: true
    end

    create unique_index(:plans_networks, [:network_id])
  end
end
