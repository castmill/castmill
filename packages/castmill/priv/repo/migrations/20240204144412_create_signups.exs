defmodule Castmill.Repo.Migrations.CreateSignUps do
  use Ecto.Migration

  def change do
    create table(:signups, primary_key: false) do
      add(:id, :uuid, primary_key: true)

      # Network ID
      add :network_id, references("networks", column: "id", type: :uuid, on_delete: :delete_all),
        null: false

      add(:email, :string, null: false)
      add(:challenge, :string)

      # Ecto.Enum, values: [:created, :sent, :used, :failed])
      add(:status, :string)
      add(:status_message, :string)

      timestamps()
    end

    create(index(:signups, [:email]))
  end
end
