defmodule Castmill.Repo.Migrations.CreateWidgetPackages do
  use Ecto.Migration

  # The packages network admins upload, one row per version, so a version can be
  # downloaded or reinstalled later.
  def change do
    create table(:widget_packages) do
      add(:widget_id, references(:widgets, on_delete: :delete_all), null: false)
      add(:version, :integer, null: false)
      add(:filename, :string, null: false)
      add(:content_type, :string, null: false)
      add(:size, :integer, null: false)
      add(:sha256, :string, null: false)
      add(:content, :binary, null: false)
      add(:uploaded_by_id, references(:users, type: :uuid, on_delete: :nilify_all))

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:widget_packages, [:widget_id, :version]))
  end
end
