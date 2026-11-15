defmodule Castmill.Repo.Migrations.CreateWidgetDeferredAssets do
  use Ecto.Migration

  def change do
    create table(:widget_deferred_assets, primary_key: false) do
      add(:slug, :string, primary_key: true, null: false)
      add(:key, :string, primary_key: true, null: false)
    end
  end
end
