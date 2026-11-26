defmodule Castmill.Repo.Migrations.AddMaxStorageToNetworks do
  use Ecto.Migration

  # Optional limit on the storage (MB) of all of a network's organizations
  # together, for example from its licensed screens. NULL means no limit.
  def change do
    alter table(:networks) do
      add :max_storage_mb, :bigint
    end
  end
end
