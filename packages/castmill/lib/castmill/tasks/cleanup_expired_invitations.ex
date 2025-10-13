defmodule Castmill.Tasks.CleanupExpiredInvitations do
  @moduledoc """
  Periodic task to clean up expired invitations.

  This task should be run periodically (e.g., daily) to remove expired invitations
  from both team invitations and organization invitations tables.

  Installer tokens (24h expiration) are particularly important to clean up
  for security reasons.

  ## Usage

  Add to your application supervision tree or run via a cron job:

      # In application.ex
      {Periodic, run: &Castmill.Tasks.CleanupExpiredInvitations.run/0, every: :timer.hours(24)}

  Or manually:

      iex> Castmill.Tasks.CleanupExpiredInvitations.run()
      {:ok, %{team_invitations_deleted: 5, org_invitations_deleted: 2}}
  """

  import Ecto.Query
  alias Castmill.Repo
  alias Castmill.Teams.Invitation, as: TeamInvitation
  alias Castmill.Organizations.OrganizationsInvitation

  require Logger

  @doc """
  Run the cleanup task.

  Deletes all expired invitations from team_invitations and organization_invitations tables.
  """
  def run do
    Logger.info("Starting cleanup of expired invitations...")

    now = DateTime.utc_now()

    # Clean up expired team invitations
    team_query =
      from(i in TeamInvitation,
        where: not is_nil(i.expires_at) and i.expires_at < ^now,
        # Only delete pending invitations
        where: i.status == "invited"
      )

    {team_count, _} = Repo.delete_all(team_query)

    # Clean up expired organization invitations
    org_query =
      from(i in OrganizationsInvitation,
        where: not is_nil(i.expires_at) and i.expires_at < ^now,
        # Only delete pending invitations
        where: i.status == "invited"
      )

    {org_count, _} = Repo.delete_all(org_query)

    Logger.info(
      "Cleanup complete: #{team_count} team invitations, #{org_count} org invitations deleted"
    )

    {:ok,
     %{
       team_invitations_deleted: team_count,
       org_invitations_deleted: org_count,
       total: team_count + org_count
     }}
  end

  @doc """
  Clean up only installer tokens (expired team invitations with installer role).

  Can be run more frequently than general cleanup (e.g., hourly) for better security.
  """
  def cleanup_installer_tokens do
    Logger.info("Starting cleanup of expired installer tokens...")

    now = DateTime.utc_now()

    query =
      from(i in TeamInvitation,
        where: i.role == :installer,
        where: not is_nil(i.expires_at) and i.expires_at < ^now,
        where: i.status == "invited"
      )

    {count, _} = Repo.delete_all(query)

    Logger.info("Cleanup complete: #{count} installer tokens deleted")

    {:ok, %{installer_tokens_deleted: count}}
  end

  @doc """
  Get count of expired but not yet cleaned invitations.
  Useful for monitoring.
  """
  def count_expired do
    now = DateTime.utc_now()

    team_count =
      from(i in TeamInvitation,
        where: not is_nil(i.expires_at) and i.expires_at < ^now,
        where: i.status == "invited",
        select: count(i.id)
      )
      |> Repo.one()

    org_count =
      from(i in OrganizationsInvitation,
        where: not is_nil(i.expires_at) and i.expires_at < ^now,
        where: i.status == "invited",
        select: count(i.id)
      )
      |> Repo.one()

    %{
      team_invitations: team_count,
      org_invitations: org_count,
      total: team_count + org_count
    }
  end
end
