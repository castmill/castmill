defmodule CastmillWeb.DeviceRcChannelTest do
  use CastmillWeb.ChannelCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.RcSessionsFixtures
  import Castmill.AccountsFixtures

  alias Castmill.Devices.RcSessions

  setup do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})
    device = device_fixture(%{organization_id: organization.id})

    # Create an active RC session
    session = rc_session_fixture(%{device_id: device.id, user_id: user.id})

    {:ok, device: device, user: user, session: session}
  end

  describe "join device_rc:device_id" do
    test "successfully joins with valid token and session", %{device: device, session: session} do
      # Subscribe to the PubSub topic to verify notifications
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      assert socket.assigns.device_id == device.id
      assert socket.assigns.session_id == session.id

      # Should receive device_connected notification
      assert_receive %{event: "device_connected", device_id: device_id}
      assert device_id == device.id
    end

    test "rejects join with invalid token", %{device: device, session: session} do
      assert {:error, %{reason: _}} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => "invalid_token", "session_id" => session.id}
        )
    end

    test "rejects join with non-existent session", %{device: device} do
      fake_session_id = Ecto.UUID.generate()

      assert {:error, %{reason: "Session not found"}} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => fake_session_id}
        )
    end

    test "rejects join with stopped session", %{device: device, session: session} do
      # Stop the session
      {:ok, _} = RcSessions.stop_session(session.id)

      assert {:error, %{reason: "Invalid session"}} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )
    end
  end

  describe "handle_in device_event" do
    test "forwards device events to RC window via PubSub", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      # Subscribe to session PubSub to receive forwarded events
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      # Send device event
      ref = push(socket, "device_event", %{"type" => "screen_update", "data" => "test"})
      assert_reply ref, :ok

      # Should receive the forwarded event via PubSub
      assert_receive %{event: "device_event", payload: %{"type" => "screen_update"}}
    end
  end

  describe "handle_info control_event" do
    test "pushes control events from PubSub to device", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      # Broadcast control event via PubSub
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "control_event", payload: %{"action" => "click", "x" => 100, "y" => 200}}
      )

      # Device should receive the control event
      assert_push "control_event", %{"action" => "click", "x" => 100, "y" => 200}
    end
  end

  describe "handle_info stop_session" do
    test "disconnects device when session is stopped", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      # Broadcast stop_session event
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "stop_session"}
      )

      # Device should receive session_stopped message
      assert_push "session_stopped", %{}
    end
  end

  describe "terminate" do
    test "notifies RC window when device disconnects", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      # Subscribe to PubSub to verify notification
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      # Close the socket
      close(socket)

      # Should receive device_disconnected notification
      assert_receive %{event: "device_disconnected", device_id: device_id}
      assert device_id == device.id
    end
  end
end
