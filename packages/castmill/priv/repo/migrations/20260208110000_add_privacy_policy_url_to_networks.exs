defmodule Castmill.Repo.Migrations.AddPrivacyPolicyUrlToNetworks do
  use Ecto.Migration

  def change do
    alter table(:networks) do
      add :privacy_policy_url, :string
    end
  end
end
