defmodule Castmill.Repo.Migrations.CreateDevices do
  use Ecto.Migration

  def change do
    create table(:devices, primary_key: false) do
      add :id, :uuid, primary_key: true

      add :name, :string
      add :description, :string
      add :hardware_id, :string, null: false
      add :last_ip, :string
      add :token_hash, :string
      add :online, :boolean
      add :last_online, :naive_datetime
      add :user_agent, :string
      add :timezone, :string
      add :loc_lat, :float
      add :loc_long, :float
      add :version, :string
      add :volume, :integer

      add :meta, :map
      add :settings, :map
      add :info, :map

      add :resource_id, references(:resources, on_delete: :nilify_all), null: true

      add :organization_id,
          references("organizations", column: "id", type: :uuid, on_delete: :delete_all),
          null: false

      timestamps()
    end

    # Device Ids must be global unique
    create unique_index(:devices, [:hardware_id])
    create index(:devices, [:organization_id])
  end
end
