defmodule Castmill.Repo.Migrations.FixQrCodeWidgetLayout do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE widgets
    SET
      template = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                template,
                '{components,0,style,flex-shrink}',
                '"0"'::jsonb,
                true
              ),
              '{components,0,$styles}',
              '[{"filter":{"options.caption":""},"style":{"width":"100%","height":"100%","box-sizing":"border-box"}}]'::jsonb,
              true
            ),
            '{components,1,style,font-family}',
            '"sans-serif"'::jsonb,
            true
          ),
          '{components,1,style,height}',
          '"15%"'::jsonb,
          true
        ),
        '{components,1,$styles}',
        '[{"filter":{"options.caption":""},"style":{"display":"none"}}]'::jsonb,
        true
      )
    WHERE slug = 'qr-code'
    """)
  end

  def down do
    execute("""
    UPDATE widgets
    SET template = template
      #- '{components,0,style,flex-shrink}'
      #- '{components,0,$styles}'
      #- '{components,1,style,font-family}'
      #- '{components,1,style,height}'
      #- '{components,1,$styles}'
    WHERE slug = 'qr-code'
    """)
  end
end
