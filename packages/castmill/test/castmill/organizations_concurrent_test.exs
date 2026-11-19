defmodule Castmill.OrganizationsConcurrentTest do
  use Castmill.DataCase
  import Ecto.Query

  alias Castmill.Organizations

  describe "concurrent organization creation atomicity" do
    setup do
      network = Castmill.NetworksFixtures.network_fixture()
      %{network: network}
    end

    test "prevents race condition when creating organizations with same case-insensitive name concurrently",
         %{network: network} do
      # Simulate concurrent requests trying to create organizations with the same name (different case)
      tasks = [
        Task.async(fn ->
          Organizations.create_organization(%{
            name: "Acme Corp",
            network_id: network.id
          })
        end),
        Task.async(fn ->
          Organizations.create_organization(%{
            name: "ACME CORP",
            network_id: network.id
          })
        end),
        Task.async(fn ->
          Organizations.create_organization(%{
            name: "acme corp",
            network_id: network.id
          })
        end)
      ]

      # Wait for all tasks to complete
      results = Task.await_many(tasks, 5000)

      # Count successes and failures
      {successes, failures} =
        Enum.split_with(results, fn
          {:ok, _} -> true
          {:error, _} -> false
        end)

      # Exactly one should succeed, the others should fail with uniqueness constraint
      assert length(successes) == 1, "Expected exactly 1 success, got #{length(successes)}"
      assert length(failures) == 2, "Expected exactly 2 failures, got #{length(failures)}"

      # Verify the failures are due to name uniqueness
      Enum.each(failures, fn {:error, changeset} ->
        assert {"has already been taken", _} = changeset.errors[:name]
      end)

      # Verify only one organization exists with this name (case-insensitive)
      # Query directly to get all organizations in this network
      organizations =
        from(o in Castmill.Organizations.Organization,
          where: o.network_id == ^network.id
        )
        |> Castmill.Repo.all()

      names_lower = Enum.map(organizations, fn org -> String.downcase(org.name) end)
      assert Enum.count(names_lower, fn name -> name == "acme corp" end) == 1
    end

    test "allows concurrent creation of organizations with different names", %{network: network} do
      # Create multiple organizations with different names concurrently
      tasks = [
        Task.async(fn ->
          Organizations.create_organization(%{
            name: "Company A",
            network_id: network.id
          })
        end),
        Task.async(fn ->
          Organizations.create_organization(%{
            name: "Company B",
            network_id: network.id
          })
        end),
        Task.async(fn ->
          Organizations.create_organization(%{
            name: "Company C",
            network_id: network.id
          })
        end)
      ]

      results = Task.await_many(tasks, 5000)

      # All should succeed
      successes =
        Enum.filter(results, fn
          {:ok, _} -> true
          _ -> false
        end)

      assert length(successes) == 3, "Expected all 3 to succeed"
    end

    test "prevents race condition when updating to conflicting names concurrently", %{
      network: network
    } do
      # Create two organizations
      {:ok, org1} =
        Organizations.create_organization(%{name: "Original A", network_id: network.id})

      {:ok, org2} =
        Organizations.create_organization(%{name: "Original B", network_id: network.id})

      # Try to update both to the same name concurrently
      tasks = [
        Task.async(fn ->
          Organizations.update_organization(org1, %{name: "Target Name"})
        end),
        Task.async(fn ->
          Organizations.update_organization(org2, %{name: "TARGET NAME"})
        end)
      ]

      results = Task.await_many(tasks, 5000)

      # One should succeed, one should fail
      {successes, failures} =
        Enum.split_with(results, fn
          {:ok, _} -> true
          {:error, _} -> false
        end)

      assert length(successes) == 1, "Expected exactly 1 success"
      assert length(failures) == 1, "Expected exactly 1 failure"

      # Verify only one has the target name (check both organizations)
      reloaded_org1 = Organizations.get_organization!(org1.id)
      reloaded_org2 = Organizations.get_organization!(org2.id)

      names_lower = [String.downcase(reloaded_org1.name), String.downcase(reloaded_org2.name)]
      target_count = Enum.count(names_lower, fn name -> name == "target name" end)
      assert target_count == 1
    end
  end
end
