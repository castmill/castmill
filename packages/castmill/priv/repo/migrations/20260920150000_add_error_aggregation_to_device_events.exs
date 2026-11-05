defmodule Castmill.Repo.Migrations.AddErrorAggregationToDeviceEvents do
  use Ecto.Migration

  def up do
    alter table(:devices_events) do
      add(:fingerprint, :string)
      add(:category, :string)
      add(:code, :string)
      add(:stack, :text)
      add(:context, :map)
      add(:occurrence_count, :integer, null: false, default: 1)
      add(:first_occurred_at, :utc_datetime)
      add(:last_occurred_at, :utc_datetime)
      add(:last_report_id, :string)
    end

    execute("""
    UPDATE devices_events
    SET first_occurred_at = timestamp, last_occurred_at = timestamp
    WHERE first_occurred_at IS NULL OR last_occurred_at IS NULL
    """)

    alter table(:devices_events) do
      modify(:first_occurred_at, :utc_datetime, null: false)
      modify(:last_occurred_at, :utc_datetime, null: false)
    end

    create(
      unique_index(:devices_events, [:device_id, :fingerprint],
        where: "type = 'e' AND fingerprint IS NOT NULL",
        name: :devices_events_error_fingerprint_index
      )
    )

    create(index(:devices_events, [:device_id, :type, :last_occurred_at]))
  end

  def down do
    drop(index(:devices_events, [:device_id, :type, :last_occurred_at]))

    drop(
      index(:devices_events, [:device_id, :fingerprint],
        name: :devices_events_error_fingerprint_index
      )
    )

    alter table(:devices_events) do
      remove(:last_report_id)
      remove(:last_occurred_at)
      remove(:first_occurred_at)
      remove(:occurrence_count)
      remove(:context)
      remove(:stack)
      remove(:code)
      remove(:category)
      remove(:fingerprint)
    end
  end
end
