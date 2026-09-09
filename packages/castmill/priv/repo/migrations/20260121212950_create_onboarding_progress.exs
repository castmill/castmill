defmodule Castmill.Repo.Migrations.CreateOnboardingProgress do
  use Ecto.Migration

  def change do
    create table(:onboarding_progress, primary_key: false) do
      add :id, :uuid, primary_key: true, default: fragment("gen_random_uuid()")
      add :user_id, references(:users, on_delete: :delete_all, type: :uuid), null: false
      add :completed_steps, {:array, :string}, default: [], null: false
      add :current_step, :string
      add :is_completed, :boolean, default: false, null: false
      add :dismissed, :boolean, default: false, null: false

      timestamps()
    end

    create unique_index(:onboarding_progress, [:user_id])
  end
end
