defmodule Castmill.Authorization.PermissionsTest do
  use ExUnit.Case, async: true

  alias Castmill.Authorization.Permissions

  describe "can?/3" do
    test "admin has full access to all resources" do
      assert Permissions.can?(:admin, :playlists, :create)
      assert Permissions.can?(:admin, :playlists, :delete)
      assert Permissions.can?(:admin, :medias, :update)
      assert Permissions.can?(:admin, :channels, :create)
      assert Permissions.can?(:admin, :devices, :delete)
      assert Permissions.can?(:admin, :teams, :create)
      assert Permissions.can?(:admin, :teams, :delete)
      assert Permissions.can?(:admin, :widgets, :update)
    end

    test "manager has full access to content and teams" do
      assert Permissions.can?(:manager, :playlists, :create)
      assert Permissions.can?(:manager, :medias, :update)
      assert Permissions.can?(:manager, :channels, :delete)
      assert Permissions.can?(:manager, :devices, :create)
      assert Permissions.can?(:manager, :teams, :create)
      assert Permissions.can?(:manager, :teams, :delete)
    end

    test "member can manage playlists and medias" do
      assert Permissions.can?(:member, :playlists, :create)
      assert Permissions.can?(:member, :playlists, :update)
      assert Permissions.can?(:member, :playlists, :delete)
      refute Permissions.can?(:member, :playlists, :publish)

      assert Permissions.can?(:member, :medias, :create)
      assert Permissions.can?(:member, :medias, :update)
      assert Permissions.can?(:member, :medias, :delete)
    end

    test "member has limited access to channels and devices" do
      assert Permissions.can?(:member, :channels, :list)
      assert Permissions.can?(:member, :channels, :show)
      assert Permissions.can?(:member, :channels, :update)
      refute Permissions.can?(:member, :channels, :create)
      refute Permissions.can?(:member, :channels, :delete)

      assert Permissions.can?(:member, :devices, :list)
      assert Permissions.can?(:member, :devices, :show)
      assert Permissions.can?(:member, :devices, :update)
      refute Permissions.can?(:member, :devices, :create)
      refute Permissions.can?(:member, :devices, :delete)
    end

    test "member has read-only access to teams and widgets" do
      assert Permissions.can?(:member, :teams, :list)
      assert Permissions.can?(:member, :teams, :show)
      refute Permissions.can?(:member, :teams, :create)
      refute Permissions.can?(:member, :teams, :update)
      refute Permissions.can?(:member, :teams, :delete)

      assert Permissions.can?(:member, :widgets, :list)
      assert Permissions.can?(:member, :widgets, :show)
      refute Permissions.can?(:member, :widgets, :create)
    end

    test "guest has read-only access to content resources" do
      assert Permissions.can?(:guest, :playlists, :list)
      assert Permissions.can?(:guest, :playlists, :show)
      refute Permissions.can?(:guest, :playlists, :create)
      refute Permissions.can?(:guest, :playlists, :update)
      refute Permissions.can?(:guest, :playlists, :delete)

      assert Permissions.can?(:guest, :medias, :show)
      refute Permissions.can?(:guest, :medias, :delete)
    end

    test "guest has read-only access to teams" do
      assert Permissions.can?(:guest, :teams, :list)
      assert Permissions.can?(:guest, :teams, :show)
      refute Permissions.can?(:guest, :teams, :create)
      refute Permissions.can?(:guest, :teams, :update)
      refute Permissions.can?(:guest, :teams, :delete)
    end

    test "returns false for invalid role" do
      refute Permissions.can?(:invalid_role, :playlists, :create)
    end

    test "returns false for invalid resource" do
      refute Permissions.can?(:admin, :invalid_resource, :create)
    end
  end

  describe "allowed_actions/2" do
    test "returns all actions for admin on any resource" do
      assert Permissions.allowed_actions(:admin, :playlists) ==
               [:list, :show, :create, :update, :delete, :publish]

      assert Permissions.allowed_actions(:admin, :channels) ==
               [:list, :show, :create, :update, :delete, :publish]
    end

    test "returns limited actions for member on teams" do
      assert Permissions.allowed_actions(:member, :teams) == [:list, :show]
    end

    test "returns update-only actions for member on channels" do
      assert Permissions.allowed_actions(:member, :channels) == [:list, :show, :update]
    end

    test "returns read-only actions for guest on teams" do
      assert Permissions.allowed_actions(:guest, :teams) == [:list, :show]
    end

    test "returns empty list for invalid role" do
      assert Permissions.allowed_actions(:invalid, :playlists) == []
    end
  end

  describe "accessible_resources/1" do
    test "admin can access all resources" do
      resources = Permissions.accessible_resources(:admin)
      assert :playlists in resources
      assert :medias in resources
      assert :channels in resources
      assert :devices in resources
      assert :teams in resources
      assert :widgets in resources
    end

    test "member can access all resources (including read-only teams)" do
      resources = Permissions.accessible_resources(:member)
      assert :playlists in resources
      # Has read access
      assert :teams in resources
      assert :widgets in resources
      assert :organizations in resources
    end

    test "guest can access teams in read-only mode" do
      resources = Permissions.accessible_resources(:guest)
      assert :playlists in resources
      # Has read access
      assert :teams in resources
      # Has read access
      assert :organizations in resources
    end

    test "returns empty list for invalid role" do
      assert Permissions.accessible_resources(:invalid) == []
    end
  end

  describe "has_any_access?/2" do
    test "returns true when role has at least one action" do
      assert Permissions.has_any_access?(:member, :playlists)
      # Has read access
      assert Permissions.has_any_access?(:member, :teams)
      assert Permissions.has_any_access?(:guest, :medias)
      # Guests now have read access
      assert Permissions.has_any_access?(:guest, :teams)
    end

    test "returns false for resource with no permissions" do
      # All current roles have access to all resources
      # This test would need a role without any resource access
      refute Permissions.has_any_access?(:invalid_role, :teams)
    end

    test "returns false for invalid role or resource" do
      refute Permissions.has_any_access?(:invalid, :playlists)
      refute Permissions.has_any_access?(:admin, :invalid)
    end
  end

  describe "role_permissions/1" do
    test "returns full permission map for role" do
      perms = Permissions.role_permissions(:member)
      assert is_map(perms)
      assert Map.has_key?(perms, :playlists)
      assert Map.has_key?(perms, :teams)
      assert perms[:teams] == [:list, :show]
    end

    test "returns empty map for invalid role" do
      assert Permissions.role_permissions(:invalid) == %{}
    end
  end

  describe "all_roles/0" do
    test "returns all defined roles" do
      roles = Permissions.all_roles()
      assert :admin in roles
      assert :manager in roles
      assert :member in roles
      assert :editor in roles
      assert :publisher in roles
      assert :device_manager in roles
      assert :guest in roles
    end
  end

  describe "all_resource_types/0" do
    test "returns all defined resource types" do
      resources = Permissions.all_resource_types()
      assert :playlists in resources
      assert :medias in resources
      assert :channels in resources
      assert :devices in resources
      assert :teams in resources
      assert :widgets in resources
    end
  end

  describe "valid_role?/1" do
    test "returns true for valid roles" do
      assert Permissions.valid_role?(:admin)
      assert Permissions.valid_role?(:manager)
      assert Permissions.valid_role?(:member)
      assert Permissions.valid_role?(:guest)
    end

    test "returns false for invalid roles" do
      refute Permissions.valid_role?(:invalid)
      refute Permissions.valid_role?(:superuser)
    end
  end

  describe "valid_resource_type?/1" do
    test "returns true for valid resource types" do
      assert Permissions.valid_resource_type?(:playlists)
      assert Permissions.valid_resource_type?(:teams)
      assert Permissions.valid_resource_type?(:widgets)
      assert Permissions.valid_resource_type?(:organizations)
    end

    test "returns false for invalid resource types" do
      refute Permissions.valid_resource_type?(:invalid)
      refute Permissions.valid_resource_type?(:schedules)
    end
  end

  describe "organizations resource" do
    test "admin has full access to organizations" do
      assert Permissions.can?(:admin, :organizations, :create)
      assert Permissions.can?(:admin, :organizations, :update)
      assert Permissions.can?(:admin, :organizations, :delete)
    end

    test "manager has read-only access to organizations" do
      assert Permissions.can?(:manager, :organizations, :list)
      assert Permissions.can?(:manager, :organizations, :show)
      refute Permissions.can?(:manager, :organizations, :create)
      refute Permissions.can?(:manager, :organizations, :update)
    end

    test "member has read-only access to organizations" do
      assert Permissions.can?(:member, :organizations, :list)
      assert Permissions.can?(:member, :organizations, :show)
      refute Permissions.can?(:member, :organizations, :create)
    end

    test "guest has read-only access to organizations" do
      assert Permissions.can?(:guest, :organizations, :list)
      assert Permissions.can?(:guest, :organizations, :show)
      refute Permissions.can?(:guest, :organizations, :create)
    end
  end
end
