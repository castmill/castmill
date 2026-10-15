defmodule Castmill.AgentsTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Agents
  alias Castmill.Agents.Agent
  alias Castmill.Accounts
  alias Castmill.Organizations

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    admin = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.set_user_role(organization.id, admin.id, :admin)

    %{organization: organization, admin: admin}
  end

  describe "create_agent/3" do
    test "creates an agent user, membership and credentials", %{
      organization: organization,
      admin: admin
    } do
      assert {:ok, %Agent{} = agent, secret} =
               Agents.create_agent(
                 organization.id,
                 %{"name" => "Content bot", "description" => "Updates menus", "role" => "editor"},
                 admin.id
               )

      assert agent.name == "Content bot"
      assert agent.description == "Updates menus"
      assert agent.role == :editor
      assert agent.has_credentials
      assert agent.created_by_id == admin.id
      assert String.starts_with?(secret, "cmagt_")
      assert String.starts_with?(secret, agent.secret_prefix)
      refute agent.secret_hash == secret

      user = Accounts.get_user(agent.user_id)
      assert user.is_agent
      assert user.name == "Content bot"
      assert Agents.agent_user?(user.id)
      refute Agents.agent_user?(admin.id)
      refute Agents.agent_user?(nil)
      refute Agents.agent_user?("not-a-uuid")
    end

    test "defaults to the member role", %{organization: organization} do
      assert {:ok, agent, _secret} = Agents.create_agent(organization.id, %{name: "Bot"})
      assert agent.role == :member
    end

    test "validates the name", %{organization: organization} do
      assert {:error, %Ecto.Changeset{} = changeset} =
               Agents.create_agent(organization.id, %{"name" => "x"})

      assert %{name: [_ | _]} = errors_on(changeset)

      assert {:error, %Ecto.Changeset{}} = Agents.create_agent(organization.id, %{})
    end

    test "rejects invalid roles", %{organization: organization} do
      assert {:error, :invalid_role} =
               Agents.create_agent(organization.id, %{"name" => "Bot", "role" => "superuser"})

      assert Agents.list_agents(organization.id) == []
    end

    test "agents are hidden from the members list and admin count", %{
      organization: organization
    } do
      {:ok, agent, _} =
        Agents.create_agent(organization.id, %{"name" => "Admin bot", "role" => "admin"})

      member_ids =
        %{organization_id: organization.id, page_size: 100}
        |> Organizations.list_users()
        |> Enum.map(fn entry -> entry.user.id end)

      refute agent.user_id in member_ids
      assert Organizations.count_users(%{organization_id: organization.id, search: nil}) ==
               length(member_ids)
    end
  end

  describe "listing and fetching" do
    test "list_agents/1 and get_agent/2 are scoped to the organization", %{
      organization: organization
    } do
      other = organization_fixture()
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      assert [%Agent{id: id}] = Agents.list_agents(organization.id)
      assert id == agent.id
      assert Agents.list_agents(other.id) == []
      assert %Agent{} = Agents.get_agent(organization.id, agent.id)
      assert Agents.get_agent(other.id, agent.id) == nil
      assert Agents.get_agent(organization.id, "invalid") == nil
    end
  end

  describe "update_agent/2" do
    test "updates name, description and role", %{organization: organization} do
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      assert {:ok, updated} =
               Agents.update_agent(agent, %{
                 "name" => "Renamed",
                 "description" => "New",
                 "role" => "manager"
               })

      assert updated.name == "Renamed"
      assert updated.description == "New"
      assert updated.role == :manager
      assert Accounts.get_user(agent.user_id).name == "Renamed"
    end

    test "returns errors for invalid data", %{organization: organization} do
      {:ok, agent, _} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      assert {:error, %Ecto.Changeset{}} = Agents.update_agent(agent, %{"name" => ""})
      assert {:error, :invalid_role} = Agents.update_agent(agent, %{"role" => "owner"})
    end
  end

  describe "credentials" do
    test "authenticate/2 accepts the current secret only", %{organization: organization} do
      {:ok, agent, secret} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      assert {:ok, %Agent{id: id} = authenticated} = Agents.authenticate(secret, "10.0.0.1")
      assert id == agent.id
      assert authenticated.user.id == agent.user_id

      reloaded = Agents.get_agent(organization.id, agent.id)
      assert reloaded.last_ip == "10.0.0.1"
      assert reloaded.last_used_at

      assert {:error, :invalid_credentials} = Agents.authenticate(secret <> "x")
      assert {:error, :invalid_credentials} = Agents.authenticate("not-an-agent-secret")
      assert {:error, :invalid_credentials} = Agents.authenticate(nil)
    end

    test "rotate_credentials/1 invalidates the previous secret", %{organization: organization} do
      {:ok, agent, old_secret} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      assert {:ok, rotated, new_secret} = Agents.rotate_credentials(agent)
      assert new_secret != old_secret
      assert rotated.has_credentials

      assert {:error, :invalid_credentials} = Agents.authenticate(old_secret)
      assert {:ok, _} = Agents.authenticate(new_secret)
    end

    test "revoke_credentials/1 disables access", %{organization: organization} do
      {:ok, agent, secret} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      assert {:ok, revoked} = Agents.revoke_credentials(agent)
      refute revoked.has_credentials
      assert {:error, :invalid_credentials} = Agents.authenticate(secret)
    end

    test "the secret hash is never serialized", %{organization: organization} do
      {:ok, agent, secret} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      json = Jason.encode!(agent)
      refute json =~ "secret_hash"
      refute json =~ secret
      refute inspect(agent) =~ agent.secret_hash
    end
  end

  describe "delete_agent/1" do
    test "removes the agent, its user and its membership", %{organization: organization} do
      {:ok, agent, secret} = Agents.create_agent(organization.id, %{"name" => "Bot"})

      assert {:ok, _} = Agents.delete_agent(agent)
      assert Agents.get_agent(organization.id, agent.id) == nil
      assert Accounts.get_user(agent.user_id) == nil
      assert {:error, :invalid_credentials} = Agents.authenticate(secret)
    end
  end

  describe "actions log" do
    test "log_action/2 and list_actions/2 with filters and pagination", %{
      organization: organization
    } do
      {:ok, bot1, _} = Agents.create_agent(organization.id, %{"name" => "Bot one"})
      {:ok, bot2, _} = Agents.create_agent(organization.id, %{"name" => "Bot two"})

      for i <- 1..3 do
        {:ok, _} =
          Agents.log_action(bot1, %{
            tool: "list_resources",
            arguments: %{"i" => i},
            status: "success",
            http_status: 200
          })
      end

      {:ok, _} =
        Agents.log_action(bot2, %{
          tool: "delete_resource",
          status: "error",
          http_status: 403,
          error: "Forbidden"
        })

      assert {:error, %Ecto.Changeset{}} =
               Agents.log_action(bot2, %{tool: "x", status: "unknown"})

      assert %{count: 4, data: data} = Agents.list_actions(organization.id)
      assert length(data) == 4

      assert %{count: 3} = Agents.list_actions(organization.id, %{"agent_id" => bot1.id})
      assert %{count: 0} = Agents.list_actions(organization.id, %{"agent_id" => "invalid"})

      assert %{count: 1, data: [action]} =
               Agents.list_actions(organization.id, %{"status" => "error"})

      assert action.agent_name == "Bot two"
      assert action.http_status == 403

      assert %{count: 1} = Agents.list_actions(organization.id, %{"tool" => "delete_resource"})

      assert %{count: 4, data: page} =
               Agents.list_actions(organization.id, %{"page" => "2", "page_size" => "3"})

      assert length(page) == 1

      other = organization_fixture()
      assert %{count: 0, data: []} = Agents.list_actions(other.id)
    end
  end
end
