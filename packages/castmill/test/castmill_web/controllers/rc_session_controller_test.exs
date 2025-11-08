defmodule CastmillWeb.RcSessionControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.RcSessionsFixtures

  alias Castmill.Devices.RcSessions

  setup %{conn: conn} do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})
    device = device_fixture(%{organization_id: organization.id})

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

    {:ok, conn: conn, user: user, device: device, organization: organization}
  end

  describe "POST /devices/:device_id/rc/sessions" do
    test "creates a new RC session", %{conn: conn, device: device} do
      conn = post(conn, "/dashboard/devices/#{device.id}/rc/sessions")
      
      assert %{
        "session_id" => session_id,
        "device_id" => device_id,
        "status" => "active"
      } = json_response(conn, 201)

      assert device_id == device.id
      assert is_binary(session_id)

      # Verify session was created in database
      session = RcSessions.get_session(session_id)
      assert session != nil
      assert session.device_id == device.id
      assert session.status == "active"
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
      
      assert %{
        "session_id" => session_id,
        "status" => "stopped",
        "stopped_at" => stopped_at
      } = json_response(conn, 200)

      assert session_id == session.id
      assert stopped_at != nil

      # Verify session was stopped in database
      updated_session = RcSessions.get_session(session.id)
      assert updated_session.status == "stopped"
      assert updated_session.stopped_at != nil
    end

    test "returns not found for non-existent session", %{conn: conn} do
      fake_session_id = Ecto.UUID.generate()
      conn = post(conn, "/dashboard/rc/sessions/#{fake_session_id}/stop")
      
      assert %{"error" => "Session not found"} = json_response(conn, 404)
    end

    test "returns forbidden when user doesn't own the session", %{conn: conn, device: device} do
      # Create a session with a different user
      other_network = network_fixture()
      other_org = organization_fixture(%{network_id: other_network.id})
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
      
      assert %{
        "has_active_session" => true,
        "session_id" => session_id,
        "user_id" => user_id,
        "started_at" => _started_at
      } = json_response(conn, 200)

      assert session_id == session.id
      assert user_id == user.id
    end

    test "returns no active session when device has no sessions", %{conn: conn, device: device} do
      conn = get(conn, "/dashboard/devices/#{device.id}/rc/status")
      
      assert %{"has_active_session" => false} = json_response(conn, 200)
    end

    test "returns no active session when all sessions are stopped", %{conn: conn, device: device, user: user} do
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
