defmodule Castmill.Repo.Migrations.FixOrganizationsInvitationsRoleValues do
  use Ecto.Migration

  def up do
    # Update any invalid role values to 'member'
    # Valid roles are: admin, manager, member, editor, publisher, device_manager, guest
    execute """
    UPDATE organizations_invitations
    SET role = 'member'
    WHERE role NOT IN ('admin', 'manager', 'member', 'editor', 'publisher', 'device_manager', 'guest')
    """
  end

  def down do
    # No-op: we cannot reliably restore the old invalid values
    :ok
  end
end
