defmodule CastmillWeb.NetworkDashboardControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts
  alias Castmill.Organizations
  alias Castmill.Networks

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
      assert is_list(response)

      user_ids = Enum.map(response, & &1["id"])
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
end
