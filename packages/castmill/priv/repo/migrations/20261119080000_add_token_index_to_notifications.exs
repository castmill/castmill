defmodule Castmill.Repo.Migrations.AddTokenIndexToNotifications do
  use Ecto.Migration

  # Invitation notifications carry their link's token in their metadata. When
  # a link is replaced, its notification is found by token, whoever received
  # it. Built concurrently so writes to notifications are not blocked.
  @disable_ddl_transaction true
  @disable_migration_lock true

  def change do
    create index(:notifications, ["(metadata->>'token')"],
             name: :notifications_metadata_token_index,
             concurrently: true
           )
  end
end
