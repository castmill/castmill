defmodule Castmill.Repo.Migrations.AddOnboardingCompletedToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      add :onboarding_completed, :boolean, default: true, null: false
    end

    # Set existing organizations to have onboarding completed
    execute "UPDATE organizations SET onboarding_completed = true", ""
  end
end
