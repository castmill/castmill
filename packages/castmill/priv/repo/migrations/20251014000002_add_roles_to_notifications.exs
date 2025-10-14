defmodule Castmill.Repo.Migrations.AddRolesToNotifications do
  use Ecto.Migration

  def change do
    alter table(:notifications) do
      add :roles, {:array, :string}, default: []
    end
  end
end
