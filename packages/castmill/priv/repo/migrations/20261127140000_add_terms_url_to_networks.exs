defmodule Castmill.Repo.Migrations.AddTermsUrlToNetworks do
  use Ecto.Migration

  def change do
    alter table(:networks) do
      add :terms_url, :string
    end
  end
end
