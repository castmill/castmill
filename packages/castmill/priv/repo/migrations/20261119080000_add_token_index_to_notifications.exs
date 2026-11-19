defmodule Castmill.Repo.Migrations.AddTokenIndexToNotifications do
  use Ecto.Migration

  # Invitation notifications carry their link's token in their metadata. When
  # a link is replaced, its notification is found by token, whoever received
  # it. Built inside the regular migration transaction and lock, so instances
  # deploying at the same time still run migrations one at a time.
  def change do
    create index(:notifications, ["(metadata->>'token')"],
             name: :notifications_metadata_token_index
           )
  end
end
