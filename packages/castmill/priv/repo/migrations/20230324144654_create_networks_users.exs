defmodule Castmill.Repo.Migrations.CreateNetworksAdmins do
  use Ecto.Migration

  def change do
    create table(:networks_admins) do
      add :access, {:array, :string}

      add :network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :uuid), null: false

      timestamps()
    end

    create unique_index(:networks_admins, [:network_id, :user_id])

  end
end
