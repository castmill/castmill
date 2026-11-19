defmodule Castmill.OrganizationsInvitationLockingTest do
  @moduledoc """
  Invitation delivery is serialized across separate database sessions. These
  tests run outside the SQL sandbox, so the other sessions see their data; they
  delete what they create.
  """
  use ExUnit.Case, async: false

  import Ecto.Query
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Notifications
  alias Castmill.Organizations
  alias Castmill.Organizations.OrganizationsInvitation
  alias Castmill.Repo
  alias Ecto.Adapters.SQL.Sandbox

  setup do
    :ok = Sandbox.checkout(Repo, sandbox: false)

    network = network_fixture()

    organization =
      organization_fixture(%{
        network: network,
        name: "Locking #{System.unique_integer([:positive])}"
      })

    user = user_fixture(%{network_id: network.id})

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      Repo.delete_all(from(u in Castmill.Accounts.User, where: u.id == ^user.id))

      Repo.delete_all(
        from(o in Castmill.Organizations.Organization, where: o.network_id == ^network.id)
      )

      Repo.delete_all(from(n in Castmill.Networks.Network, where: n.id == ^network.id))
    end)

    {:ok, token} = Organizations.invite_user(organization.id, user.email, :member)

    %{
      organization: organization,
      user: user,
      invitation: Organizations.get_invitation(token)
    }
  end

  # A PostgreSQL session of its own, outside the application's pool.
  defp other_session do
    {:ok, conn} =
      Repo.config()
      |> Keyword.take([:hostname, :port, :username, :password, :database])
      |> Postgrex.start_link()

    conn
  end

  # Runs `fun` in a task with its own pool connection.
  defp in_own_session(fun) do
    Task.async(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      fun.()
    end)
  end

  # Waits until `count` sessions are waiting for a lock.
  defp await_lock_waiters(count, attempts \\ 100) do
    %{rows: [[waiting]]} = Repo.query!("SELECT count(*) FROM pg_locks WHERE NOT granted")

    cond do
      waiting >= count -> :ok
      attempts == 0 -> flunk("Expected #{count} sessions waiting for a lock, got #{waiting}")
      true -> Process.sleep(20) && await_lock_waiters(count, attempts - 1)
    end
  end

  defp invitation_notifications(user) do
    user.id
    |> Notifications.list_user_notifications()
    |> Enum.filter(&(&1.type == "organization_invitation"))
  end

  test "invites and resends wait for another session delivering the same invitation", %{
    organization: organization,
    user: user,
    invitation: invitation
  } do
    {namespace, key} = Organizations.invitation_lock_key(organization.id, user.email)
    session = other_session()
    Postgrex.query!(session, "SELECT pg_advisory_lock($1, hashtext($2))", [namespace, key])

    started = System.monotonic_time(:millisecond)
    assert {:error, :busy} = Organizations.resend_invitation(organization.id, invitation.id)
    # It retried before giving up, and changed nothing.
    assert System.monotonic_time(:millisecond) - started >= 300
    assert Repo.get_by!(OrganizationsInvitation, id: invitation.id).token == invitation.token

    # Other spellings of the organization id and email use the same lock.
    assert {:error, :busy} =
             Organizations.resend_invitation(String.upcase(organization.id), invitation.id)

    assert {:error, :busy} =
             Organizations.invite_user(organization.id, String.upcase(user.email), :member)

    Postgrex.query!(session, "SELECT pg_advisory_unlock($1, hashtext($2))", [namespace, key])

    assert {:ok, resent} = Organizations.resend_invitation(organization.id, invitation.id)
    assert resent.token != invitation.token
  end

  test "an acceptance and a resend in separate sessions do not both succeed", %{
    organization: organization,
    user: user,
    invitation: invitation
  } do
    {:ok, tasks} =
      Repo.transaction(fn ->
        # Holding the invitation's row lock makes both requests wait, so they
        # run at the same time once it is released.
        Repo.one!(
          from(i in OrganizationsInvitation, where: i.id == ^invitation.id, lock: "FOR UPDATE")
        )

        tasks = [
          in_own_session(fn -> Organizations.accept_invitation(invitation.token, user.id) end),
          in_own_session(fn ->
            Organizations.resend_invitation(organization.id, invitation.id)
          end)
        ]

        await_lock_waiters(2)
        tasks
      end)

    results = Task.await_many(tasks, 10_000)
    member? = Organizations.get_organizations_user(organization.id, user.id) != nil

    case results do
      [{:ok, _}, {:error, :already_accepted}] ->
        assert member?

      [{:error, "Invalid token"}, {:ok, resent}] ->
        refute member?
        assert [notification] = invitation_notifications(user)
        assert notification.metadata["token"] == resent.token

      results ->
        flunk("Unexpected results: #{inspect(results)}")
    end
  end

  test "a resend in another session waits for the one being delivered", %{
    organization: organization,
    user: user,
    invitation: invitation
  } do
    {:ok, {first, second}} =
      Repo.transaction(fn ->
        Repo.one!(
          from(i in OrganizationsInvitation, where: i.id == ^invitation.id, lock: "FOR UPDATE")
        )

        # The first resend takes the invitation lock and waits for the row.
        first =
          in_own_session(fn ->
            Organizations.resend_invitation(organization.id, invitation.id)
          end)

        await_lock_waiters(1)

        # The second cannot take the invitation lock while the first delivers,
        # and gives up without holding a connection.
        second =
          in_own_session(fn ->
            Organizations.resend_invitation(organization.id, invitation.id)
          end)

        assert {:error, :busy} = Task.await(second, 5_000)
        {first, :busy}
      end)

    assert second == :busy
    assert {:ok, resent} = Task.await(first, 5_000)

    assert [notification] = invitation_notifications(user)
    assert notification.metadata["token"] == resent.token
    assert Repo.get_by!(OrganizationsInvitation, id: invitation.id).token == resent.token
  end
end
