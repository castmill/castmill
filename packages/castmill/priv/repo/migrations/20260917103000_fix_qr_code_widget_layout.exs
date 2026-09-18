defmodule Castmill.Repo.Migrations.FixQrCodeWidgetLayout do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE widgets
    SET
      template = jsonb_set(
        jsonb_set(
          jsonb_set(
            template,
            '{components,0,style,flex-shrink}',
            '"0"'::jsonb,
            true
          ),
          '{components,1,style,font-family}',
          '"sans-serif"'::jsonb,
          true
        ),
        '{components,1,style,height}',
        '"15%"'::jsonb,
        true
      )
    WHERE slug = 'qr-code'
    """)
  end

  def down do
    execute("""
    UPDATE widgets
    SET template =
      ((template #- '{components,0,style,flex-shrink}')
       #- '{components,1,style,font-family}')
      #- '{components,1,style,height}'
    WHERE slug = 'qr-code'
    """)
  end
end
