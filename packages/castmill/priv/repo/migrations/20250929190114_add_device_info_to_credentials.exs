defmodule Castmill.Repo.Migrations.AddDeviceInfoToCredentials do
  use Ecto.Migration

  def change do
    alter table(:users_credentials) do
      add :device_name, :string
      add :browser, :string
      add :os, :string
      add :user_agent, :text
    end
  end
end
