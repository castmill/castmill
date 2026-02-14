defmodule CastmillWeb.OrganizationInvitationTest do
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts
  alias Castmill.Organizations

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{network_id: network.id, name: "Org Admin"})

    # Add user to organization as admin
    {:ok, _} =
      Organizations.create_organizations_user(%{
        organization_id: organization.id,
        user_id: user.id,
        role: :admin
      })

    session_token = Accounts.generate_user_session_token(user.id)

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> Plug.Test.init_test_session(%{user_session_token: session_token})

    %{
      conn: conn,
      network: network,
      organization: organization,
      user: user
    }
  end

  describe "preview_invitation/2 - no auth required" do
    test "returns invitation details for valid token with non-existent user", %{
      conn: _conn,
      organization: organization
    } do
      # Create invitation for email that doesn't exist
      new_email = "newuser@example.com"

      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_email,
          role: :member
        })

      # Preview invitation without auth (conn without session)
      conn_no_auth = build_conn()

      conn =
        get(conn_no_auth, ~p"/dashboard/organizations_invitations/#{invitation.token}/preview")

      assert json_response(conn, 200) == %{
               "email" => new_email,
               "organization_name" => organization.name,
               "organization_id" => organization.id,
               "status" => "invited",
               "expires_at" => DateTime.to_iso8601(invitation.expires_at),
               "user_exists" => false,
               "expired" => false
             }
    end

    test "returns invitation details with user_exists=true for existing user", %{
      conn: _conn,
      organization: organization,
      network: network
    } do
      # Create a user first
      existing_user =
        user_fixture(%{
          network_id: network.id,
          email: "existing@example.com",
          name: "Existing User"
        })

      # Create invitation for existing user's email
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: existing_user.email,
          role: :member
        })

      # Preview invitation
      conn_no_auth = build_conn()

      conn =
        get(conn_no_auth, ~p"/dashboard/organizations_invitations/#{invitation.token}/preview")

      response = json_response(conn, 200)
      assert response["email"] == existing_user.email
      assert response["user_exists"] == true
    end

    test "returns 404 for invalid token", %{conn: _conn} do
      conn_no_auth = build_conn()
      conn = get(conn_no_auth, ~p"/dashboard/organizations_invitations/invalid-token/preview")

      assert json_response(conn, 404) == %{"error" => "Invalid or expired invitation"}
    end

    test "marks invitation as expired when past expires_at", %{
      conn: _conn,
      organization: organization
    } do
      # Create invitation that expired yesterday
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: "test@example.com",
          role: :member,
          expires_at: DateTime.add(DateTime.utc_now(), -1, :day)
        })

      conn_no_auth = build_conn()

      conn =
        get(conn_no_auth, ~p"/dashboard/organizations_invitations/#{invitation.token}/preview")

      response = json_response(conn, 200)
      assert response["expired"] == true
    end
  end

  describe "accept_invitation/2 - auth required" do
    test "successfully accepts invitation for authenticated user", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      # Create a new user who will accept the invitation
      new_user =
        user_fixture(%{
          network_id: network.id,
          email: "invited@example.com",
          name: "Invited User"
        })

      # Create invitation
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_user.email,
          role: :member
        })

      # Authenticate as the invited user
      invited_token = Accounts.generate_user_session_token(new_user.id)

      conn_invited =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: invited_token})

      # Accept invitation
      conn =
        post(conn_invited, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert json_response(conn, 200) == %{}

      # Verify user is now in organization
      org_user = Organizations.get_organizations_user(organization.id, new_user.id)
      assert org_user != nil
      assert org_user.role == :member
    end

    test "rejects invitation if user email doesn't match", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      # Create invitation for one email
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: "user1@example.com",
          role: :member
        })

      # Try to accept with different user
      different_user =
        user_fixture(%{
          network_id: network.id,
          email: "user2@example.com",
          name: "Different User"
        })

      different_token = Accounts.generate_user_session_token(different_user.id)

      conn_different =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: different_token})

      conn =
        post(conn_different, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert response(conn, 403)
    end

    test "rejects expired invitation", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      new_user =
        user_fixture(%{
          network_id: network.id,
          email: "test@example.com",
          name: "Expired User"
        })

      # Create expired invitation
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_user.email,
          role: :member,
          expires_at: DateTime.add(DateTime.utc_now(), -1, :day)
        })

      expired_token = Accounts.generate_user_session_token(new_user.id)

      conn_new =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: expired_token})

      conn = post(conn_new, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert response(conn, 400)
    end

    test "requires authentication", %{organization: organization} do
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: "test@example.com",
          role: :member
        })

      # Try to accept without auth
      conn_no_auth = build_conn()

      conn =
        post(conn_no_auth, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      # Should redirect to login or return 401
      assert response(conn, 401)
    end
  end

  describe "invitation workflow with signup" do
    test "new user can preview invitation, signup, and accept", %{
      conn: _conn,
      organization: organization,
      network: network
    } do
      new_email = "newbie@example.com"

      # 1. Create invitation
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_email,
          role: :member
        })

      # 2. Preview invitation (no auth)
      conn_no_auth = build_conn()

      conn =
        get(conn_no_auth, ~p"/dashboard/organizations_invitations/#{invitation.token}/preview")

      response = json_response(conn, 200)
      assert response["email"] == new_email
      assert response["user_exists"] == false

      # 3. User would now signup with passkey (tested separately in signup_controller_test.exs)
      # For this test, we'll create the user directly
      new_user =
        user_fixture(%{
          network_id: network.id,
          email: new_email,
          name: "Newbie User"
        })

      new_user_token = Accounts.generate_user_session_token(new_user.id)

      # 4. Accept invitation after signup
      conn_new_user =
        build_conn()
        |> Plug.Test.init_test_session(%{user_session_token: new_user_token})

      conn =
        post(conn_new_user, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert json_response(conn, 200) == %{}

      # 5. Verify user is in organization
      org_user = Organizations.get_organizations_user(organization.id, new_user.id)
      assert org_user != nil
      assert org_user.role == :member
    end
  end

  describe "invitation roles and permissions" do
    test "admin invitation grants admin role", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      new_user =
        user_fixture(%{
          network_id: network.id,
          email: "admin@example.com",
          name: "Admin Invitee"
        })

      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_user.email,
          role: :admin
        })

      admin_invitee_token = Accounts.generate_user_session_token(new_user.id)

      conn_new =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: admin_invitee_token})

      conn = post(conn_new, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert json_response(conn, 200) == %{}

      org_user = Organizations.get_organizations_user(organization.id, new_user.id)
      assert org_user.role == :admin
    end

    test "guest invitation grants guest role", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      new_user =
        user_fixture(%{
          network_id: network.id,
          email: "guest@example.com",
          name: "Guest Invitee"
        })

      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_user.email,
          role: :guest
        })

      guest_invitee_token = Accounts.generate_user_session_token(new_user.id)

      conn_new =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: guest_invitee_token})

      conn = post(conn_new, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert json_response(conn, 200) == %{}

      org_user = Organizations.get_organizations_user(organization.id, new_user.id)
      assert org_user.role == :guest
    end
  end

  describe "multiple invitations" do
    test "user can accept same invitation twice (idempotent)", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      new_user =
        user_fixture(%{
          network_id: network.id,
          email: "test@example.com",
          name: "Duplicate Invitee"
        })

      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_user.email,
          role: :member
        })

      duplicate_token = Accounts.generate_user_session_token(new_user.id)

      conn_new =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: duplicate_token})

      # Accept once
      conn_result1 = post(conn_new, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")
      assert json_response(conn_result1, 200) == %{}

      # Accept again - should succeed (idempotent)
      conn_result2 = post(conn_new, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")
      assert json_response(conn_result2, 200) == %{}
    end

    test "different user cannot accept already-accepted invitation", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      # Create first user and accept invitation
      first_user =
        user_fixture(%{
          network_id: network.id,
          email: "first@example.com",
          name: "First User"
        })

      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: first_user.email,
          role: :member
        })

      first_token = Accounts.generate_user_session_token(first_user.id)

      conn_first =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: first_token})

      conn_result = post(conn_first, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")
      assert json_response(conn_result, 200) == %{}

      # Create second user and try to accept the same invitation
      second_user =
        user_fixture(%{
          network_id: network.id,
          email: "second@example.com",
          name: "Second User"
        })

      second_token = Accounts.generate_user_session_token(second_user.id)

      conn_second =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: second_token})

      # Should fail with 400 because invitation was already accepted by a different user
      conn_result =
        post(conn_second, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert response(conn_result, 400)
    end
  end

  describe "reject_invitation/2" do
    test "successfully rejects invitation", %{
      conn: conn,
      organization: organization
    } do
      # Create invitation
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: "reject@example.com",
          role: :member
        })

      # Reject invitation
      conn = post(conn, ~p"/dashboard/organizations_invitations/#{invitation.token}/reject")

      assert json_response(conn, 200) == %{}

      # Verify invitation status is rejected
      rejected_invitation = Organizations.get_invitation(invitation.token)
      assert rejected_invitation.status == "rejected"
    end

    test "cannot reject already accepted invitation", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      new_user =
        user_fixture(%{
          network_id: network.id,
          email: "already-accepted@example.com",
          name: "Already Accepted User"
        })

      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: new_user.email,
          role: :member
        })

      # Accept the invitation first
      accepted_token = Accounts.generate_user_session_token(new_user.id)

      conn_accepted =
        conn
        |> Plug.Test.init_test_session(%{user_session_token: accepted_token})

      conn =
        post(conn_accepted, ~p"/dashboard/organizations_invitations/#{invitation.token}/accept")

      assert json_response(conn, 200) == %{}

      # Try to reject already accepted invitation
      conn =
        post(conn_accepted, ~p"/dashboard/organizations_invitations/#{invitation.token}/reject")

      assert response(conn, 400)
    end

    test "cannot reject already rejected invitation", %{
      conn: conn,
      organization: organization
    } do
      {:ok, invitation} =
        Organizations.create_organizations_invitation(%{
          organization_id: organization.id,
          email: "double-reject@example.com",
          role: :member
        })

      # Reject once
      conn = post(conn, ~p"/dashboard/organizations_invitations/#{invitation.token}/reject")
      assert json_response(conn, 200) == %{}

      # Try to reject again
      conn = post(conn, ~p"/dashboard/organizations_invitations/#{invitation.token}/reject")
      assert response(conn, 400)
    end

    test "returns error for invalid token", %{conn: conn} do
      conn = post(conn, ~p"/dashboard/organizations_invitations/invalid-token/reject")
      assert response(conn, 400)
    end
  end
end
