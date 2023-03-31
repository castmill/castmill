defmodule Server.Repo.Migrations.CreateDevices do
  use Ecto.Migration

  def change do
    create table(:devices, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :name, :string
      add :last_ip, :string
      add :token, :string
      add :account_id, :string
      add :meta, :map

      add :organization_id, references("organizations", column: "id", type: :uuid)

      timestamps()
    end
  end
end
