defmodule Castmill.Repo.Migrations.AddOrganizationUsersToTheirNetworks do
  use Ecto.Migration

  # Accepting an organization invitation did not add the user to the
  # organization's network, so users who already had an account in another
  # network were missing from that network's users. Adds every organization
  # user to their organization's network as a member, keeping existing roles.
  def up do
    execute("""
    INSERT INTO networks_users (network_id, user_id, role, inserted_at, updated_at)
    SELECT DISTINCT o.network_id, ou.user_id, 'member', now(), now()
    FROM organizations_users ou
    JOIN organizations o ON o.id = ou.organization_id
    WHERE o.network_id IS NOT NULL
    ON CONFLICT (network_id, user_id) DO NOTHING
    """)
  end

  # The added memberships cannot be told apart from ones created since.
  def down, do: :ok
end
