defmodule Castmill.Repo.Migrations.AddLogoLightToNetworks do
  use Ecto.Migration

  # Networks used to default to this logo, whose white text is invisible on
  # the light dashboard theme. Clearing it lets the dashboard fall back to its
  # bundled, theme-aware Castmill logos.
  @legacy_default_logo "https://castmill.com/images/logo.png"

  def up do
    alter table(:networks) do
      add :logo_light, :string
    end

    execute("UPDATE networks SET logo = NULL WHERE logo = '#{@legacy_default_logo}'")
  end

  def down do
    alter table(:networks) do
      remove :logo_light
    end
  end
end
