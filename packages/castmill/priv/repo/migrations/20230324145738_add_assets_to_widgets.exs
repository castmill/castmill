defmodule Castmill.Repo.Migrations.AddAssetsToWidgets do
  use Ecto.Migration

  def change do
    alter table(:widgets) do
      add :assets, :map, default: %{}
    end
  end
end
