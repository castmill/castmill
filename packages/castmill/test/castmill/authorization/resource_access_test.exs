defmodule Castmill.Authorization.ResourceAccessTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures

  alias Castmill.Authorization.ResourceAccess
  alias Castmill.Organizations
  alias Castmill.Accounts

  describe "check_resource_access/4" do
    setup do
      network = network_fixture()

      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Resource Test Org",
          network_id: network.id
        })

      {:ok, admin_user} =
        Accounts.create_user(%{
          email: "admin_resource@test.com",
          name: "Admin User",
          network_id: network.id
        })

      {:ok, member_user} =
        Accounts.create_user(%{
          email: "member_resource@test.com",
          name: "Member User",
          network_id: network.id
        })

      {:ok, guest_user} =
        Accounts.create_user(%{
          email: "guest_resource@test.com",
          name: "Guest User",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, admin_user.id, :admin)
      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

      %{
        organization: organization,
        admin_user: admin_user,
        member_user: member_user,
        guest_user: guest_user
      }
    end

    test "returns {:ok, true} when user has permission", %{organization: org, member_user: user} do
      assert {:ok, true} =
               ResourceAccess.check_resource_access(user.id, org.id, :playlists, :create)
    end

    test "returns {:ok, false} when user lacks permission", %{organization: org, guest_user: user} do
      assert {:ok, false} =
               ResourceAccess.check_resource_access(user.id, org.id, :playlists, :create)
    end

    test "member permissions reflect matrix", %{organization: org, member_user: user} do
      assert {:ok, true} =
               ResourceAccess.check_resource_access(user.id, org.id, :playlists, :create)

      assert {:ok, true} =
               ResourceAccess.check_resource_access(user.id, org.id, :playlists, :update)

      assert {:ok, true} =
               ResourceAccess.check_resource_access(user.id, org.id, :playlists, :delete)

      assert {:ok, true} = ResourceAccess.check_resource_access(user.id, org.id, :medias, :create)
      assert {:ok, true} = ResourceAccess.check_resource_access(user.id, org.id, :medias, :update)
      assert {:ok, true} = ResourceAccess.check_resource_access(user.id, org.id, :medias, :delete)

      assert {:ok, true} = ResourceAccess.check_resource_access(user.id, org.id, :channels, :list)
      assert {:ok, true} = ResourceAccess.check_resource_access(user.id, org.id, :channels, :show)

      assert {:ok, true} =
               ResourceAccess.check_resource_access(user.id, org.id, :channels, :update)

      assert {:ok, false} =
               ResourceAccess.check_resource_access(user.id, org.id, :channels, :create)

      assert {:ok, false} =
               ResourceAccess.check_resource_access(user.id, org.id, :channels, :delete)

      assert {:ok, true} = ResourceAccess.check_resource_access(user.id, org.id, :devices, :list)
      assert {:ok, true} = ResourceAccess.check_resource_access(user.id, org.id, :devices, :show)

      assert {:ok, true} =
               ResourceAccess.check_resource_access(user.id, org.id, :devices, :update)

      assert {:ok, false} =
               ResourceAccess.check_resource_access(user.id, org.id, :devices, :create)

      assert {:ok, false} =
               ResourceAccess.check_resource_access(user.id, org.id, :devices, :delete)
    end

    test "guest user has read-only access to content", %{organization: org, guest_user: user} do
      resources = [:playlists, :medias, :channels, :devices]

      for resource <- resources do
        assert {:ok, true} =
                 ResourceAccess.check_resource_access(user.id, org.id, resource, :list)

        assert {:ok, true} =
                 ResourceAccess.check_resource_access(user.id, org.id, resource, :show)

        assert {:ok, false} =
                 ResourceAccess.check_resource_access(user.id, org.id, resource, :create)
      end
    end
  end

  describe "has_any_resource_access?/3" do
    setup do
      network = network_fixture()

      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Access Check Org",
          network_id: network.id
        })

      {:ok, member_user} =
        Accounts.create_user(%{
          email: "member_any@test.com",
          name: "Member User",
          network_id: network.id
        })

      {:ok, guest_user} =
        Accounts.create_user(%{
          email: "guest_any@test.com",
          name: "Guest User",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

      %{organization: organization, member_user: member_user, guest_user: guest_user}
    end

    test "returns true when user has any access to resource", %{
      organization: org,
      member_user: user
    } do
      assert ResourceAccess.has_any_resource_access?(user.id, org.id, :playlists)
      # Read access
      assert ResourceAccess.has_any_resource_access?(user.id, org.id, :teams)
    end

    test "returns false when user has no access to resource", %{
      organization: org,
      guest_user: user
    } do
      refute ResourceAccess.has_any_resource_access?(user.id, org.id, :unknown_resource)
    end
  end

  describe "accessible_resource_types/2" do
    setup do
      network = network_fixture()

      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Accessible Resources Org",
          network_id: network.id
        })

      {:ok, member_user} =
        Accounts.create_user(%{
          email: "member_accessible@test.com",
          name: "Member User",
          network_id: network.id
        })

      {:ok, guest_user} =
        Accounts.create_user(%{
          email: "guest_accessible@test.com",
          name: "Guest User",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

      %{organization: organization, member_user: member_user, guest_user: guest_user}
    end

    test "returns all accessible resources for member", %{organization: org, member_user: user} do
      resources = ResourceAccess.accessible_resource_types(user.id, org.id)

      assert :playlists in resources
      assert :medias in resources
      assert :channels in resources
      assert :devices in resources
      assert :teams in resources
      assert :widgets in resources
      assert :organizations in resources
    end

    test "returns accessible resources for guest user", %{organization: org, guest_user: user} do
      resources = ResourceAccess.accessible_resource_types(user.id, org.id)

      assert :playlists in resources
      assert :medias in resources
      assert :teams in resources
      assert :organizations in resources
    end
  end

  describe "allowed_resource_actions/3" do
    setup do
      network = network_fixture()

      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Allowed Actions Org",
          network_id: network.id
        })

      {:ok, member_user} =
        Accounts.create_user(%{
          email: "member_actions@test.com",
          name: "Member User",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)

      %{organization: organization, member_user: member_user}
    end

    test "returns all allowed actions for member on playlists", %{
      organization: org,
      member_user: user
    } do
      actions = ResourceAccess.allowed_resource_actions(user.id, org.id, :playlists)

      assert :list in actions
      assert :show in actions
      assert :create in actions
      assert :update in actions
      assert :delete in actions
    end

    test "returns limited actions for member on teams", %{organization: org, member_user: user} do
      actions = ResourceAccess.allowed_resource_actions(user.id, org.id, :teams)

      assert :list in actions
      assert :show in actions
      refute :create in actions
      refute :update in actions
      refute :delete in actions
    end

    test "returns update-only actions for member on channels", %{
      organization: org,
      member_user: user
    } do
      actions = ResourceAccess.allowed_resource_actions(user.id, org.id, :channels)

      assert :list in actions
      assert :show in actions
      assert :update in actions
      refute :create in actions
      refute :delete in actions
    end
  end

  describe "check_multiple_actions/4" do
    setup do
      network = network_fixture()

      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Multiple Actions Org",
          network_id: network.id
        })

      {:ok, member_user} =
        Accounts.create_user(%{
          email: "member_multi@test.com",
          name: "Member User",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)

      %{organization: organization, member_user: member_user}
    end

    test "returns map of action permissions for playlists", %{
      organization: org,
      member_user: user
    } do
      result =
        ResourceAccess.check_multiple_actions(user.id, org.id, :playlists, [
          :create,
          :update,
          :delete
        ])

      assert result[:create] == true
      assert result[:update] == true
      assert result[:delete] == true
    end

    test "returns map of action permissions for teams", %{organization: org, member_user: user} do
      result =
        ResourceAccess.check_multiple_actions(user.id, org.id, :teams, [:create, :update, :delete])

      assert result[:create] == false
      assert result[:update] == false
      assert result[:delete] == false
    end

    test "returns all false for user with no role", %{organization: org} do
      network = network_fixture()

      {:ok, no_role_user} =
        Accounts.create_user(%{
          email: "norole_multi@test.com",
          name: "No Role User",
          network_id: network.id
        })

      result =
        ResourceAccess.check_multiple_actions(no_role_user.id, org.id, :playlists, [
          :create,
          :update
        ])

      assert result[:create] == false
      assert result[:update] == false
    end
  end
end
