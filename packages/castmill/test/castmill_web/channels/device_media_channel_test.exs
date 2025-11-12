defmodule CastmillWeb.DeviceMediaChannelTest do
  use CastmillWeb.ChannelCase, async: false

  alias CastmillWeb.DeviceMediaChannel
  alias Castmill.Relay.SessionManager

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  require Logger

  setup do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    device = device_fixture(%{organization_id: organization.id})

    # Generate device token
    {:ok, token} = Castmill.Devices.generate_device_token(device.id)

    session_id = "test-session-#{:rand.uniform(10000)}"

    device_info = %{
      device_id: device.id,
      hardware_id: "test-hardware-#{:rand.uniform(10000)}",
      device_ip: {127, 0, 0, 1}
    }

    {:ok, device: device, token: token, session_id: session_id, device_info: device_info}
  end

  describe "join/3" do
    test "device joins media channel with valid token", %{
      device: device,
      token: token,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      assert socket.assigns.device_id == device.id
    end

    test "rejects device with invalid token", %{
      device: device,
      device_info: device_info
    } do
      assert {:error, _reason} =
               CastmillWeb.DeviceSocket
               |> socket(device.id, %{device: device_info})
               |> subscribe_and_join(
                 DeviceMediaChannel,
                 "device_media:" <> device.id,
                 %{"token" => "invalid_token"}
               )
    end
  end

  describe "handle_in/3 media_frame" do
    test "enqueues valid media frame", %{
      device: device,
      token: token,
      session_id: session_id,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Create a session first
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)
      SessionManager.create_session(session_id, device.id, rc_pid)
      SessionManager.set_device_channel(session_id, socket.channel_pid)

      # Send media frame
      push(socket, "media_frame", %{
        "session_id" => session_id,
        "frame_type" => "idr",
        "timestamp" => 1_234_567_890,
        "data" => "test_data"
      })

      # Give time for async processing
      :timer.sleep(50)

      # Verify frame was processed
      session = SessionManager.get_session(session_id)
      assert session != nil

      # Cleanup
      Process.exit(rc_pid, :kill)
    end

    test "rejects invalid media frame", %{
      device: device,
      token: token,
      session_id: session_id,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Send invalid frame (missing required field)
      ref =
        push(socket, "media_frame", %{
          "session_id" => session_id,
          "frame_type" => "idr"
          # missing timestamp and data
        })

      assert_reply ref, :error, %{reason: _reason}
    end
  end

  describe "handle_in/3 session_status" do
    test "broadcasts session status", %{
      device: device,
      token: token,
      session_id: session_id,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Subscribe to RC updates
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_updates:#{session_id}")

      ref =
        push(socket, "session_status", %{
          "session_id" => session_id,
          "status" => "active",
          "device_id" => device.id
        })

      # Verify status was broadcast
      assert_receive %{
        type: "session_status",
        session_id: ^session_id,
        status: "active",
        device_id: device_id
      }

      assert device_id == device.id
      assert_reply ref, :ok, %{status: "status_sent"}
    end
  end

  describe "handle_info/2 start_session" do
    test "registers device channel and pushes start_session", %{
      device: device,
      token: token,
      session_id: session_id,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Create a session
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)
      SessionManager.create_session(session_id, device.id, rc_pid)

      # Broadcast start_session
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "device_control:#{device.id}",
        %{
          type: "start_session",
          session_id: session_id,
          device_id: device.id
        }
      )

      # Verify device received start_session
      assert_push "start_session", %{
        type: "start_session",
        session_id: ^session_id
      }

      # Verify device channel was registered
      session = SessionManager.get_session(session_id)
      assert session.device_channel_pid == socket.channel_pid
      assert session.status == :active

      # Cleanup
      Process.exit(rc_pid, :kill)
    end
  end

  describe "handle_info/2 stop_session" do
    test "pushes stop_session to device", %{
      device: device,
      token: token,
      session_id: session_id,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Broadcast stop_session
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "device_control:#{device.id}",
        %{
          type: "stop_session",
          session_id: session_id
        }
      )

      # Verify device received stop_session
      assert_push "stop_session", %{session_id: ^session_id}
    end
  end

  describe "handle_info/2 control_command" do
    test "forwards control command to device", %{
      device: device,
      token: token,
      session_id: session_id,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Broadcast control command
      command = %{
        type: "control_command",
        session_id: session_id,
        command: "pause",
        params: %{}
      }

      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "device_control:#{device.id}",
        command
      )

      # Verify device received command
      assert_push "control_command", ^command
    end
  end

  describe "handle_info/2 request_keyframe" do
    test "forwards keyframe request to device", %{
      device: device,
      token: token,
      session_id: session_id,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Send keyframe request directly to channel process
      send(socket.channel_pid, {:request_keyframe, session_id})

      # Verify device received keyframe request
      assert_push "request_keyframe", %{session_id: ^session_id}
    end
  end

  describe "terminate/2" do
    test "stops all device sessions on disconnect", %{
      device: device,
      token: token,
      device_info: device_info
    } do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{device: device_info})
        |> subscribe_and_join(
          DeviceMediaChannel,
          "device_media:" <> device.id,
          %{"token" => token}
        )

      # Create multiple sessions for this device
      session_id1 = "session-1-#{:rand.uniform(10000)}"
      session_id2 = "session-2-#{:rand.uniform(10000)}"

      rc_pid1 = spawn(fn -> :timer.sleep(:infinity) end)
      rc_pid2 = spawn(fn -> :timer.sleep(:infinity) end)

      SessionManager.create_session(session_id1, device.id, rc_pid1)
      SessionManager.create_session(session_id2, device.id, rc_pid2)
      SessionManager.set_device_channel(session_id1, socket.channel_pid)
      SessionManager.set_device_channel(session_id2, socket.channel_pid)

      # Verify sessions exist
      assert SessionManager.get_session(session_id1) != nil
      assert SessionManager.get_session(session_id2) != nil

      # Disconnect device
      channel_pid = socket.channel_pid
      Process.unlink(channel_pid)
      GenServer.stop(channel_pid)

      :timer.sleep(100)

      # Sessions should be cleaned up
      assert nil == SessionManager.get_session(session_id1)
      assert nil == SessionManager.get_session(session_id2)

      # Cleanup
      Process.exit(rc_pid1, :kill)
      Process.exit(rc_pid2, :kill)
    end
  end
end
