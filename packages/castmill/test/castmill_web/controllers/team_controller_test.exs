defmodule CastmillWeb.TeamControllerTest do
  use CastmillWeb.ConnCase, async: true
  alias CastmillWeb.Router.Helpers, as: Routes

  alias Castmill.Teams
  alias Castmill.Organizations

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.TeamsFixtures

  # only if you need to create media in some tests
  import Castmill.MediasFixtures

  @moduletag :e2e
  @moduletag :team_controller

  setup %{conn: conn} do
    # 1) Create a network, organization, user, and team
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    # Create a team under this organization
    team = team_fixture(%{organization_id: organization.id})

    # By default, let's add the user as an organization admin so we can test
    # various "happy paths" easily. Adjust as needed:
    # :ok = Organizations.set_user_role(organization.id, user.id, "admin")

    # Insert the user into the team if needed
    # {:ok, _teams_user} = Teams.add_user_to_team(team.id, user.id, :admin)

    # Create an access token for the user. If you don't need tokens, adapt.
    access_token =
      access_token_fixture(%{
        secret: "testuser:testpass",
        user_id: user.id,
        # or true if you want them to override ACL checks
        is_root: false
      })

    # Build a conn that includes the auth header
    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, organization: organization, team: team}
  end

  defp create_access_token(username, email) do
    user = user_fixture(%{email: email})
    access_token_fixture(%{user_id: user.id, secret: "#{username}:testpass", is_root: false})
  end

  defp create_authenticated_conn(username, email) do
    access_token = create_access_token(username, email)

    build_conn()
    # needed so route helpers work
    |> Map.put(:endpoint, CastmillWeb.Endpoint)
    |> put_req_header("accept", "application/json")
    |> put_req_header("authorization", "Bearer #{access_token.secret}")
  end

  # ----------------------------------------------------------------------------
  # Access Control Tests (check_access)

  describe "check_access for :show_invitation / :accept_invitation" do
    @describetag team_controller: true

    test "allows user if token belongs to them (validInvitation?)", %{
      conn: conn,
      team: team
    } do
      # 1) Create an invitation for the user's email
      new_user_email = "test@testdomain.com"
      {:ok, token} = create_invitation_for_user_email(team, new_user_email)

      # Only the user with the correct email can see the invitation
      conn = get(conn, Routes.team_invitation_path(conn, :show_invitation, token))
      assert conn.status == 403

      conn2 = create_authenticated_conn("invited_user", new_user_email)

      # 2) Show invitation => should be 200
      conn2 = get(conn2, Routes.team_invitation_path(conn2, :show_invitation, token))
      assert conn2.status == 200

      # 3) Accept invitation => should be 200
      conn2 = post(conn2, Routes.team_invitation_path(conn, :accept_invitation, token))
      assert conn2.status == 200
    end

    test "forbids user if the invitation token is for a different email", %{
      conn: conn,
      team: team
    } do
      other_user = user_fixture(%{email: "other@example.com"})
      {:ok, token} = create_invitation_for_user_email(team, other_user.email)

      # Attempt to show / accept the token as the first user
      # Since we are still logged in as the original user from setup
      conn = get(conn, Routes.team_invitation_path(conn, :show_invitation, token))
      # or 400, whichever you return
      assert conn.status == 403

      conn =
        post(conn, Routes.team_invitation_path(conn, :accept_invitation, token))

      # or 400
      assert conn.status == 403
    end
  end

  describe "check_access for :invite_user, :update_team, :remove_member, :add_resource, :remove_resource" do
    test "allows organization admin to do these actions", %{conn: conn, team: team, user: user} do
      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)

      conn =
        put(
          conn,
          Routes.organization_team_path(conn, :update_team, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "name" => "New Team Name"
          }
        )

      assert conn.status == 200
    end

    test "forbids non-admin org user from these actions", %{conn: conn, team: team} do
      member_user = user_fixture(%{})
      {:ok, _} = Organizations.set_user_role(team.organization_id, member_user.id, :member)

      conn =
        put(
          conn,
          Routes.organization_team_path(conn, :update_team, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "name" => "Bad Attempt"
          }
        )

      assert conn.status == 403
    end
  end

  describe "check_access for :list_members, :list_resources, :remove_member, :list_invitations, :remove_invitation" do
    test "allows organization member to list resources / members", %{
      conn: conn,
      team: team,
      user: user
    } do
      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :member)

      conn =
        get(
          conn,
          Routes.organization_team_path(conn, :list_members, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{team.organization_id}"
          }
        )

      assert conn.status == 200
    end

    test "forbids if user not in organization", %{team: team} do
      outsider_user = user_fixture(%{})
      # No role in this org

      # Build new conn with outsider's token
      outsider_token =
        access_token_fixture(%{
          user_id: outsider_user.id,
          secret: "outsider:testpass",
          is_root: false
        })

      conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{outsider_token.secret}")

      # Attempt to list members
      conn =
        get(
          conn,
          Routes.organization_team_path(conn, :list_members, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{team.organization_id}"
          }
        )

      # Expect forbidden
      assert conn.status in [401, 403]
    end
  end

  # ----------------------------------------------------------------------------
  # Controller Action Tests

  describe "update_team/2" do
    test "updates team name", %{conn: conn, team: team, user: user} do
      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)

      conn =
        put(
          conn,
          Routes.organization_team_path(conn, :update_team, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "name" => "New Team Name"
          }
        )

      assert conn.status == 200
      updated_team = Teams.get_team(team.id)
      assert updated_team.name == "New Team Name"
    end
  end

  # Currently it is not possible to add a member directly, it needs to be done via invitation
  # describe "add_member/2" do
  #   test "adds a user to a team", %{conn: conn, team: team} do
  #     new_user = user_fixture(%{})

  #     conn =
  #       post(
  #         conn,
  #         Routes.organization_team_path(conn, :add_member, team.organization_id, team.id),
  #         %{
  #           "team_id" => "#{team.id}",
  #           "user_id" => new_user.id
  #         }
  #       )

  #     assert conn.status == 201 || conn.status == 200

  #     # Check DB
  #     assert Teams.user_in_team?(team.id, new_user.email) == true
  #   end
  # end

  describe "list_members/2" do
    test "lists existing team members", %{conn: conn, team: team, user: user} do
      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :member)

      {:ok, _} = Teams.add_user_to_team(team.id, user.id, "member")

      conn =
        get(
          conn,
          Routes.organization_team_path(conn, :list_members, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{team.organization_id}"
          }
        )

      assert conn.status == 200

      response = json_response(conn, 200)
      assert is_list(response["data"])

      user_email = user.email
      assert is_integer(response["count"])
      assert Enum.any?(response["data"], fn data -> data["user"]["email"] == user_email end)
    end
  end

  describe "invite_user/2" do
    test "invites a user successfully", %{
      conn: conn,
      team: team,
      organization: organization,
      user: user
    } do
      new_email = "invitee@example.com"

      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :member)

      conn =
        post(
          conn,
          Routes.organization_team_path(conn, :invite_user, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{organization.id}",
            "email" => new_email
          }
        )

      assert conn.status == 403

      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)

      conn =
        post(
          conn,
          Routes.organization_team_path(conn, :invite_user, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{organization.id}",
            "email" => new_email
          }
        )

      assert conn.status == 201

      # Check DB for an invitation row
      invitation = Teams.get_invitation_by_email(new_email)
      assert invitation
      assert invitation.team_id == team.id
      assert invitation.status == "invited"
    end

    test "invites a user with explicit member role", %{
      conn: conn,
      team: team,
      organization: organization,
      user: user
    } do
      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)
      email = "member-role@example.com"

      conn =
        post(
          conn,
          Routes.organization_team_path(conn, :invite_user, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{organization.id}",
            "email" => email,
            "role" => "member"
          }
        )

      assert conn.status == 201

      invitation = Teams.get_invitation_by_email(email)
      assert invitation
      assert invitation.role == :member
    end

    test "returns error if user is already a member", %{
      conn: conn,
      team: team,
      user: user
    } do
      # Add the user to the team
      {:ok, _} = Teams.add_user_to_team(team.id, user.id, "member")

      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)

      conn =
        post(
          conn,
          Routes.organization_team_path(conn, :invite_user, team.organization_id, team.id),
          %{
            "email" => user.email
          }
        )

      # Likely 400 or some domain-specific error code
      assert conn.status == 400
      assert %{"error" => "already_member"} = json_response(conn, 400)
    end
  end

  describe "list_invitations/2" do
    test "lists invitations for a team", %{
      conn: conn,
      team: team,
      organization: organization,
      user: user
    } do
      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)

      # create a couple invitations
      {:ok, _token1} = create_invitation_for_user_email(team, "someone1@example.com")
      {:ok, _token2} = create_invitation_for_user_email(team, "someone2@example.com")

      conn =
        get(
          conn,
          Routes.organization_team_path(conn, :list_invitations, team.organization_id, team.id),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{organization.id}",
            "page" => "1",
            "page_size" => "10"
          }
        )

      assert conn.status == 200
      response = json_response(conn, 200)
      assert response["count"] == 2
      assert length(response["data"]) == 2
    end
  end

  describe "show_invitation/2" do
    test "shows an existing invitation", %{conn: conn, team: team, user: user} do
      {:ok, token} = create_invitation_for_user_email(team, user.email)

      conn =
        get(
          conn,
          Routes.team_invitation_path(conn, :show_invitation, token),
          %{"token" => token}
        )

      assert conn.status == 200

      invitation = json_response(conn, 200)
      assert invitation["token"] == token
      assert invitation["email"] == user.email
    end
  end

  describe "accept_invitation/2" do
    test "accepts a valid invitation", %{conn: conn, team: team, user: user} do
      # create an invitation for the user's email
      {:ok, token} = create_invitation_for_user_email(team, user.email)

      conn =
        post(
          conn,
          Routes.team_invitation_path(conn, :accept_invitation, token),
          %{"token" => token}
        )

      assert conn.status == 200

      # check DB
      invitation = Teams.get_invitation(token)
      assert invitation.status == "accepted"
      # user should now be in the team
      assert Teams.user_in_team?(team.id, user.email)
    end
  end

  describe "remove_invitation/2" do
    test "removes an existing invitation", %{conn: conn, team: team, user: user} do
      {:ok, token} = create_invitation_for_user_email(team, "test@example.com")
      invitation = Teams.get_invitation(token)

      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)

      conn =
        delete(
          conn,
          Routes.organization_team_path(
            conn,
            :remove_invitation,
            team.organization_id,
            team.id,
            invitation.id
          ),
          %{
            "team_id" => "#{team.id}",
            "invitation_id" => invitation.id
          }
        )

      assert conn.status == 200
      # now the invitation should be gone
      refute Teams.get_invitation(token)
    end
  end

  describe "add_resource/2" do
    @tag :only
    test "adds a resource to the team", %{
      conn: conn,
      organization: organization,
      team: team,
      user: user
    } do
      # Suppose we have a media resource
      media = media_fixture(%{name: "Test Media", organization_id: organization.id})

      {:ok, _} = Organizations.set_user_role(organization.id, user.id, :admin)

      conn =
        put(
          conn,
          Routes.organization_team_path(
            conn,
            :add_resource,
            team.organization_id,
            team.id,
            "medias",
            media.id
          ),
          %{
            "access" => ["read"]
          }
        )

      assert conn.status in [200, 201]

      assert Teams.resource_in_team?(team.id, "medias", media.id)
    end
  end

  describe "list_resources/2" do
    test "lists resources belonging to a team", %{
      conn: conn,
      team: team,
      organization: organization,
      user: user
    } do
      media = media_fixture(%{organization_id: organization.id, name: "Media1"})
      {:ok, _result} = Teams.add_resource_to_team(team.id, "medias", media.id, [:read])

      conn =
        get(
          conn,
          Routes.organization_team_path(
            conn,
            :list_resources,
            team.organization_id,
            team.id,
            "medias"
          ),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{organization.id}",
            "page" => "1",
            "page_size" => "10"
          }
        )

      assert conn.status == 403

      # Try again with a user who is a member of the organization
      Organizations.add_user(organization.id, user.id, :member)

      conn =
        get(
          conn,
          Routes.organization_team_path(
            conn,
            :list_resources,
            team.organization_id,
            team.id,
            "medias"
          ),
          %{
            "team_id" => "#{team.id}",
            "organization_id" => "#{organization.id}",
            "page" => "1",
            "page_size" => "10"
          }
        )

      assert conn.status == 200
      response = json_response(conn, 200)

      assert response["count"] == 1
      assert Enum.any?(response["data"], fn r -> r["media"]["name"] == "Media1" end)
    end
  end

  describe "remove_resource/2" do
    test "removes a resource from a team", %{
      conn: conn,
      team: team,
      organization: organization,
      user: user
    } do
      media = media_fixture(%{organization_id: organization.id, name: "Media2"})
      {:ok, _result} = Teams.add_resource_to_team(team.id, "medias", media.id, [:read])

      Organizations.set_user_role(organization.id, user.id, :admin)

      conn =
        delete(
          conn,
          Routes.organization_team_path(
            conn,
            :remove_resource,
            team.organization_id,
            team.id,
            "medias",
            media.id
          )
        )

      assert conn.status == 200
      refute Teams.resource_in_team?(team.id, media.id, :media)
    end
  end

  describe "remove_member/2" do
    test "removes a member from the team", %{conn: conn, team: team, user: user} do
      user2 = user_fixture()
      Teams.add_user_to_team(team.id, user2.id, "member")

      {:ok, _} = Organizations.set_user_role(team.organization_id, user.id, :admin)

      conn =
        delete(
          conn,
          Routes.organization_team_path(
            conn,
            :remove_member,
            team.organization_id,
            team.id,
            user2.id
          )
        )

      assert conn.status == 200
      refute Teams.user_in_team?(team.id, user2.email)
    end

    test "allows a member to remove themselves", %{team: team, organization: organization} do
      member_user = user_fixture()
      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)
      {:ok, _} = Teams.add_user_to_team(team.id, member_user.id, "member")

      member_token =
        access_token_fixture(%{
          user_id: member_user.id,
          secret: "member:self",
          is_root: false
        })

      member_conn =
        build_conn()
        |> Map.put(:endpoint, CastmillWeb.Endpoint)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{member_token.secret}")

      conn =
        delete(
          member_conn,
          Routes.organization_team_path(
            member_conn,
            :remove_member,
            team.organization_id,
            team.id,
            member_user.id
          )
        )

      assert conn.status == 200
      refute Teams.user_in_team?(team.id, member_user.email)
    end

    test "prevents a member from removing another member", %{
      team: team,
      organization: organization
    } do
      acting_member = user_fixture()
      target_member = user_fixture()

      {:ok, _} = Organizations.set_user_role(organization.id, acting_member.id, :member)
      {:ok, _} = Organizations.set_user_role(organization.id, target_member.id, :member)

      {:ok, _} = Teams.add_user_to_team(team.id, acting_member.id, "member")
      {:ok, _} = Teams.add_user_to_team(team.id, target_member.id, "member")

      acting_token =
        access_token_fixture(%{
          user_id: acting_member.id,
          secret: "member:acting",
          is_root: false
        })

      acting_conn =
        build_conn()
        |> Map.put(:endpoint, CastmillWeb.Endpoint)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{acting_token.secret}")

      conn =
        delete(
          acting_conn,
          Routes.organization_team_path(
            acting_conn,
            :remove_member,
            team.organization_id,
            team.id,
            target_member.id
          )
        )

      assert conn.status == 403
      assert Teams.user_in_team?(team.id, target_member.email)
    end
  end

  # ---------------------------------------------------------------------------
  # Quota Enforcement Tests
  describe "team creation quota enforcement" do
    @describetag team_controller: true

    setup %{organization: organization, user: user} do
      # Make user an admin for quota tests
      {:ok, _} = Organizations.set_user_role(organization.id, user.id, :admin)
      :ok
    end

    test "allows team creation when quota is not exceeded", %{
      conn: conn,
      organization: organization
    } do
      # Network has default plan with teams quota of 10
      # We already have 1 team from setup, create one more
      conn =
        post(conn, Routes.organization_resource_path(conn, :create, organization.id, "teams"), %{
          "team" => %{"name" => "New Team"}
        })

      assert conn.status == 201
      assert json_response(conn, 201)["data"]["name"] == "New Team"
    end

    test "prevents team creation when quota is exceeded", %{
      conn: conn,
      organization: organization
    } do
      # Set a low quota for testing
      Castmill.Quotas.add_quota_to_organization(organization.id, :teams, 1)

      # We already have 1 team from setup, so this should fail
      conn =
        post(conn, Routes.organization_resource_path(conn, :create, organization.id, "teams"), %{
          "team" => %{"name" => "Quota Exceeded Team"}
        })

      assert conn.status == 403
      response = json_response(conn, 403)
      assert response["errors"]["quota"] == ["Team quota exceeded"]
    end

    test "respects organization-specific quota override", %{
      conn: conn,
      organization: organization
    } do
      # Set quota to 3 teams
      Castmill.Quotas.add_quota_to_organization(organization.id, :teams, 3)

      # Already have 1 team, create 2 more (should succeed)
      conn1 =
        post(conn, Routes.organization_resource_path(conn, :create, organization.id, "teams"), %{
          "team" => %{"name" => "Team 2"}
        })

      assert conn1.status == 201

      # Get auth header for reuse
      auth_header =
        conn.req_headers |> Enum.find(fn {k, _} -> k == "authorization" end) |> elem(1)

      conn2 =
        recycle(conn)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", auth_header)
        |> post(Routes.organization_resource_path(conn, :create, organization.id, "teams"), %{
          "team" => %{"name" => "Team 3"}
        })

      assert conn2.status == 201

      # 4th team should fail
      conn3 =
        recycle(conn)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", auth_header)
        |> post(Routes.organization_resource_path(conn, :create, organization.id, "teams"), %{
          "team" => %{"name" => "Team 4"}
        })

      assert conn3.status == 403
    end

    test "respects assigned plan quota", %{conn: conn, organization: organization} do
      # Create a plan with 2 teams quota
      plan =
        Castmill.Quotas.create_plan("Limited Plan", organization.network_id, [
          %{max: 2, resource: :teams},
          %{max: 100, resource: :medias}
        ])

      Castmill.Quotas.assign_plan_to_organization(plan.id, organization.id)

      # Already have 1 team, create 1 more (should succeed)
      conn1 =
        post(conn, Routes.organization_resource_path(conn, :create, organization.id, "teams"), %{
          "team" => %{"name" => "Team 2"}
        })

      assert conn1.status == 201

      # Get auth header for reuse
      auth_header =
        conn.req_headers |> Enum.find(fn {k, _} -> k == "authorization" end) |> elem(1)

      # 3rd team should fail
      conn2 =
        recycle(conn)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", auth_header)
        |> post(Routes.organization_resource_path(conn, :create, organization.id, "teams"), %{
          "team" => %{"name" => "Team 3"}
        })

      assert conn2.status == 403
    end
  end

  # ---------------------------------------------------------------------------
  # Helper function to create an invitation for a specific email in a team
  defp create_invitation_for_user_email(team, email) do
    # This presumably calls something like Teams.add_invitation_to_team/3
    # Return the token or handle as you do in your code
    {:ok, token} = Teams.add_invitation_to_team(team.organization_id, team.id, email)
    {:ok, token}
  end
end
