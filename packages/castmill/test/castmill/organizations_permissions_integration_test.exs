defmodule Castmill.OrganizationsPermissionsIntegrationTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures

  alias Castmill.Organizations
  alias Castmill.Accounts
  alias Castmill.Authorization.Permissions

  @resource_types ["playlists", "medias", "channels", "devices", "teams", "widgets"]
  @controller_actions [:index, :show, :create, :update, :delete]

  describe "has_access/4 with permission matrix integration" do
    setup do
      # Create a network first (required for organizations)
      network = network_fixture()

      # Create test organization
      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Test Organization",
          network_id: network.id
        })

      # Create test users
      {:ok, admin_user} =
        Accounts.create_user(%{
          email: "admin@test.com",
          name: "Admin User",
          network_id: network.id
        })

      {:ok, manager_user} =
        Accounts.create_user(%{
          email: "manager@test.com",
          name: "Manager User",
          network_id: network.id
        })

      {:ok, member_user} =
        Accounts.create_user(%{
          email: "member@test.com",
          name: "Member User",
          network_id: network.id
        })

      {:ok, guest_user} =
        Accounts.create_user(%{
          email: "guest@test.com",
          name: "Guest User",
          network_id: network.id
        })

      # Assign roles
      {:ok, _} = Organizations.set_user_role(organization.id, admin_user.id, :admin)
      {:ok, _} = Organizations.set_user_role(organization.id, manager_user.id, :manager)
      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

      %{
        organization: organization,
        admin_user: admin_user,
        manager_user: manager_user,
        member_user: member_user,
        guest_user: guest_user,
        network: network
      }
    end

    # ========================================================================
    # Matrix-driven Role Assertions
    # ========================================================================

    test "member permissions align with permission matrix", %{
      organization: org,
      member_user: user
    } do
      assert_role_matches_matrix(:member, org.id, user.id)
    end

    test "admin permissions align with permission matrix", %{organization: org, admin_user: user} do
      assert_role_matches_matrix(:admin, org.id, user.id)
    end

    test "manager permissions align with permission matrix", %{
      organization: org,
      manager_user: user
    } do
      assert_role_matches_matrix(:manager, org.id, user.id)
    end

    test "guest permissions align with permission matrix", %{organization: org, guest_user: user} do
      assert_role_matches_matrix(:guest, org.id, user.id)
    end

    # ========================================================================
    # Edge Cases & Action Conversion Tests
    # ========================================================================

    test "handles string and atom actions correctly", %{organization: org, member_user: user} do
      for action <- ["index", :index, "create", :create] do
        expected = Permissions.can?(:member, :playlists, controller_action_to_matrix(action))
        assert Organizations.has_access(org.id, user.id, "playlists", action) == expected
      end
    end

    test "returns false for user with no role", %{organization: org, network: network} do
      {:ok, no_role_user} =
        Accounts.create_user(%{
          email: "norole@test.com",
          name: "No Role User",
          network_id: network.id
        })

      # User not added to organization, so no role
      refute Organizations.has_access(org.id, no_role_user.id, "playlists", :index)
      refute Organizations.has_access(org.id, no_role_user.id, "medias", :create)
    end

    test "falls back to legacy behavior for unknown resource type", %{
      organization: org,
      admin_user: admin,
      guest_user: guest
    } do
      # Admins still pass through legacy fallback logic
      assert Organizations.has_access(org.id, admin.id, "unknown_resource", :index)

      # Non-admins rely on explicit permissions or database grants
      refute Organizations.has_access(org.id, guest.id, "unknown_resource", :index)
    end

    # ========================================================================
    # Backward Compatibility Tests
    # ========================================================================

    test "database permissions still work as fallback", %{organization: org, network: network} do
      {:ok, db_user} =
        Accounts.create_user(%{
          email: "dbperm@test.com",
          name: "DB Permission User",
          network_id: network.id
        })

      # Give user explicit database permission (old system)
      Organizations.give_access(org.id, db_user.id, "custom_resource", "read")

      # Should work via database fallback
      assert Organizations.has_access(org.id, db_user.id, "custom_resource", :read)
    end

    # ========================================================================
    # Performance Regression Tests
    # ========================================================================

    test "permission checks are fast (no unnecessary DB queries)", %{
      organization: org,
      member_user: user
    } do
      # This test ensures we're using the matrix, not hitting DB for every check
      # Run 100 permission checks - should be very fast
      start_time = System.monotonic_time(:millisecond)

      for _ <- 1..100 do
        Organizations.has_access(org.id, user.id, "playlists", :index)
      end

      end_time = System.monotonic_time(:millisecond)
      duration = end_time - start_time

      # Should complete in under 200ms (would be several seconds if hitting DB each time)
      # This is a reasonable threshold that accounts for varying machine performance
      assert duration < 200, "Permission checks took #{duration}ms, should be < 200ms"
    end
  end

  describe "has_access/4 with special cases" do
    setup do
      network = network_fixture()

      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Special Test Org",
          pincode: "5678",
          network_id: network.id
        })

      {:ok, manager_user} =
        Accounts.create_user(%{
          email: "manager_special@test.com",
          name: "Special Manager",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, manager_user.id, :manager)

      %{organization: organization, manager_user: manager_user, network: network}
    end

    test "manager can create teams (legacy special case still works)",
         %{organization: org, manager_user: user} do
      # This was a special case in the old code, should still work
      assert Organizations.has_access(org.id, user.id, "teams", :create)
    end
  end

  defp assert_role_matches_matrix(role, organization_id, user_id) do
    Enum.each(@resource_types, fn resource ->
      resource_atom = resource_to_atom(resource)

      Enum.each(@controller_actions, fn action ->
        matrix_action = controller_action_to_matrix(action)
        expected = Permissions.can?(role, resource_atom, matrix_action)
        result = Organizations.has_access(organization_id, user_id, resource, action)

        message =
          case expected do
            true -> "#{role} should have #{action} access to #{resource}"
            false -> "#{role} should NOT have #{action} access to #{resource}"
          end

        if expected do
          assert result, message
        else
          refute result, message
        end
      end)
    end)
  end

  defp resource_to_atom("playlists"), do: :playlists
  defp resource_to_atom("medias"), do: :medias
  defp resource_to_atom("channels"), do: :channels
  defp resource_to_atom("devices"), do: :devices
  defp resource_to_atom("teams"), do: :teams
  defp resource_to_atom("widgets"), do: :widgets

  defp controller_action_to_matrix(:index), do: :list
  defp controller_action_to_matrix("index"), do: :list
  defp controller_action_to_matrix(:show), do: :show
  defp controller_action_to_matrix("show"), do: :show
  defp controller_action_to_matrix(:create), do: :create
  defp controller_action_to_matrix("create"), do: :create
  defp controller_action_to_matrix(:update), do: :update
  defp controller_action_to_matrix("update"), do: :update
  defp controller_action_to_matrix(:delete), do: :delete
  defp controller_action_to_matrix("delete"), do: :delete
  defp controller_action_to_matrix(action) when is_atom(action), do: action
  defp controller_action_to_matrix(action) when is_binary(action), do: String.to_atom(action)
end
