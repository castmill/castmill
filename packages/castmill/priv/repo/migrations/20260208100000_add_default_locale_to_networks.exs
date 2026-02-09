defmodule Castmill.Repo.Migrations.AddDefaultLocaleToNetworks do
  use Ecto.Migration

  def change do
    alter table(:networks) do
      add :default_locale, :string, default: "en"
    end
  end
end
