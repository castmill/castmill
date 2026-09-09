defmodule Castmill.Repo.Migrations.FixTeamsLayoutsAccessColumn do
  use Ecto.Migration

  def up do
    # Drop the old column and recreate with the correct type
    alter table(:teams_layouts) do
      remove :access
    end

    alter table(:teams_layouts) do
      add :access, {:array, :string}, default: ["read", "write", "delete"], null: false
    end
  end

  def down do
    alter table(:teams_layouts) do
      remove :access
    end

    alter table(:teams_layouts) do
      add :access, :string, null: false, default: "read"
    end
  end
end
