defmodule Castmill.Repo.Migrations.AddFontsToWidgets do
  use Ecto.Migration

  def change do
    # Only add the column if it doesn't already exist
    # This handles cases where the column was added manually or by a previous migration
    unless column_exists?(:widgets, :fonts) do
      alter table(:widgets) do
        add :fonts, {:array, :map}, default: []
      end
    end
  end

  defp column_exists?(table, column) do
    query = """
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = '#{table}' AND column_name = '#{column}'
    )
    """

    %{rows: [[exists]]} = Ecto.Adapters.SQL.query!(Castmill.Repo, query, [])
    exists
  end
end
