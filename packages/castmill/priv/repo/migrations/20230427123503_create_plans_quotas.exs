defmodule Castmill.Repo.Migrations.CreatePlansQuotas do
  use Ecto.Migration

  def change do
    create table(:plans_quotas, primary_key: false) do
      add :max, :integer
      add :resource, :string, primary_key: true

      add :plan_id, references(:plans, on_delete: :delete_all, column: :id),
        null: false,
        primary_key: true
    end

    create unique_index(:plans_quotas, [:plan_id, :resource])
  end
end
