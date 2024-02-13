defmodule Castmill.Repo.Migrations.CreateUsersCredentials do
  use Ecto.Migration

  def change do
    create table(:users_credentials, primary_key: false) do
      add(:id, :string, primary_key: true)
      add(:public_key_spki, :binary)
      add(:user_id, references(:users, on_delete: :delete_all, type: :binary_id))
      timestamps()
    end

    create(index(:users_credentials, [:user_id]))
  end
end
