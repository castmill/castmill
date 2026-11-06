defmodule Castmill.Repo.Migrations.CreateFeeds do
  use Ecto.Migration

  def change do
    create table(:feeds, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :organization_id, references(:organizations, type: :binary_id, on_delete: :delete_all),
        null: false

      add :name, :string, null: false
      add :description, :text
      add :mode, :string, null: false, default: "list"
      add :keep, :integer, null: false, default: 10
      add :schema, :map
      add :media_fields, {:array, :map}, null: false, default: []
      add :document, :map
      add :version, :integer, null: false, default: 1
      add :data_updated_at, :utc_datetime_usec

      timestamps()
    end

    create index(:feeds, [:organization_id])
    create unique_index(:feeds, [:organization_id, :name])

    create constraint(:feeds, :feeds_mode_check, check: "mode IN ('list', 'document')")
    create constraint(:feeds, :feeds_keep_check, check: "keep BETWEEN 1 AND 100")

    create table(:feed_entries, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :feed_id, references(:feeds, type: :binary_id, on_delete: :delete_all), null: false
      add :external_id, :string
      add :data, :map, null: false
      add :received_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:feed_entries, [:feed_id, :received_at])

    create unique_index(:feed_entries, [:feed_id, :external_id],
             where: "external_id IS NOT NULL",
             name: :feed_entries_feed_id_external_id_index
           )

    create table(:feed_tokens, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :feed_id, references(:feeds, type: :binary_id, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :secret_hash, :string, null: false
      add :hint, :string, null: false
      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :last_used_at, :utc_datetime
      add :revoked_at, :utc_datetime

      timestamps()
    end

    create unique_index(:feed_tokens, [:secret_hash])
    create index(:feed_tokens, [:feed_id])
  end
end
