defmodule Castmill.Widgets.ScopeBackfill do
  @moduledoc """
  Assigns owners to non-system widgets from where they are used, without widening
  access (used by the AddWidgetScopes migration):

    * used by one organization -> organization widget,
    * used by several organizations of one network -> restricted network widget,
    * used across networks -> restricted system widget,
    * restricted widgets are enabled for exactly the organizations using them,
    * unused -> left unassigned (available to no organization).
  """

  @doc """
  Runs the backfill with the given repo (inside the caller's transaction).
  """
  def run(repo) do
    Enum.each(statements(), &repo.query!(&1, []))
  end

  defp statements do
    [
      "DROP TABLE IF EXISTS widget_scope_usage",
      """
      CREATE TEMPORARY TABLE widget_scope_usage AS
      SELECT DISTINCT wc.widget_id, p.organization_id, o.network_id
      FROM widgets_config wc
      JOIN playlists_items pi ON pi.id = wc.playlist_item_id
      JOIN playlists p ON p.id = pi.playlist_id
      JOIN organizations o ON o.id = p.organization_id
      JOIN widgets w ON w.id = wc.widget_id
      WHERE w.is_system IS FALSE AND w.network_id IS NULL AND w.organization_id IS NULL
      """,
      """
      UPDATE widgets w SET organization_id = u.organization_id
      FROM (
        SELECT widget_id, min(organization_id::text)::uuid AS organization_id
        FROM widget_scope_usage GROUP BY widget_id HAVING count(*) = 1
      ) u
      WHERE w.id = u.widget_id
      """,
      """
      UPDATE widgets w SET network_id = u.network_id, restricted = true
      FROM (
        SELECT widget_id, min(network_id::text)::uuid AS network_id
        FROM widget_scope_usage GROUP BY widget_id
        HAVING count(*) > 1 AND count(DISTINCT network_id) = 1
      ) u
      WHERE w.id = u.widget_id
      """,
      """
      UPDATE widgets w SET is_system = true, restricted = true
      FROM (
        SELECT widget_id FROM widget_scope_usage GROUP BY widget_id
        HAVING count(DISTINCT network_id) > 1
      ) u
      WHERE w.id = u.widget_id
      """,
      """
      INSERT INTO widgets_organizations (widget_id, organization_id, inserted_at, updated_at)
      SELECT u.widget_id, u.organization_id, now(), now()
      FROM widget_scope_usage u JOIN widgets w ON w.id = u.widget_id
      WHERE w.restricted IS TRUE
      ON CONFLICT DO NOTHING
      """,
      "DROP TABLE widget_scope_usage"
    ]
  end
end
