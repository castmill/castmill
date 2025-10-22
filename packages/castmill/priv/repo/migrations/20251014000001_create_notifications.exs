defmodule Castmill.Repo.Migrations.CreateNotifications do
  use Ecto.Migration

  def change do
    create table(:notifications, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :title_key, :string
      add :description_key, :string
      add :link, :string
      add :type, :string, null: false
      add :read, :boolean, default: false, null: false

      # Notification can be for a user, organization, or team
      add :user_id, references(:users, on_delete: :delete_all, type: :binary_id)
      add :organization_id, references(:organizations, on_delete: :delete_all, type: :binary_id)
      add :team_id, references(:teams, on_delete: :delete_all, type: :bigint)

      # Actor information (who/what triggered this notification)
      add :actor_id, :string
      add :actor_type, :string, default: "user"

      # Optional: restrict notification to specific roles within an organization/team
      add :roles, {:array, :string}, default: []

      # Metadata for extensibility (JSON field for custom event data)
      add :metadata, :map, default: %{}

      timestamps()
    end

    create index(:notifications, [:user_id])
    create index(:notifications, [:organization_id])
    create index(:notifications, [:team_id])
    create index(:notifications, [:type])
    create index(:notifications, [:read])
    create index(:notifications, [:inserted_at])
    create index(:notifications, [:actor_type])
    create index(:notifications, [:actor_id])
  end
end
