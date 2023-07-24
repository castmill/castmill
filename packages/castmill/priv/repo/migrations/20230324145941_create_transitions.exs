defmodule Castmill.Repo.Migrations.CreateTransitions do
  use Ecto.Migration

  def change do
    create table(:transitions) do
      add(:name, :string)
      add(:options_schema, :map)
      add(:uri, :string)
      add(:meta, :map)
      add(:icon, :string)

      timestamps()
    end

    create(index(:transitions, [:uri]))
  end
end
