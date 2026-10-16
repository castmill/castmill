defmodule CastmillWeb.AgentControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Agents
  alias Castmill.Organizations

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})

    users =
      for role <- [:admin, :manager, :member] do
        user = user_fixture(%{network_id: network.id})
        {:ok, _} = Organizations.set_user_role(organization.id, user.id, role)
        {role, user}
      end
      |> Map.new()

    conn = put_req_header(conn, "accept", "application/json")

    %{conn: conn, organization: organization, users: users}
  end

  defp as(conn, user), do: assign(conn, :current_user, user)

  defp base_path(organization), do: "/dashboard/organizations/#{organization.id}/agents"

  describe "create" do
    test "admins can create agents and get the secret once", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      conn =
        conn
        |> as(users.admin)
        |> post(base_path(organization), %{
          "agent" => %{"name" => "Menu bot", "description" => "Menus", "role" => "editor"}
        })

      assert %{"data" => data, "secret" => secret} = json_response(conn, 201)
      assert data["name"] == "Menu bot"
      assert data["role"] == "editor"
      assert data["has_credentials"] == true
      refute Map.has_key?(data, "secret_hash")
      assert String.starts_with?(secret, "cmagt_")

      show_conn =
        build_conn()
        |> as(users.admin)
        |> get(base_path(organization) <> "/#{data["id"]}")

      shown = json_response(show_conn, 200)["data"]
      assert shown["id"] == data["id"]
      refute Map.has_key?(json_response(show_conn, 200), "secret")
    end

    test "returns validation errors", %{conn: conn, organization: organization, users: users} do
      conn = conn |> as(users.admin) |> post(base_path(organization), %{"name" => "x"})
      assert %{"errors" => %{"name" => _}} = json_response(conn, 422)

      conn =
        build_conn()
        |> as(users.admin)
        |> post(base_path(organization), %{"name" => "Bot", "role" => "root"})

      assert %{"errors" => %{"role" => ["is invalid"]}} = json_response(conn, 422)
    end

    test "managers and members cannot create agents", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      for role <- [:manager, :member] do
        conn =
          conn
          |> as(users[role])
          |> post(base_path(organization), %{"name" => "Bot"})

        assert conn.status == 403
      end

      assert Agents.list_agents(organization.id) == []
    end
  end

  describe "index and show" do
    test "admins and managers can list agents, members cannot", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      for role <- [:admin, :manager] do
        resp = conn |> as(users[role]) |> get(base_path(organization)) |> json_response(200)
        assert [%{"id" => id}] = resp["data"]
        assert id == agent.id
      end

      assert conn |> as(users.member) |> get(base_path(organization)) |> Map.get(:status) ==
               403
    end

    test "returns 404 for agents of other organizations", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      other = organization_fixture()
      {:ok, agent, _} = Agents.create_agent(other.id, %{"name" => "Bot"})

      conn = conn |> as(users.admin) |> get(base_path(organization) <> "/#{agent.id}")
      assert conn.status == 404
    end
  end

  describe "update and delete" do
    test "admins can update and delete agents", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      resp =
        conn
        |> as(users.admin)
        |> patch(base_path(organization) <> "/#{agent.id}", %{
          "agent" => %{"name" => "Renamed", "role" => "guest"}
        })
        |> json_response(200)

      assert resp["data"]["name"] == "Renamed"
      assert resp["data"]["role"] == "guest"

      conn = build_conn() |> as(users.admin) |> delete(base_path(organization) <> "/#{agent.id}")
      assert response(conn, 204)
      assert Agents.get_agent(organization.id, agent.id) == nil
    end

    test "managers cannot update or delete agents", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      conn1 =
        conn
        |> as(users.manager)
        |> patch(base_path(organization) <> "/#{agent.id}", %{"name" => "Hacked"})

      assert conn1.status == 403

      conn2 =
        build_conn() |> as(users.manager) |> delete(base_path(organization) <> "/#{agent.id}")

      assert conn2.status == 403
      assert Agents.get_agent(organization.id, agent.id).name == "Bot"
    end
  end

  describe "credentials" do
    test "rotate returns a new secret and revoke disables it", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      {:ok, agent, old_secret} = Agents.create_agent(organization.id, %{"name" => "Bot"})
      path = base_path(organization) <> "/#{agent.id}/credentials"

      %{"secret" => new_secret, "data" => data} =
        conn |> as(users.admin) |> post(path) |> json_response(200)

      assert data["has_credentials"]
      assert new_secret != old_secret
      assert {:error, :invalid_credentials} = Agents.authenticate(old_secret)
      assert {:ok, _} = Agents.authenticate(new_secret)

      %{"data" => data} = build_conn() |> as(users.admin) |> delete(path) |> json_response(200)
      refute data["has_credentials"]
      assert {:error, :invalid_credentials} = Agents.authenticate(new_secret)
    end

    test "managers cannot rotate credentials", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      conn =
        conn
        |> as(users.manager)
        |> post(base_path(organization) <> "/#{agent.id}/credentials")

      assert conn.status == 403
    end
  end

  describe "agents cannot manage agents" do
    test "an admin agent is denied", %{conn: conn, organization: organization} do
      {:ok, agent, _} =
        Agents.create_agent(organization.id, %{"name" => "Admin bot", "role" => "admin"})

      agent_user = Castmill.Accounts.get_user(agent.user_id)

      assert conn |> as(agent_user) |> get(base_path(organization)) |> Map.get(:status) == 403

      assert build_conn()
             |> as(agent_user)
             |> post(base_path(organization) <> "/#{agent.id}/credentials")
             |> Map.get(:status) == 403
    end
  end

  describe "list_actions" do
    test "returns the activity log for admins and managers", %{
      conn: conn,
      organization: organization,
      users: users
    } do
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      {:ok, _} =
        Agents.log_action(agent, %{tool: "list_resources", status: "success", http_status: 200})

      path = "/dashboard/organizations/#{organization.id}/agent-actions"

      for role <- [:admin, :manager] do
        resp =
          conn
          |> as(users[role])
          |> get(path, %{"agent_id" => agent.id, "page_size" => "10"})
          |> json_response(200)

        assert resp["count"] == 1
        assert [%{"tool" => "list_resources", "agent_name" => "Bot"}] = resp["data"]
      end

      assert conn |> as(users.member) |> get(path) |> Map.get(:status) == 403
    end
  end
end
