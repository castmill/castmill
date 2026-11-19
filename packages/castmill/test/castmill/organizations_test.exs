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

    test "notifies an invitee with an account even when the email cannot be queued", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "no-email@example.com"})

      assert {:ok, token} =
               Castmill.FailingMailerAdapter.with_failing_mailer(fn ->
                 Organizations.invite_user(organization.id, user.email, :member)
               end)

      assert Organizations.get_invitation(token)

      assert [notification] =
               user.id
               |> Castmill.Notifications.list_user_notifications()
               |> Enum.filter(&(&1.type == "organization_invitation"))

      assert notification.metadata["token"] == token
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

  describe "resend_invitation/2" do
    import Swoosh.TestAssertions

    alias Castmill.Notifications
    alias Castmill.Organizations.OrganizationsInvitation

    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      %{network: network, organization: organization}
    end

    defp invite(organization, email) do
      {:ok, token} = Organizations.invite_user(organization.id, email, :member)
      assert_email_sent(to: email)
      Organizations.get_invitation(token)
    end

    defp expire(invitation) do
      past = DateTime.utc_now() |> DateTime.add(-3600, :second) |> DateTime.truncate(:second)

      from(i in OrganizationsInvitation, where: i.id == ^invitation.id)
      |> Repo.update_all(set: [expires_at: past])
    end

    test "sends the invitation with a new link that is valid for 7 days", %{
      network: network,
      organization: organization
    } do
      invitation = invite(organization, "again@example.com")

      assert {:ok, resent} = Organizations.resend_invitation(organization.id, invitation.id)

      assert resent.id == invitation.id
      assert resent.token != invitation.token
      assert resent.status == "invited"

      assert DateTime.diff(resent.expires_at, DateTime.utc_now()) in (7 * 86_400 - 5)..(7 * 86_400)

      assert Organizations.get_invitation(invitation.token) == nil
      assert Organizations.get_invitation(resent.token).id == invitation.id

      assert_email_sent(fn email ->
        assert email.to == [{"", "again@example.com"}]
        assert email.subject == "You have been invited to an Organization on #{network.name}"
        assert email.text_body =~ resent.token
        true
      end)
    end

    test "accepts the invitation id as a string", %{organization: organization} do
      invitation = invite(organization, "string-id@example.com")

      assert {:ok, _} =
               Organizations.resend_invitation(organization.id, Integer.to_string(invitation.id))
    end

    test "reopens expired and declined invitations", %{organization: organization} do
      expired = invite(organization, "expired@example.com")
      expire(expired)

      assert {:error, :expired} =
               Organizations.accept_invitation(expired.token, Ecto.UUID.generate())

      assert {:ok, resent} = Organizations.resend_invitation(organization.id, expired.id)
      refute OrganizationsInvitation.expired?(resent)
      assert_email_sent(to: "expired@example.com")

      declined = invite(organization, "declined@example.com")
      {:ok, _} = Organizations.reject_invitation(declined.token)

      assert {:ok, %{status: "invited"}} =
               Organizations.resend_invitation(organization.id, declined.id)
    end

    test "replaces the in-app notification of people with an account", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "has-account@example.com"})
      invitation = invite(organization, user.email)

      assert {:ok, resent} = Organizations.resend_invitation(organization.id, invitation.id)

      assert [notification] =
               user.id
               |> Notifications.list_user_notifications()
               |> Enum.filter(&(&1.type == "organization_invitation"))

      assert notification.link == "/invite-organization?token=#{resent.token}"
    end

    test "tells the invitee's open dashboard about the replaced notification after saving", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "watching@example.com"})
      invitation = invite(organization, user.email)

      [old_notification] =
        Notifications.list_user_notifications(user.id)
        |> Enum.filter(&(&1.type == "organization_invitation"))

      Phoenix.PubSub.subscribe(Castmill.PubSub, "users:#{user.id}")

      assert {:ok, resent} = Organizations.resend_invitation(organization.id, invitation.id)

      old_id = old_notification.id
      # The unread count already includes the new notification.
      assert_received {:notifications_deleted, [^old_id], 1}
      assert_received {:new_notification, %{type: "organization_invitation"} = new, 1}
      assert new.metadata.token == resent.token
    end

    test "removes the old notification of an invitee who changed their email", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "before@example.com"})
      invitation = invite(organization, user.email)

      [old_notification] =
        Notifications.list_user_notifications(user.id)
        |> Enum.filter(&(&1.type == "organization_invitation"))

      from(u in Castmill.Accounts.User, where: u.id == ^user.id)
      |> Repo.update_all(set: [email: "after@example.com"])

      Phoenix.PubSub.subscribe(Castmill.PubSub, "users:#{user.id}")

      assert {:ok, _} = Organizations.resend_invitation(organization.id, invitation.id)

      old_id = old_notification.id
      assert_received {:notifications_deleted, [^old_id], 0}
      assert Notifications.list_user_notifications(user.id) == []
    end

    test "releases its lock whether or not the resend succeeds", %{organization: organization} do
      advisory_locks = fn ->
        Repo.query!("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'").rows
      end

      invitation = invite(organization, "lock@example.com")

      assert {:ok, _} = Organizations.resend_invitation(organization.id, invitation.id)
      assert advisory_locks.() == [[0]]

      assert {:error, :email_not_sent} =
               Castmill.FailingMailerAdapter.with_failing_mailer(fn ->
                 Organizations.resend_invitation(organization.id, invitation.id)
               end)

      assert advisory_locks.() == [[0]]

      current = Repo.get_by!(OrganizationsInvitation, id: invitation.id)
      {:ok, _} = Organizations.reject_invitation(current.token)
      _pending = invite(organization, "lock@example.com")

      assert {:error, :already_invited} =
               Organizations.resend_invitation(organization.id, invitation.id)

      assert advisory_locks.() == [[0]]
    end

    test "leaves one notification with the current link after several resends", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "many-resends@example.com"})
      invitation = invite(organization, user.email)

      for _ <- 1..3 do
        assert {:ok, _} = Organizations.resend_invitation(organization.id, invitation.id)
      end

      current = Repo.get_by!(OrganizationsInvitation, id: invitation.id)

      assert [notification] =
               user.id
               |> Notifications.list_user_notifications()
               |> Enum.filter(&(&1.type == "organization_invitation"))

      assert notification.metadata["token"] == current.token
    end

    test "reports an email that could not be queued, keeping the renewed invitation", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "queue-down@example.com"})
      invitation = invite(organization, user.email)

      assert {:error, :email_not_sent} =
               Castmill.FailingMailerAdapter.with_failing_mailer(fn ->
                 Organizations.resend_invitation(organization.id, invitation.id)
               end)

      current = Repo.get_by!(OrganizationsInvitation, id: invitation.id)
      assert current.token != invitation.token
      assert current.status == "invited"

      # The in-app notification does not depend on the email.
      assert [notification] =
               user.id
               |> Notifications.list_user_notifications()
               |> Enum.filter(&(&1.type == "organization_invitation"))

      assert notification.metadata["token"] == current.token

      # Resending again sends the email.
      assert {:ok, resent} = Organizations.resend_invitation(organization.id, invitation.id)
      assert_email_sent(fn email -> email.text_body =~ resent.token end)
    end

    test "does not accept an invitation token after it has been resent", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "rotated@example.com"})
      invitation = invite(organization, user.email)

      assert {:ok, _resent} = Organizations.resend_invitation(organization.id, invitation.id)

      assert {:error, "Invalid token"} =
               Organizations.accept_invitation(invitation.token, user.id)

      assert Organizations.get_organizations_user(organization.id, user.id) == nil
    end

    test "does not resend accepted invitations", %{network: network, organization: organization} do
      user = user_fixture(%{network_id: network.id, email: "accepted@example.com"})
      invitation = invite(organization, user.email)
      {:ok, _} = Organizations.accept_invitation(invitation.token, user.id)

      assert {:error, :already_accepted} =
               Organizations.resend_invitation(organization.id, invitation.id)

      assert_no_email_sent()
    end

    test "does not resend to people who already joined", %{
      network: network,
      organization: organization
    } do
      user = user_fixture(%{network_id: network.id, email: "joined@example.com"})
      invitation = invite(organization, user.email)
      {:ok, _} = Organizations.add_user(organization.id, user.id, :member)

      assert {:error, :already_member} =
               Organizations.resend_invitation(organization.id, invitation.id)

      assert Organizations.get_invitation(invitation.token)
    end

    test "does not reopen a declined invitation when a newer one is pending", %{
      organization: organization
    } do
      declined = invite(organization, "twice@example.com")
      {:ok, _} = Organizations.reject_invitation(declined.token)
      _pending = invite(organization, "twice@example.com")

      assert {:error, :already_invited} =
               Organizations.resend_invitation(organization.id, declined.id)

      assert Organizations.get_invitation(declined.token).status == "rejected"
    end

    test "only finds invitations of the organization", %{
      network: network,
      organization: organization
    } do
      other = organization_fixture(%{network_id: network.id, name: "Other Org"})
      invitation = invite(other, "elsewhere@example.com")

      assert {:error, :not_found} =
               Organizations.resend_invitation(organization.id, invitation.id)

      assert {:error, :not_found} = Organizations.resend_invitation(organization.id, "abc")
      assert {:error, :not_found} = Organizations.resend_invitation(organization.id, nil)
      assert Organizations.get_invitation(invitation.token)
    end
  end
end
