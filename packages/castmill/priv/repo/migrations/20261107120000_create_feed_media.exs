defmodule Castmill.Repo.Migrations.CreateFeedMedia do
  use Ecto.Migration

  def change do
    create table(:feed_media, primary_key: false) do
      add :id, :binary_id, primary_key: true

      # Nilified (not deleted) with their feed or organization so that the
      # cleanup job can still remove the stored files.
      add :feed_id, references(:feeds, type: :binary_id, on_delete: :nilify_all)

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :nilify_all)

      add :original_url, :text, null: false
      add :url_hash, :string, null: false
      add :status, :string, null: false, default: "pending"
      add :failure_reason, :string
      add :content_hash, :string
      add :storage_key, :text
      add :url, :text
      add :content_type, :string
      add :size, :bigint
      add :width, :integer
      add :height, :integer
      add :duration, :float

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:feed_media, [:feed_id, :url_hash])
    create index(:feed_media, [:feed_id, :content_hash])
    create index(:feed_media, [:organization_id, :status])
    create index(:feed_media, [:status])

    create constraint(:feed_media, :feed_media_status_check,
             check: "status IN ('pending', 'ready', 'failed', 'deleting')"
           )
  end
end
