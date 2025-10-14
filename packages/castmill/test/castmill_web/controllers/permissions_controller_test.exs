defmodule CastmillWeb.PermissionsControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures

  alias Castmill.Organizations
  alias Castmill.Accounts

  describe "GET /dashboard/organizations/:organization_id/permissions" do
    setup do
      network = network_fixture()

      {:ok, organization} =
        Organizations.create_organization(%{
          name: "Test Organization",
          network_id: network.id
        })

      {:ok, admin_user} =
        Accounts.create_user(%{
          email: "admin@test.com",
          name: "Admin User",
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

      {:ok, _} = Organizations.set_user_role(organization.id, admin_user.id, :admin)
      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

      %{
        organization: organization,
        admin_user: admin_user,
        member_user: member_user,
        guest_user: guest_user,
        network: network
      }
    end

    test "returns permissions matrix for admin user", %{
      conn: conn,
      organization: org,
      admin_user: user
    } do
      conn =
        conn
        |> assign(:current_user, user)
        |> get("/dashboard/organizations/#{org.id}/permissions")

      assert %{
               "role" => "admin",
               "permissions" => permissions,
               "resources" => resources
             } = json_response(conn, 200)

      # Admin should have full access to all resources
      assert permissions["playlists"] == ["list", "show", "create", "update", "delete", "publish"]
      assert permissions["medias"] == ["list", "show", "create", "update", "delete"]
      assert permissions["channels"] == ["list", "show", "create", "update", "delete", "publish"]
      assert permissions["devices"] == ["list", "show", "create", "update", "delete"]
      assert permissions["teams"] == ["list", "show", "create", "update", "delete"]
      assert permissions["widgets"] == ["list", "show", "create", "update", "delete"]

      # All resources should be accessible
      assert "playlists" in resources
      assert "medias" in resources
      assert "channels" in resources
      assert "devices" in resources
      assert "teams" in resources
      assert "widgets" in resources
    end

    test "returns permissions matrix for member user", %{
      conn: conn,
      organization: org,
      member_user: user
    } do
      conn =
        conn
        |> assign(:current_user, user)
        |> get("/dashboard/organizations/#{org.id}/permissions")

      assert %{
               "role" => "member",
               "permissions" => permissions,
               "resources" => resources
             } = json_response(conn, 200)

      # Member user should have full CRUD on content resources
      assert permissions["playlists"] == ["list", "show", "create", "update", "delete"]
      assert permissions["medias"] == ["list", "show", "create", "update", "delete"]
      assert permissions["channels"] == ["list", "show", "update"]
      assert permissions["devices"] == ["list", "show", "update"]

      # Member user should have read-only on teams and widgets
      assert permissions["teams"] == ["list", "show"]
      assert permissions["widgets"] == ["list", "show"]

      # All resources should be listed
      assert "playlists" in resources
      assert "teams" in resources
    end

    test "returns permissions matrix for guest user", %{
      conn: conn,
      organization: org,
      guest_user: user
    } do
      conn =
        conn
        |> assign(:current_user, user)
        |> get("/dashboard/organizations/#{org.id}/permissions")

      assert %{
               "role" => "guest",
               "permissions" => permissions,
               "resources" => resources
             } = json_response(conn, 200)

      # Guest should have read-only on content resources
      assert permissions["playlists"] == ["list", "show"]
      assert permissions["medias"] == ["list", "show"]
      assert permissions["channels"] == ["list", "show"]
      assert permissions["devices"] == ["list", "show"]

      # Guest should have read-only access to teams and organizations
      assert permissions["teams"] == ["list", "show"]
      assert permissions["organizations"] == ["list", "show"]

      # Guest should have access to all resources in read-only mode
      assert "playlists" in resources
      assert "teams" in resources
      assert "organizations" in resources
    end

    test "returns 401 when user is not authenticated", %{organization: org} do
      conn = build_conn()
      conn = get(conn, "/dashboard/organizations/#{org.id}/permissions")

      # The authentication middleware will catch this
      assert conn.status in [401, 403]
    end

    test "returns 403 when user is not a member of the organization", %{
      conn: conn,
      organization: org,
      network: network
    } do
      {:ok, other_user} =
        Accounts.create_user(%{
          email: "other@test.com",
          name: "Other User",
          network_id: network.id
        })

      conn =
        conn
        |> assign(:current_user, other_user)
        |> get("/dashboard/organizations/#{org.id}/permissions")

      assert json_response(conn, 403) == %{"error" => "User is not a member of this organization"}
    end
  end
end
