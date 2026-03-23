defmodule Castmill.OrganizationsTest do
  use Castmill.DataCase

  alias Castmill.Organizations

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  describe "organizations" do
    alias Castmill.Organizations.Organization

    @invalid_attrs %{name: nil}

    test "list_organizations/0 returns all organizations" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert Organizations.list_organizations() == [organization]
    end

    test "get_organization!/1 returns the organization with given id" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert Organizations.get_organization!(organization.id) == organization
    end

    test "create_organization/1 with valid data creates a organization" do
      network = network_fixture()
      valid_attrs = %{name: "some name", network_id: network.id}

      assert {:ok, %Organization{} = organization} =
               Organizations.create_organization(valid_attrs)

      assert organization.name == "some name"
    end

    test "create_organization/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Organizations.create_organization(@invalid_attrs)
    end

    test "update_organization/2 with valid data updates the organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      update_attrs = %{name: "some updated name"}

      assert {:ok, %Organization{} = organization} =
               Organizations.update_organization(organization, update_attrs)

      assert organization.name == "some updated name"
    end

    test "update_organization/2 with invalid data returns error changeset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert {:error, %Ecto.Changeset{}} =
               Organizations.update_organization(organization, @invalid_attrs)

      assert organization == Organizations.get_organization!(organization.id)
    end

    test "delete_organization/1 deletes the organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert {:ok, %Organization{}} = Organizations.delete_organization(organization)
      assert_raise Ecto.NoResultsError, fn -> Organizations.get_organization!(organization.id) end
    end

    test "change_organization/1 returns a organization changeset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert %Ecto.Changeset{} = Organizations.change_organization(organization)
    end

    test "create_organization/1 with duplicate name in same network returns error" do
      network = network_fixture()
      valid_attrs = %{name: "duplicate name", network_id: network.id}

      assert {:ok, %Organization{}} = Organizations.create_organization(valid_attrs)
      assert {:error, %Ecto.Changeset{}} = Organizations.create_organization(valid_attrs)
    end

    test "create_organization/1 with duplicate name in different network succeeds" do
      network1 = network_fixture()
      network2 = network_fixture()

      attrs1 = %{name: "same name", network_id: network1.id}
      attrs2 = %{name: "same name", network_id: network2.id}

      assert {:ok, %Organization{}} = Organizations.create_organization(attrs1)
      assert {:ok, %Organization{}} = Organizations.create_organization(attrs2)
    end

    test "update_organization/2 with duplicate name in same network returns error" do
      network = network_fixture()
      _organization1 = organization_fixture(%{network_id: network.id, name: "org1"})
      organization2 = organization_fixture(%{network_id: network.id, name: "org2"})

      assert {:error, %Ecto.Changeset{}} =
               Organizations.update_organization(organization2, %{name: "org1"})
    end

    test "create_organization/1 preserves original case but enforces case-insensitive uniqueness" do
      network = network_fixture()

      # Create organization with mixed case
      assert {:ok, %Organization{} = org1} =
               Organizations.create_organization(%{name: "Castmill AB", network_id: network.id})

      # Verify the name is stored with original casing
      assert org1.name == "Castmill AB"

      # Try to create with different case - should fail
      assert {:error, %Ecto.Changeset{} = changeset} =
               Organizations.create_organization(%{name: "castmill ab", network_id: network.id})

      # Verify error message
      assert %{name: ["has already been taken"]} = errors_on(changeset)

      # Try other case variations - all should fail
      assert {:error, %Ecto.Changeset{}} =
               Organizations.create_organization(%{name: "CASTMILL AB", network_id: network.id})

      assert {:error, %Ecto.Changeset{}} =
               Organizations.create_organization(%{name: "CaStMiLl Ab", network_id: network.id})
    end

    test "update_organization/2 preserves original case but enforces case-insensitive uniqueness" do
      network = network_fixture()

      # Create two organizations
      org1 = organization_fixture(%{network_id: network.id, name: "Organization One"})
      org2 = organization_fixture(%{network_id: network.id, name: "Organization Two"})

      # Verify original casing is preserved
      assert org1.name == "Organization One"
      assert org2.name == "Organization Two"

      # Try to update org2 to use org1's name with different case - should fail
      assert {:error, %Ecto.Changeset{}} =
               Organizations.update_organization(org2, %{name: "organization one"})

      assert {:error, %Ecto.Changeset{}} =
               Organizations.update_organization(org2, %{name: "ORGANIZATION ONE"})

      # Should be able to update to same name with different case (same org)
      assert {:ok, %Organization{} = updated_org1} =
               Organizations.update_organization(org1, %{name: "ORGANIZATION ONE"})

      # Verify the case was updated
      assert updated_org1.name == "ORGANIZATION ONE"
    end

    test "create_organization/1 case-insensitive uniqueness only within same network" do
      network1 = network_fixture()
      network2 = network_fixture()

      # Create organization in network1
      assert {:ok, %Organization{} = org1} =
               Organizations.create_organization(%{name: "Castmill AB", network_id: network1.id})

      assert org1.name == "Castmill AB"

      # Should be able to create same name (different case) in different network
      assert {:ok, %Organization{} = org2} =
               Organizations.create_organization(%{name: "castmill ab", network_id: network2.id})

      # Verify both preserve their original casing
      assert org1.name == "Castmill AB"
      assert org2.name == "castmill ab"
    end
  end

  describe "invite_user/3" do
    import Swoosh.TestAssertions

    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      %{network: network, organization: organization}
    end

    test "creates invitation and sends email", %{network: network, organization: organization} do
      email = "newuser@example.com"

      assert {:ok, token} = Organizations.invite_user(organization.id, email, :member)
      assert is_binary(token)
      assert String.length(token) > 0

      # Verify invitation record exists
      invitation = Organizations.get_invitation(token)
      assert invitation != nil
      assert invitation.email == email
      assert invitation.organization_id == organization.id
      assert invitation.status == "invited"
      assert invitation.role == :member

      # Verify email was sent
      assert_email_sent(
        to: email,
        subject: "You have been invited to an Organization on #{network.name}"
      )
    end

    test "creates invitation with admin role", %{organization: organization} do
      email = "admin-invite@example.com"

      assert {:ok, token} = Organizations.invite_user(organization.id, email, :admin)

      invitation = Organizations.get_invitation(token)
      assert invitation.role == :admin
    end

    test "rejects duplicate active invitation for same email and organization", %{
      organization: organization
    } do
      email = "duplicate@example.com"

      # First invitation succeeds
      assert {:ok, _token} = Organizations.invite_user(organization.id, email, :member)

      # Second invitation to same email + org should fail
      assert {:error, :already_invited} =
               Organizations.invite_user(organization.id, email, :member)
    end

    test "rejects invitation if user is already a member", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "member@example.com"})
      Organizations.add_user(organization.id, user.id, :member)

      assert {:error, :already_member} =
               Organizations.invite_user(organization.id, "member@example.com", :member)
    end

    test "allows invitation to same email in different organization", %{
      network: network,
      organization: org1
    } do
      org2 = organization_fixture(%{network_id: network.id, name: "Second Org"})
      email = "multi-org@example.com"

      assert {:ok, _token1} = Organizations.invite_user(org1.id, email, :member)
      assert {:ok, _token2} = Organizations.invite_user(org2.id, email, :admin)
    end

    test "allows re-invitation after previous invitation was rejected", %{
      organization: organization
    } do
      email = "reinvite@example.com"

      # Create first invitation
      assert {:ok, token} = Organizations.invite_user(organization.id, email, :member)

      # Reject it
      Organizations.reject_invitation(token)

      # Should be able to invite again since old invitation is no longer "invited"
      assert {:ok, _token2} = Organizations.invite_user(organization.id, email, :member)
    end
  end
end
