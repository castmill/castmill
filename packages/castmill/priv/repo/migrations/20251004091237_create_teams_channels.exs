defmodule Castmill.Repo.Migrations.CreateTeamsChannels do
  use Ecto.Migration

  def change do
    create table(:teams_channels, primary_key: false) do
      add :access, {:array, :string}, default: ["read", "write", "delete"], null: false

      add :team_id, references(:teams, on_delete: :delete_all), null: false, primary_key: true

      add :channel_id, references(:channels, on_delete: :delete_all),
        null: false,
        primary_key: true

      timestamps()
    end
  end
end
