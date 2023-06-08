defmodule Castmill.Repo.Migrations.CreatePlans do
  use Ecto.Migration

  def change do
    create table(:plans) do
      add(:name, :string)

      add(:network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: false)

      timestamps()
    end

    create(unique_index(:plans, [:name, :network_id], name: :plans_name_network_id_index))
  end
end
