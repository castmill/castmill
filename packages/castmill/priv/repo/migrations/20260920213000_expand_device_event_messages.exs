defmodule Castmill.Repo.Migrations.ExpandDeviceEventMessages do
  use Ecto.Migration

  def up do
    alter table(:devices_events) do
      modify(:msg, :text, from: :string)
    end
  end

  def down do
    execute("UPDATE devices_events SET msg = LEFT(msg, 255) WHERE LENGTH(msg) > 255")

    alter table(:devices_events) do
      modify(:msg, :string, from: :text)
    end
  end
end
