defmodule Castmill.Repo.Migrations.BackfillLegacyWidgetOwnership do
  @moduledoc """
  Widgets created before `widgets.organization_id` existed were globally visible.
  Since widget queries are now scoped to system widgets plus widgets owned by the
  current organization, legacy custom widgets would otherwise disappear.

  1. Legacy widgets used only by playlists of a single organization are assigned
     to that organization.
  2. Remaining unowned legacy widgets (unused or shared by several organizations)
     are promoted to system widgets so they stay visible everywhere, exactly as
     before. They can be cloned to obtain an editable, organization-owned copy.
  """
  use Ecto.Migration

  def up do
    execute("""
    UPDATE widgets AS w
    SET organization_id = owners.organization_id
    FROM (
      SELECT wc.widget_id, MIN(p.organization_id::text)::uuid AS organization_id
      FROM widgets_config AS wc
      JOIN playlists_items AS pi ON pi.id = wc.playlist_item_id
      JOIN playlists AS p ON p.id = pi.playlist_id
      WHERE p.organization_id IS NOT NULL
      GROUP BY wc.widget_id
      HAVING COUNT(DISTINCT p.organization_id) = 1
    ) AS owners
    WHERE w.id = owners.widget_id
      AND w.organization_id IS NULL
      AND COALESCE(w.is_system, false) = false
    """)

    execute("""
    UPDATE widgets
    SET is_system = true
    WHERE organization_id IS NULL
      AND COALESCE(is_system, false) = false
    """)
  end

  def down do
    :ok
  end
end
