defmodule Castmill.NetworkDeviceLimitLockingTest do
  @moduledoc """
  Registrations in different organizations of a network are serialized on
  the network row, so together they cannot exceed its device limit. Runs
  outside the SQL sandbox so the sessions see each other's data; it deletes
  what it creates.
  """
  use ExUnit.Case, async: false

  import Ecto.Query
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.{Devices, Networks, Quotas, Repo}
  alias Ecto.Adapters.SQL.Sandbox

  setup do
    :ok = Sandbox.checkout(Repo, sandbox: false)

    network = network_fixture()
    suffix = System.unique_integer([:positive])
    org_a = organization_fixture(%{network: network, name: "Limit A #{suffix}"})
    org_b = organization_fixture(%{network: network, name: "Limit B #{suffix}"})

    for org <- [org_a, org_b], do: Quotas.add_quota_to_organization(org.id, :devices, 10)
    {:ok, network} = Networks.set_device_limit(network, 1)

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      org_ids = [org_a.id, org_b.id]
      Repo.delete_all(from(d in Castmill.Devices.Device, where: d.organization_id in ^org_ids))

      Repo.delete_all(
        from(o in Castmill.Organizations.Organization, where: o.network_id == ^network.id)
      )

      Repo.delete_all(from(n in Castmill.Networks.Network, where: n.id == ^network.id))
    end)

    %{network: network, org_a: org_a, org_b: org_b}
  end

  defp attrs(organization) do
    %{
      organization_id: organization.id,
      name: "Screen",
      last_ip: "10.0.0.1",
      hardware_id: "hw-#{System.unique_integer([:positive])}",
      token: "token-#{System.unique_integer([:positive])}",
      user_agent: "test",
      timezone: "Europe/Stockholm",
      version: "1.0.0"
    }
  end

  defp register_in_own_session(organization) do
    Task.async(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      Devices.create_device(attrs(organization))
    end)
  end

  defp await_lock_waiters(count, attempts \\ 100) do
    %{rows: [[waiting]]} = Repo.query!("SELECT count(*) FROM pg_locks WHERE NOT granted")

    cond do
      waiting >= count -> :ok
      attempts == 0 -> flunk("Expected #{count} sessions waiting for a lock, got #{waiting}")
      true -> Process.sleep(20) && await_lock_waiters(count, attempts - 1)
    end
  end

  test "two organizations registering the last device at once: only one succeeds", %{
    network: network,
    org_a: org_a,
    org_b: org_b
  } do
    # Hold the network row in another session so both registrations queue up.
    {:ok, holder} =
      Repo.config()
      |> Keyword.take([:hostname, :port, :username, :password, :database])
      |> Postgrex.start_link()

    Postgrex.query!(holder, "BEGIN", [])

    Postgrex.query!(
      holder,
      "SELECT id FROM networks WHERE id = $1 FOR NO KEY UPDATE",
      [Ecto.UUID.dump!(network.id)]
    )

    tasks = [register_in_own_session(org_a), register_in_own_session(org_b)]
    await_lock_waiters(2)
    Postgrex.query!(holder, "COMMIT", [])

    results = Task.await_many(tasks, 10_000)

    assert Enum.count(results, &match?({:ok, _}, &1)) == 1
    assert Enum.count(results, &(&1 == {:error, :quota_exceeded})) == 1
    assert Devices.count_network_devices(network.id) == 1
  end
end
