defmodule Castmill.Repo.Migrations.AddNetworkWidgetAccess do
  @moduledoc """
  Lets network admins curate which organizations of their network can use each system
  or network widget, without affecting other networks.

  A `network_widget_policies` row overrides the default ("all organizations") for one
  widget in one network:

    * `selected` – only the organizations in `network_widget_organizations`,
    * `except` – every organization except those in `network_widget_organizations`,
      so organizations created later are included,
    * `hidden` – no organization.
  """
  use Ecto.Migration

  def change do
    create table(:network_widget_policies, primary_key: false) do
      add(:network_id, references(:networks, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(:widget_id, references(:widgets, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(:mode, :string, null: false)

      timestamps(type: :utc_datetime)
    end

    create(index(:network_widget_policies, [:widget_id]))

    create(
      constraint(:network_widget_policies, :network_widget_policies_mode,
        check: "mode IN ('selected', 'except', 'hidden')"
      )
    )

    create table(:network_widget_organizations, primary_key: false) do
      add(:widget_id, references(:widgets, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(:organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      timestamps(type: :utc_datetime)
    end

    create(index(:network_widget_organizations, [:organization_id]))
  end
end
