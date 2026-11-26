defmodule Castmill.OrganizationMembersQuotaTest do
  use Castmill.DataCase, async: false

  import Swoosh.TestAssertions
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.{Organizations, Quotas}

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    admin = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, admin.id, :admin)
    %{network: network, organization: organization}
  end

  test "an organization limited to one user cannot invite anyone", %{organization: organization} do
    Quotas.add_quota_to_organization(organization.id, :users, 1)

    assert {:error, :quota_exceeded} =
             Organizations.invite_user(organization.id, "friend@example.com", :member)

    assert_no_email_sent()
  end

  test "pending invitations count towards the users quota", %{organization: organization} do
    Quotas.add_quota_to_organization(organization.id, :users, 2)

    assert {:ok, _token} =
             Organizations.invite_user(organization.id, "first@example.com", :member)

    assert {:error, :quota_exceeded} =
             Organizations.invite_user(organization.id, "second@example.com", :member)
  end

  test "an invitation cannot be accepted once the organization is full", %{
    network: network,
    organization: organization
  } do
    {:ok, token} = Organizations.invite_user(organization.id, "late@example.com", :member)
    Quotas.add_quota_to_organization(organization.id, :users, 1)
    user = user_fixture(%{network_id: network.id, email: "late@example.com"})

    assert {:error, :quota_exceeded} = Organizations.accept_invitation(token, user.id)
    refute Organizations.get_organizations_user(organization.id, user.id)
  end

  test "AI agents do not take places of people", %{organization: organization} do
    Quotas.add_quota_to_organization(organization.id, :users, 2)

    {:ok, agent_user} =
      Castmill.Accounts.create_user(%{email: "agent@example.com", name: "Agent"})

    agent_user |> Ecto.Changeset.change(is_agent: true) |> Repo.update!()
    {:ok, _} = Organizations.add_user(organization.id, agent_user.id, :member)

    assert {:ok, _} = Organizations.invite_user(organization.id, "person@example.com", :member)
  end
end
