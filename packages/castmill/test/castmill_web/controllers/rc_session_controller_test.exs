defmodule CastmillWeb.RcSessionControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.RcSessionsFixtures

  alias Castmill.Devices.RcSessions
  alias Castmill.Repo
  alias Castmill.Organizations.OrganizationsUsers

  # Helper to set user role in an organization
  defp set_user_role(user_id, organization_id, role) do
    # Find or create the organizations_users record
    case Repo.get_by(OrganizationsUsers, user_id: user_id, organization_id: organization_id) do
      nil ->
        %OrganizationsUsers{}
        |> OrganizationsUsers.changeset(%{
          user_id: user_id,
          organization_id: organization_id,
          role: role
        })
        |> Repo.insert!()

      org_user ->
        org_user
        |> OrganizationsUsers.changeset(%{role: role})
        |> Repo.update!()
    end
  end

  setup %{conn: conn} do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})
    device = device_fixture(%{organization_id: organization.id})

    # Set user as device_manager by default
    set_user_role(user.id, organization.id, :device_manager)

    # Create access token for authentication
    access_token = access_token_fixture(%{
      secret: "testuser:testpass",
      user_id: user.id,
      is_root: false
    })

    # Build authenticated conn
    conn = conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, device: device, organization: organization, network: network}
  end

  describe "POST /devices/:device_id/rc/sessions" do
    test "creates a new RC session with device_manager role", %{conn: conn, device: device} do
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      
      response = json_response(conn, 201)
      assert %{
        "session_id" => session_id,
        "device_id" => device_id,
        "state" => state
      } = response

      assert device_id == device.id
      assert state in ["created", "starting"]
      assert is_binary(session_id)

      # Verify session was created in database
      session = RcSessions.get_session(session_id)
      assert session != nil
      assert session.device_id == device.id
      assert session.state in ["created", "starting"]
    end

    test "creates a new RC session with admin role", %{conn: conn, device: device, user: user, organization: organization} do
      set_user_role(user.id, organization.id, :admin)
      
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      assert json_response(conn, 201)
    end

    test "creates a new RC session with manager role", %{conn: conn, device: device, user: user, organization: organization} do
      set_user_role(user.id, organization.id, :manager)
      
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      assert json_response(conn, 201)
    end

    test "rejects creation with member role", %{conn: conn, device: device, user: user, organization: organization} do
      set_user_role(user.id, organization.id, :member)
      
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      
      assert %{"error" => error} = json_response(conn, 403)
      assert error =~ "device_manager"
    end

    test "rejects creation with guest role", %{conn: conn, device: device, user: user, organization: organization} do
      set_user_role(user.id, organization.id, :guest)
      
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      
      assert %{"error" => error} = json_response(conn, 403)
      assert error =~ "device_manager"
    end

    test "rejects creation with editor role", %{conn: conn, device: device, user: user, organization: organization} do
      set_user_role(user.id, organization.id, :editor)
      
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      
      assert %{"error" => error} = json_response(conn, 403)
      assert error =~ "device_manager"
    end

    test "returns conflict when device already has active session", %{conn: conn, device: device, user: user} do
      # Create an active session first
      {:ok, _session} = RcSessions.create_session(device.id, user.id)

      # Try to create another session
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      
      assert %{"error" => "Device already has an active RC session"} = json_response(conn, 409)
    end

    test "returns not found for non-existent device", %{conn: conn} do
      fake_device_id = Ecto.UUID.generate()
      conn = post(conn, "/dashboard/devices/#{fake_device_id}/rc/sessions")
      
      assert %{"error" => "Device not found"} = json_response(conn, 404)
    end

    test "returns unauthorized without authentication" do
      conn = build_conn()
        |> put_req_header("accept", "application/json")
      
      device_id = Ecto.UUID.generate()
      conn = post(conn, "/dashboard/devices/#{device_id}/rc/sessions")
      
      assert conn.status == 401
    end
  end

  describe "POST /rc/sessions/:session_id/stop" do
    test "stops an active RC session", %{conn: conn, device: device, user: user} do
      # Create a session
      session = rc_session_fixture(%{device_id: device.id, user_id: user.id})

      conn = post(conn, "/dashboard/rc/sessions/#{session.id}/stop")
      
      response = json_response(conn, 200)
      assert %{
        "session_id" => session_id,
        "state" => state,
        "stopped_at" => stopped_at
      } = response

      assert session_id == session.id
      assert state == "closed"
      assert stopped_at != nil

      # Verify session was stopped in database
      updated_session = RcSessions.get_session(session.id)
      assert updated_session.state == "closed"
      assert updated_session.stopped_at != nil
    end

    test "allows admin to stop session with device_manager permission", %{conn: conn, device: device, user: user, organization: organization} do
      set_user_role(user.id, organization.id, :admin)
      session = rc_session_fixture(%{device_id: device.id, user_id: user.id})

      conn = post(conn, "/dashboard/rc/sessions/#{session.id}/stop")
      assert json_response(conn, 200)
    end

    test "rejects stopping with member role", %{conn: conn, device: device, user: user, organization: organization} do
      session = rc_session_fixture(%{device_id: device.id, user_id: user.id})
      
      # Change role after session creation
      set_user_role(user.id, organization.id, :member)

      conn = post(conn, "/dashboard/rc/sessions/#{session.id}/stop")
      
      assert %{"error" => error} = json_response(conn, 403)
      assert error =~ "device_manager"
    end

    test "returns not found for non-existent session", %{conn: conn} do
      fake_session_id = Ecto.UUID.generate()
      conn = post(conn, "/dashboard/rc/sessions/#{fake_session_id}/stop")
      
      assert %{"error" => "Session not found"} = json_response(conn, 404)
    end

    test "returns forbidden when user doesn't own the session", %{conn: conn, device: device, network: network} do
      # Create a session with a different user
      other_org = organization_fixture(%{network_id: network.id})
      other_user = user_fixture(%{organization_id: other_org.id})
      
      session = rc_session_fixture(%{device_id: device.id, user_id: other_user.id})

      conn = post(conn, "/dashboard/rc/sessions/#{session.id}/stop")
      
      assert %{"error" => "Not authorized to stop this session"} = json_response(conn, 403)
    end

    test "returns unauthorized without authentication" do
      conn = build_conn()
        |> put_req_header("accept", "application/json")
      
      session_id = Ecto.UUID.generate()
      conn = post(conn, "/dashboard/rc/sessions/#{session_id}/stop")
      
      assert conn.status == 401
    end
  end

  describe "GET /devices/:device_id/rc/status" do
    test "returns status when device has active session", %{conn: conn, device: device, user: user} do
      # Create a session
      session = rc_session_fixture(%{device_id: device.id, user_id: user.id})

      conn = get(conn, "/dashboard/devices/#{device.id}/rc/status")
      
      response = json_response(conn, 200)
      assert %{
        "has_active_session" => true,
        "session_id" => session_id,
        "user_id" => user_id,
        "state" => state
      } = response

      assert session_id == session.id
      assert user_id == user.id
      assert state in ["created", "starting", "streaming"]
    end

    test "returns no active session when device has no sessions", %{conn: conn, device: device} do
      conn = get(conn, "/dashboard/devices/#{device.id}/rc/status")
      
      assert %{"has_active_session" => false} = json_response(conn, 200)
    end

    test "returns no active session when all sessions are closed", %{conn: conn, device: device, user: user} do
      # Create and stop a session
      session = rc_session_fixture(%{device_id: device.id, user_id: user.id})
      {:ok, _} = RcSessions.stop_session(session.id)

      conn = get(conn, "/dashboard/devices/#{device.id}/rc/status")
      
      assert %{"has_active_session" => false} = json_response(conn, 200)
    end

    test "returns not found for non-existent device", %{conn: conn} do
      fake_device_id = Ecto.UUID.generate()
      conn = get(conn, "/dashboard/devices/#{fake_device_id}/rc/status")
      
      assert %{"error" => "Device not found"} = json_response(conn, 404)
    end
  end
end
