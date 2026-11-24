defmodule Castmill.Repo.Migrations.CreateOsReleases do
  use Ecto.Migration

  # OS updates for Castmill OS devices (castmill-os ADR-0010): releases
  # imported from GitHub, the organization's update policy, and each device's
  # override and last reported update status.
  def change do
    create table(:os_releases, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:version, :string, null: false)
      add(:prerelease, :boolean, null: false, default: false)
      add(:security, :boolean, null: false, default: false)
      add(:published_at, :utc_datetime, null: false)
      add(:notes_url, :string)
      # %{"castmill-os-<machine>" => %{"url" => ..., "sha256" => ..., "size" => ...}}
      add(:artifacts, :map, null: false)

      timestamps()
    end

    create(unique_index(:os_releases, [:version]))
    create(index(:os_releases, [:published_at]))

    # %{"mode" => "manual" | "latest" | "version", "version" => ..., "prereleases" => bool}
    alter table(:organizations) do
      add(:os_update, :map)
    end

    alter table(:devices) do
      # Device override: %{"mode" => "follow" | "version", "version" => ..., "now" => bool}
      add(:os_update, :map)
      # Last os_update:report from the device.
      add(:os_status, :map)
    end
  end
end
