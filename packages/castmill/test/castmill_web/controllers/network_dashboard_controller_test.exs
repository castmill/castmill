defmodule CastmillWeb.NetworkDashboardControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Accounts
  alias Castmill.Organizations
  alias Castmill.Networks
  alias Castmill.Repo
  alias Castmill.Widgets

  # Helper to create a network admin user
  defp create_network_admin(network) do
    {:ok, user} =
      Accounts.create_user(%{
        email: "admin_#{System.unique_integer([:positive])}@example.com",
        name: "Network Admin"
      })

    # Add user to network as admin via networks_users
    {:ok, _} = Networks.add_user_to_network(user.id, network.id, :admin)

    user
  end

  # Helper to create a regular user (not a network admin)
  defp create_regular_user(network, organization) do
    unique_id = System.unique_integer([:positive])

    {:ok, user} =
      Accounts.create_user(%{
        email: "regular_#{unique_id}@example.com",
        name: "Regular User #{unique_id}"
      })

    # Add user to network as member
    {:ok, _} = Networks.add_user_to_network(user.id, network.id)

    # Add user to organization
    Organizations.add_user(organization.id, user.id, :member)

    user
  end

  # Helper to authenticate a connection with a user
  defp authenticate_conn(conn, user, network) do
    conn
    |> Plug.Test.init_test_session(user_id: user.id)
    |> assign(:current_user, user)
    |> put_req_header("accept", "application/json")
    |> put_req_header("origin", network.domain)
  end

  describe "check_admin_status/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, network: network, organization: organization}
    end

    test "returns is_admin: true for network admin", %{conn: conn, network: network} do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn = get(conn, "/dashboard/network/admin-status")

      assert json_response(conn, 200) == %{
               "is_admin" => true,
               "network_id" => network.id,
               "access" => "admin"
             }
    end

    test "returns is_admin: false for regular user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn = get(conn, "/dashboard/network/admin-status")

      assert json_response(conn, 200) == %{
               "is_admin" => false,
               "network_id" => nil
             }
    end

    test "returns 401 for unauthenticated user", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", "application/json")
        |> get("/dashboard/network/admin-status")

      assert json_response(conn, 401)
    end
  end

  describe "show_settings/2" do
    setup do
      network =
        network_fixture(%{
          name: "Test Network",
          email: "support@test.com",
          domain: "test.example.com"
        })

      organization = organization_fixture(%{network_id: network.id})

      {:ok, network: network, organization: organization}
    end

    test "returns network settings for network admin", %{conn: conn, network: network} do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn = get(conn, "/dashboard/network/settings")

      response = json_response(conn, 200)
      assert response["id"] == network.id
      assert response["name"] == "Test Network"
      assert response["email"] == "support@test.com"
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn = get(conn, "/dashboard/network/settings")

      assert json_response(conn, 403) == %{
               "error" => "You must be a network admin to access this resource"
             }
    end
  end

  describe "update_settings/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, network: network, organization: organization}
    end

    test "updates network settings for network admin", %{conn: conn, network: network} do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn =
        put(conn, "/dashboard/network/settings", %{
          "network" => %{
            "name" => "Updated Network Name",
            "email" => "updated@test.com"
          }
        })

      response = json_response(conn, 200)
      assert response["name"] == "Updated Network Name"
      assert response["email"] == "updated@test.com"
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn =
        put(conn, "/dashboard/network/settings", %{
          "network" => %{"name" => "Hacked Name"}
        })

      assert json_response(conn, 403) == %{
               "error" => "You must be a network admin to update network settings"
             }
    end

    test "returns validation error for invalid email", %{conn: conn, network: network} do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn =
        put(conn, "/dashboard/network/settings", %{
          "network" => %{"email" => ""}
        })

      assert json_response(conn, 422)
    end
  end

  describe "show_stats/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, network: network, organization: organization}
    end

    test "returns network statistics for network admin", %{conn: conn, network: network} do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn = get(conn, "/dashboard/network/stats")

      response = json_response(conn, 200)
      assert Map.has_key?(response, "organizations_count")
      assert Map.has_key?(response, "users_count")
      assert Map.has_key?(response, "devices_count")
      assert Map.has_key?(response, "teams_count")
      assert Map.has_key?(response, "total_storage_bytes")
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn = get(conn, "/dashboard/network/stats")

      assert json_response(conn, 403)
    end
  end

  describe "list_organizations/2" do
    setup do
      network = network_fixture()
      org1 = organization_fixture(%{network_id: network.id, name: "Org 1"})
      org2 = organization_fixture(%{network_id: network.id, name: "Org 2"})

      {:ok, network: network, org1: org1, org2: org2}
    end

    test "returns all organizations in the network for admin", %{
      conn: conn,
      network: network,
      org1: _org1,
      org2: _org2
    } do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn = get(conn, "/dashboard/network/organizations")

      response = json_response(conn, 200)
      assert is_map(response)
      assert is_list(response["data"])
      assert length(response["data"]) == 2

      org_names = Enum.map(response["data"], & &1["name"])
      assert "Org 1" in org_names
      assert "Org 2" in org_names
    end

    test "returns 403 for non-admin user", %{conn: conn, network: network, org1: org1} do
      user = create_regular_user(network, org1)
      conn = authenticate_conn(conn, user, network)

      conn = get(conn, "/dashboard/network/organizations")

      assert json_response(conn, 403)
    end
  end

  describe "create_organization/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, network: network, organization: organization}
    end

    test "creates organization for network admin", %{conn: conn, network: network} do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn =
        post(conn, "/dashboard/network/organizations", %{
          "organization" => %{"name" => "New Organization"}
        })

      response = json_response(conn, 201)
      assert response["name"] == "New Organization"
      assert response["id"]

      # Verify the organization was created in the correct network
      org_id = response["id"]
      org = Organizations.get_organization!(org_id)
      assert org.network_id == network.id
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn =
        post(conn, "/dashboard/network/organizations", %{
          "organization" => %{"name" => "Hacked Organization"}
        })

      assert json_response(conn, 403) == %{
               "error" => "You must be a network admin to create organizations"
             }

      # Verify organization was not created
      orgs = Networks.list_organizations(network.id)
      refute Enum.any?(orgs, fn o -> o.name == "Hacked Organization" end)
    end

    test "returns validation error for missing name", %{conn: conn, network: network} do
      admin = create_network_admin(network)
      conn = authenticate_conn(conn, admin, network)

      conn =
        post(conn, "/dashboard/network/organizations", %{
          "organization" => %{"name" => ""}
        })

      assert json_response(conn, 422)
    end

    test "returns 401 for unauthenticated user", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", "application/json")
        |> post("/dashboard/network/organizations", %{
          "organization" => %{"name" => "Test Org"}
        })

      assert json_response(conn, 401)
    end
  end

  describe "list_users/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, network: network, organization: organization}
    end

    test "returns all users in the network for admin", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      admin = create_network_admin(network)
      user1 = create_regular_user(network, organization)
      user2 = create_regular_user(network, organization)

      conn = authenticate_conn(conn, admin, network)

      conn = get(conn, "/dashboard/network/users")

      response = json_response(conn, 200)
      assert is_map(response)
      assert is_list(response["data"])
      assert is_map(response["pagination"])
      assert response["pagination"]["total_count"] >= 3

      user_ids = Enum.map(response["data"], & &1["id"])
      assert admin.id in user_ids
      assert user1.id in user_ids
      assert user2.id in user_ids
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn = get(conn, "/dashboard/network/users")

      assert json_response(conn, 403)
    end
  end

  describe "invite_user_to_organization/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      admin = create_network_admin(network)

      {:ok, network: network, organization: organization, admin: admin}
    end

    test "invites a user and returns 201", %{
      conn: conn,
      network: network,
      organization: organization,
      admin: admin
    } do
      conn = authenticate_conn(conn, admin, network)

      conn =
        post(conn, "/dashboard/network/organizations/#{organization.id}/invitations", %{
          "email" => "invited@example.com",
          "role" => "member"
        })

      response = json_response(conn, 201)
      assert response["success"] == true
      assert response["message"] =~ "Invitation sent"
      assert is_binary(response["token"])
    end

    test "returns 409 when user already has active invitation", %{
      conn: conn,
      network: network,
      organization: organization,
      admin: admin
    } do
      email = "dup-invite@example.com"

      # First invite succeeds
      conn1 = authenticate_conn(conn, admin, network)

      conn1 =
        post(conn1, "/dashboard/network/organizations/#{organization.id}/invitations", %{
          "email" => email,
          "role" => "admin"
        })

      assert json_response(conn1, 201)["success"] == true

      # Second invite to same email + org should return 409
      conn2 = authenticate_conn(build_conn(), admin, network)

      conn2 =
        post(conn2, "/dashboard/network/organizations/#{organization.id}/invitations", %{
          "email" => email,
          "role" => "admin"
        })

      response = json_response(conn2, 409)
      assert response["error"] =~ "already been invited"
    end

    test "returns 409 when user is already a member", %{
      conn: conn,
      network: network,
      organization: organization,
      admin: admin
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, admin, network)

      conn =
        post(conn, "/dashboard/network/organizations/#{organization.id}/invitations", %{
          "email" => user.email,
          "role" => "member"
        })

      response = json_response(conn, 409)
      assert response["error"] =~ "already a member"
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn =
        post(conn, "/dashboard/network/organizations/#{organization.id}/invitations", %{
          "email" => "test@example.com",
          "role" => "member"
        })

      assert json_response(conn, 403)
    end

    test "returns 403 for organization in different network", %{
      conn: conn,
      network: network,
      admin: admin
    } do
      other_network = network_fixture(%{name: "Other Network"})
      other_org = organization_fixture(%{network_id: other_network.id, name: "Other Org"})

      conn = authenticate_conn(conn, admin, network)

      conn =
        post(conn, "/dashboard/network/organizations/#{other_org.id}/invitations", %{
          "email" => "test@example.com",
          "role" => "member"
        })

      assert json_response(conn, 403)
    end
  end

  describe "list_invitations/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      admin = create_network_admin(network)

      {:ok, network: network, organization: organization, admin: admin}
    end

    test "returns all pending invitations across the network", %{
      conn: conn,
      network: network,
      organization: organization,
      admin: admin
    } do
      # Create invitations via the context
      {:ok, _} = Organizations.invite_user(organization.id, "user1@example.com", :member)
      {:ok, _} = Organizations.invite_user(organization.id, "user2@example.com", :admin)

      conn = authenticate_conn(conn, admin, network)
      conn = get(conn, "/dashboard/network/invitations")

      response = json_response(conn, 200)
      assert is_list(response)
      assert length(response) == 2

      emails = Enum.map(response, & &1["email"])
      assert "user1@example.com" in emails
      assert "user2@example.com" in emails

      # Verify each invitation has the expected fields
      inv = Enum.find(response, &(&1["email"] == "user1@example.com"))
      assert inv["organization_name"] == organization.name
      assert inv["role"] == "member"
      assert inv["status"] == "invited"
      assert inv["organization_id"] == organization.id
    end

    test "returns empty list when no invitations exist", %{
      conn: conn,
      network: network,
      admin: admin
    } do
      conn = authenticate_conn(conn, admin, network)
      conn = get(conn, "/dashboard/network/invitations")

      assert json_response(conn, 200) == []
    end

    test "does not return invitations from other networks", %{
      conn: conn,
      network: network,
      admin: admin
    } do
      # Create invitation in a different network
      other_network = network_fixture(%{name: "Other Network"})
      other_org = organization_fixture(%{network_id: other_network.id, name: "Other Org"})
      {:ok, _} = Organizations.invite_user(other_org.id, "other@example.com", :member)

      conn = authenticate_conn(conn, admin, network)
      conn = get(conn, "/dashboard/network/invitations")

      response = json_response(conn, 200)
      emails = Enum.map(response, & &1["email"])
      refute "other@example.com" in emails
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn = get(conn, "/dashboard/network/invitations")

      assert json_response(conn, 403)
    end
  end

  describe "delete_invitation/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      admin = create_network_admin(network)

      {:ok, token} =
        Organizations.invite_user(organization.id, "to-delete@example.com", :member)

      invitation = Organizations.get_invitation(token)

      {:ok, network: network, organization: organization, admin: admin, invitation: invitation}
    end

    test "deletes an invitation successfully", %{
      conn: conn,
      network: network,
      admin: admin,
      invitation: invitation
    } do
      conn = authenticate_conn(conn, admin, network)

      conn = delete(conn, "/dashboard/network/invitations/#{invitation.id}")

      response = json_response(conn, 200)
      assert response["success"] == true

      # Verify invitation is gone
      assert Organizations.get_invitation(invitation.token) == nil
    end

    test "returns 404 for non-existent invitation", %{
      conn: conn,
      network: network,
      admin: admin
    } do
      conn = authenticate_conn(conn, admin, network)

      conn =
        delete(
          conn,
          "/dashboard/network/invitations/999999999"
        )

      assert json_response(conn, 404)
    end

    test "cannot delete invitation from another network", %{
      conn: conn,
      network: network,
      admin: admin
    } do
      # Create invitation in different network
      other_network = network_fixture(%{name: "Other Network"})
      other_org = organization_fixture(%{network_id: other_network.id, name: "Other Org"})
      {:ok, token} = Organizations.invite_user(other_org.id, "other@example.com", :member)
      other_invitation = Organizations.get_invitation(token)

      conn = authenticate_conn(conn, admin, network)

      conn = delete(conn, "/dashboard/network/invitations/#{other_invitation.id}")

      assert json_response(conn, 404)
    end

    test "returns 403 for non-admin user", %{
      conn: conn,
      network: network,
      organization: organization,
      invitation: invitation
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      conn = delete(conn, "/dashboard/network/invitations/#{invitation.id}")

      assert json_response(conn, 403)
    end
  end

  describe "access control - network isolation" do
    setup do
      # Create two separate networks
      network1 = network_fixture(%{name: "Network 1"})
      network2 = network_fixture(%{name: "Network 2"})

      org1 = organization_fixture(%{network_id: network1.id, name: "Org in Network 1"})
      _org2 = organization_fixture(%{network_id: network2.id, name: "Org in Network 2"})

      {:ok, network1: network1, network2: network2, org1: org1}
    end

    test "admin of network1 cannot see network2's organizations", %{
      conn: conn,
      network1: network1
    } do
      admin1 = create_network_admin(network1)
      conn = authenticate_conn(conn, admin1, network1)

      conn = get(conn, "/dashboard/network/organizations")

      response = json_response(conn, 200)
      org_names = Enum.map(response["data"], & &1["name"])

      # Should not see organizations from network2
      refute "Org in Network 2" in org_names
    end

    test "admin of network1 cannot see network2's settings", %{
      conn: conn,
      network1: network1,
      network2: _network2
    } do
      admin1 = create_network_admin(network1)
      conn = authenticate_conn(conn, admin1, network1)

      conn = get(conn, "/dashboard/network/settings")

      response = json_response(conn, 200)
      # Should see their own network's settings
      assert response["name"] == "Network 1"
    end
  end

  describe "network widget access" do
    setup do
      network = network_fixture()
      organization_a = organization_fixture(%{network_id: network.id, name: "Agency A"})
      organization_b = organization_fixture(%{network_id: network.id, name: "Agency B"})
      other_network = network_fixture()
      other_organization = organization_fixture(%{network_id: other_network.id})
      admin = create_network_admin(network)
      tag = "ndc#{System.unique_integer([:positive])}"

      system = widget_fixture(%{is_system: true, name: "#{tag} Paid service"})

      widget =
        widget_fixture(%{
          is_system: false,
          network_id: network.id,
          name: "#{tag} Network weather",
          icon: "/widgets/weather/icon.svg"
        })

      {:ok,
       network: network,
       organization_a: organization_a,
       organization_b: organization_b,
       other_organization: other_organization,
       admin: admin,
       tag: tag,
       system: system,
       widget: widget}
    end

    defp admin_conn(ctx), do: authenticate_conn(ctx.conn, ctx.admin, ctx.network)

    test "lists curated widgets with access summaries and pagination", ctx do
      body =
        ctx
        |> admin_conn()
        |> get("/dashboard/network/widgets", %{"search" => ctx.tag, "page_size" => "1"})
        |> json_response(200)

      assert %{
               "data" => [
                 %{
                   "id" => id,
                   "kind" => "network",
                   "access" => "all",
                   "enabled_count" => 2,
                   "organizations_count" => 2,
                   "icon" => "/widgets/weather/icon.svg",
                   "core" => false
                 }
               ],
               "summary" => %{
                 "all" => 2,
                 "except" => 0,
                 "selected" => 0,
                 "hidden" => 0,
                 "total" => 2
               },
               "organizations_count" => 2,
               "pagination" => %{"total_count" => 2, "total_pages" => 2}
             } = body

      assert id == ctx.widget.id
    end

    test "hides a system widget for the network", ctx do
      assert %{"access" => "hidden", "enabled_count" => 0} =
               ctx
               |> admin_conn()
               |> put("/dashboard/network/widgets/#{ctx.system.id}/access", %{
                 "access" => "hidden"
               })
               |> json_response(200)

      refute Widgets.available?(ctx.organization_a.id, ctx.system.id)
      assert Widgets.available?(ctx.other_organization.id, ctx.system.id)
    end

    test "lists and updates a widget's organizations", ctx do
      conn = admin_conn(ctx)
      path = "/dashboard/network/widgets/#{ctx.widget.id}/organizations"

      assert %{"access" => "except", "enabled_count" => 1, "listed_count" => 1} =
               conn
               |> patch(path, %{"disable" => [ctx.organization_b.id]})
               |> json_response(200)

      assert %{
               "data" => [
                 %{"name" => "Agency A", "enabled" => true, "in_use" => false},
                 %{"name" => "Agency B", "enabled" => false}
               ],
               "counts" => %{"enabled" => 1, "total" => 2}
             } = conn |> get(path) |> json_response(200)

      assert %{"data" => [%{"name" => "Agency B"}]} =
               conn |> get(path, %{"status" => "disabled"}) |> json_response(200)

      assert %{"enabled_count" => 2} =
               conn
               |> patch(path, %{"all_matching" => true, "enabled" => true, "search" => "agency"})
               |> json_response(200)

      assert Widgets.available?(ctx.organization_b.id, ctx.widget.id)
    end

    test "refuses changes that would break playlists, naming the organizations", ctx do
      playlist = playlist_fixture(%{organization_id: ctx.organization_b.id})

      {:ok, _item} =
        Castmill.Resources.insert_item_into_playlist(playlist.id, nil, ctx.widget.id, 0, 1000)

      assert %{"code" => "in_use", "organizations" => [%{"name" => "Agency B"}]} =
               ctx
               |> admin_conn()
               |> put("/dashboard/network/widgets/#{ctx.widget.id}/access", %{
                 "access" => "hidden"
               })
               |> json_response(409)

      refute Repo.get!(Castmill.Widgets.Widget, ctx.widget.id).restricted
    end

    test "validates input", ctx do
      conn = admin_conn(ctx)
      path = "/dashboard/network/widgets/#{ctx.widget.id}"

      assert conn |> put("#{path}/access", %{"access" => "nope"}) |> json_response(422)

      assert conn
             |> patch("#{path}/organizations", %{"enable" => [ctx.other_organization.id]})
             |> json_response(422)

      assert conn |> patch("#{path}/organizations", %{"enable" => "x"}) |> json_response(422)
    end

    test "core widgets stay available", ctx do
      image =
        Repo.get_by(Castmill.Widgets.Widget, slug: "image") ||
          widget_fixture(%{is_system: true, slug: "image", name: "Image #{ctx.tag}"})

      assert %{"code" => "core_widget"} =
               ctx
               |> admin_conn()
               |> put("/dashboard/network/widgets/#{image.id}/access", %{"access" => "hidden"})
               |> json_response(422)
    end

    test "rejects organization widgets, other networks' widgets and non-admins", ctx do
      organization_widget =
        widget_fixture(%{is_system: false, organization_id: ctx.organization_a.id})

      conn = admin_conn(ctx)

      for widget <- [organization_widget] do
        assert conn
               |> put("/dashboard/network/widgets/#{widget.id}/access", %{"access" => "all"})
               |> json_response(404)

        assert conn
               |> get("/dashboard/network/widgets/#{widget.id}/organizations")
               |> json_response(404)
      end

      regular_user = create_regular_user(ctx.network, ctx.organization_a)
      regular_conn = authenticate_conn(ctx.conn, regular_user, ctx.network)

      assert regular_conn |> get("/dashboard/network/widgets") |> json_response(403)

      assert regular_conn
             |> put("/dashboard/network/widgets/#{ctx.widget.id}/access", %{"access" => "all"})
             |> json_response(403)
    end
  end

  describe "organization integration settings" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      admin = create_network_admin(network)
      widget = widget_fixture(%{is_system: false, network_id: network.id})

      {:ok, _} =
        Castmill.Widgets.Integrations.create_integration(%{
          widget_id: widget.id,
          name: "listing",
          integration_type: "pull",
          pull_endpoint: "fetcher",
          pull_interval_seconds: 300,
          credential_scope: "organization",
          pull_config: %{
            "organization_settings" => %{
              "key" => "property-listing",
              "name" => "Property listings",
              "schema" => %{
                "agency" => %{"type" => "string", "required" => true},
                "office_ids" => %{"type" => "list"}
              }
            }
          }
        })

      %{network: network, organization: organization, admin: admin}
    end

    defp settings_path(org_id, suffix \\ ""),
      do: "/dashboard/network/organizations/#{org_id}/integration-settings#{suffix}"

    test "network admins list, set and remove settings", %{
      conn: conn,
      network: network,
      organization: organization,
      admin: admin
    } do
      conn = authenticate_conn(conn, admin, network)

      assert %{"data" => [%{"key" => "property-listing", "settings" => %{}}]} =
               conn |> get(settings_path(organization.id)) |> json_response(200)

      assert %{"data" => %{"settings" => %{"agency" => "fb", "office_ids" => ["M1"]}}} =
               conn
               |> put(settings_path(organization.id, "/property-listing"), %{
                 "settings" => %{"agency" => "fb", "office_ids" => ["M1"]}
               })
               |> json_response(200)

      assert %{"data" => [%{"settings" => %{"agency" => "fb"}}]} =
               conn |> get(settings_path(organization.id)) |> json_response(200)

      assert %{"errors" => %{"agency" => "required"}} =
               conn
               |> put(settings_path(organization.id, "/property-listing"), %{"settings" => %{}})
               |> json_response(422)

      assert conn
             |> put(settings_path(organization.id, "/unknown"), %{"settings" => %{}})
             |> json_response(404)

      assert conn |> delete(settings_path(organization.id, "/property-listing")) |> response(204)

      assert Castmill.Widgets.Integrations.OrganizationSettings.get(
               organization.id,
               "property-listing"
             ) == nil
    end

    test "only for the admin's own organizations", %{conn: conn, network: network, admin: admin} do
      conn = authenticate_conn(conn, admin, network)
      other = organization_fixture(%{network_id: network_fixture().id})

      assert conn |> get(settings_path(other.id)) |> json_response(404)
      assert conn |> get(settings_path("not-a-uuid")) |> json_response(404)
      assert conn |> delete(settings_path(other.id, "/property-listing")) |> json_response(404)
    end

    test "rejects users who are not network admins", %{
      conn: conn,
      network: network,
      organization: organization
    } do
      user = create_regular_user(network, organization)
      conn = authenticate_conn(conn, user, network)

      assert conn |> get(settings_path(organization.id)) |> json_response(403)

      assert conn
             |> put(settings_path(organization.id, "/property-listing"), %{"settings" => %{}})
             |> json_response(403)
    end
  end
end
