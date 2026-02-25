defmodule Castmill.Repo.Migrations.AddCascadeDeleteToNetworksUsers do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE networks_users DROP CONSTRAINT networks_users_user_id_fkey"

    execute """
    ALTER TABLE networks_users
    ADD CONSTRAINT networks_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    """
  end

  def down do
    execute "ALTER TABLE networks_users DROP CONSTRAINT networks_users_user_id_fkey"

    execute """
    ALTER TABLE networks_users
    ADD CONSTRAINT networks_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id)
    """
  end
end
