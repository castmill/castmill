defmodule Castmill.Repo.Migrations.AddFontsToWidgets do
  use Ecto.Migration

  def change do
    alter table(:widgets) do
      add :fonts, {:array, :map}, default: []
    end
  end
end
