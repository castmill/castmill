defmodule Castmill.Repo.Migrations.RepairSystemWidgetFontScale do
  use Ecto.Migration

  # Some databases ran an earlier version of the base-font migration that
  # converted these root sizes without adding the opt-in flag.
  def up do
    execute("""
    UPDATE widgets
    SET template = jsonb_set(template, '{fontScale}', 'true'::jsonb)
    WHERE is_system = true
      AND NOT (template ? 'fontScale')
      AND (
        (slug IN ('location-display-demo', 'qr-code', 'rss-news',
                  'spotify-now-playing', 'stock-ticker')
         AND template->'style'->>'font-size' = '1.6em')
        OR (slug = 'weather'
            AND template->'style'->>'font-size' = '1.944em')
      )
    """)
  end

  # The previous state was a partially applied migration; don't restore it.
  def down, do: :ok
end
