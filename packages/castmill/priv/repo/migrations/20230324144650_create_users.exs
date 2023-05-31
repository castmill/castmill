defmodule Castmill.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users, primary_key: false) do
      add :id, :uuid, primary_key: true

      add :name, :string
      add :avatar, :string
      add :email, :string, unique: true

      # Normally all users will belong to a network, however it is possible to have users that
      # are not part of any network. This is useful for system administrators.
      add :network_id, references("networks", column: "id", type: :uuid, on_delete: :delete_all), null: true

      timestamps()
    end

    create index(:users, [:network_id])
    create unique_index(:users, [:name, :network_id], name: :users_name_network_id_index)
  end
end
