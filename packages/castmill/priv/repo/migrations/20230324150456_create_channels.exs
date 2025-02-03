defmodule Castmill.Repo.Migrations.CreateChannels do
  use Ecto.Migration

  def change do
    create table(:channels) do
      add :name, :string
      add :timezone, :string
      add :description, :string

      add :organization_id,
          references("organizations", column: "id", type: :uuid, on_delete: :delete_all),
          null: false

      add :default_playlist_id,
          references("playlists", column: "id", type: :integer, on_delete: :nilify_all)

      timestamps()
    end
  end
end
