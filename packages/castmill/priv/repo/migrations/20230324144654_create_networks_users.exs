defmodule Castmill.Repo.Migrations.CreateNetworksAdmins do
  use Ecto.Migration

  def change do
    create table(:networks_users) do
      add :role, :string, null: false

      add :network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :uuid), null: false

      timestamps()
    end

    # TODO: use these unique index as primary key
    create unique_index(:networks_users, [:network_id, :user_id])
  end
end
