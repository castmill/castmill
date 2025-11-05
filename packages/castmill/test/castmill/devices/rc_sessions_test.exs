defmodule Castmill.Devices.RcSessionsTest do
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  alias Castmill.Devices.RcSessions

  setup do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})
    device = device_fixture(%{organization_id: organization.id})

    {:ok, device: device, user: user}
  end

  describe "create_session/2" do
    test "creates a new RC session", %{device: device, user: user} do
      assert {:ok, session} = RcSessions.create_session(device.id, user.id)
      assert session.device_id == device.id
      assert session.user_id == user.id
      assert session.status == "active"
      assert session.started_at != nil
      assert session.stopped_at == nil
    end

    test "creates multiple sessions for different devices", %{device: device, user: user} do
      # Create first session
      {:ok, session1} = RcSessions.create_session(device.id, user.id)
      
      # Stop first session
      {:ok, _} = RcSessions.stop_session(session1.id)

      # Create another device and session
      device2 = device_fixture(%{organization_id: device.organization_id, hardware_id: "device2"})
      {:ok, session2} = RcSessions.create_session(device2.id, user.id)

      assert session1.id != session2.id
      assert session2.status == "active"
    end
  end

  describe "get_session/1" do
    test "returns the session when it exists", %{device: device, user: user} do
      {:ok, created_session} = RcSessions.create_session(device.id, user.id)
      
      session = RcSessions.get_session(created_session.id)
      assert session != nil
      assert session.id == created_session.id
      assert session.device_id == device.id
    end

    test "returns nil when session doesn't exist" do
      fake_id = Ecto.UUID.generate()
      assert RcSessions.get_session(fake_id) == nil
    end
  end

  describe "get_active_session_for_device/1" do
    test "returns the active session for a device", %{device: device, user: user} do
      {:ok, created_session} = RcSessions.create_session(device.id, user.id)
      
      session = RcSessions.get_active_session_for_device(device.id)
      assert session != nil
      assert session.id == created_session.id
      assert session.status == "active"
    end

    test "returns nil when device has no active sessions", %{device: device} do
      session = RcSessions.get_active_session_for_device(device.id)
      assert session == nil
    end

    test "returns nil when all sessions are stopped", %{device: device, user: user} do
      {:ok, created_session} = RcSessions.create_session(device.id, user.id)
      {:ok, _} = RcSessions.stop_session(created_session.id)
      
      session = RcSessions.get_active_session_for_device(device.id)
      assert session == nil
    end

    test "returns most recent active session when multiple exist", %{device: device, user: user} do
      # This shouldn't happen in practice, but let's test it
      {:ok, session1} = RcSessions.create_session(device.id, user.id)
      
      # Manually stop first session to allow creating another
      RcSessions.stop_session(session1.id)
      
      # Create second session
      {:ok, session2} = RcSessions.create_session(device.id, user.id)
      
      active_session = RcSessions.get_active_session_for_device(device.id)
      assert active_session.id == session2.id
    end
  end

  describe "stop_session/1" do
    test "stops an active session", %{device: device, user: user} do
      {:ok, session} = RcSessions.create_session(device.id, user.id)
      
      assert {:ok, stopped_session} = RcSessions.stop_session(session.id)
      assert stopped_session.status == "stopped"
      assert stopped_session.stopped_at != nil
    end

    test "returns error when session doesn't exist" do
      fake_id = Ecto.UUID.generate()
      assert {:error, :not_found} = RcSessions.stop_session(fake_id)
    end

    test "can stop an already stopped session", %{device: device, user: user} do
      {:ok, session} = RcSessions.create_session(device.id, user.id)
      
      # Stop once
      {:ok, stopped_once} = RcSessions.stop_session(session.id)
      first_stopped_at = stopped_once.stopped_at
      
      # Stop again (idempotent)
      {:ok, stopped_twice} = RcSessions.stop_session(session.id)
      assert stopped_twice.status == "stopped"
      # stopped_at should be updated
      assert DateTime.compare(stopped_twice.stopped_at, first_stopped_at) in [:gt, :eq]
    end
  end

  describe "get_device_rc_status/1" do
    test "returns no active session when device has no sessions", %{device: device} do
      status = RcSessions.get_device_rc_status(device.id)
      
      assert status.has_active_session == false
      assert status.session == nil
    end

    test "returns active session when device has one", %{device: device, user: user} do
      {:ok, session} = RcSessions.create_session(device.id, user.id)
      
      status = RcSessions.get_device_rc_status(device.id)
      
      assert status.has_active_session == true
      assert status.session.id == session.id
      assert status.session.device_id == device.id
    end

    test "returns no active session when all sessions are stopped", %{device: device, user: user} do
      {:ok, session} = RcSessions.create_session(device.id, user.id)
      {:ok, _} = RcSessions.stop_session(session.id)
      
      status = RcSessions.get_device_rc_status(device.id)
      
      assert status.has_active_session == false
      assert status.session == nil
    end
  end

  # Helper to create a user fixture with organization
  defp user_fixture(attrs \\ %{}) do
    organization_id = attrs[:organization_id] || raise "organization_id is required"
    
    {:ok, user} =
      attrs
      |> Enum.into(%{
        email: "user#{System.unique_integer([:positive])}@example.com",
        organization_id: organization_id
      })
      |> Castmill.Accounts.create_user()

    user
  end
end
