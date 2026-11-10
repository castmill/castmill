defmodule Castmill.Repo.Migrations.AddIntegrationRefreshMode do
  @moduledoc """
  Adds on-demand refresh for pull integrations (see
  agents/systems/INTEGRATION-ON-DEMAND-REFRESH.md):

    * `widget_integrations.refresh_mode`: "scheduled" (repeatable polling, the
      existing behavior) or "on_demand" (refresh only when the data is read and
      stale).
    * `widget_integration_data.refresh_failures`: consecutive failed refreshes,
      used to back off from failing sources.
  """
  use Ecto.Migration

  def change do
    alter table(:widget_integrations) do
      add(:refresh_mode, :string, null: false, default: "scheduled")
    end

    create(
      constraint(:widget_integrations, :widget_integrations_refresh_mode,
        check: "refresh_mode IN ('scheduled', 'on_demand')"
      )
    )

    alter table(:widget_integration_data) do
      add(:refresh_failures, :integer, null: false, default: 0)
    end
  end
end
