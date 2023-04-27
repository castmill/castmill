defmodule Castmill.Repo.Migrations.CreatePlansNetworks do
  use Ecto.Migration

  def change do
    create table(:plans_networks, primary_key: false) do
      add :plan_name, references(:plans,  type: :string, on_delete: :delete_all, column: :name), null: false
      add :network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: false, unique: true, primary_key: true
    end

    create unique_index(:plans_networks, [:network_id])
  end
end
