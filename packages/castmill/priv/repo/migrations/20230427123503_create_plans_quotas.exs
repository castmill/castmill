defmodule Castmill.Repo.Migrations.CreatePlansQuotas do
  use Ecto.Migration

  def change do
    create table(:plans_quotas, primary_key: false) do
      add :max, :integer
      add :resource, :string, primary_key: true
      add :plan_name, references(:plans, type: :string, on_delete: :delete_all, column: :name), null: false, primary_key: true
    end

    create unique_index(:plans_quotas, [:plan_name, :resource])
  end
end
