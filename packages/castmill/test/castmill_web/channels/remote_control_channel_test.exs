defmodule CastmillWeb.RemoteControlChannelTest do
  use CastmillWeb.ChannelCase, async: false

  alias CastmillWeb.RemoteControlChannel
  alias Castmill.Relay.SessionManager
  alias Castmill.Organizations

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  require Logger

  setup do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    Organizations.add_user(organization.id, user.id, :admin)

    device = device_fixture(%{organization_id: organization.id})

    session_id = "test-session-#{:rand.uniform(10000)}"

    {:ok,
     socket: socket,
     user: user,
     device: device,
     organization: organization,
     session_id: session_id}
  end

  describe "join/3" do
    test "creates new session and authorizes user", %{
      user: user,
      device: device,
      session_id: session_id
    } do
      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      assert socket.assigns.session_id == session_id
      assert socket.assigns.device_id == device.id

      # Verify session was created
      session = SessionManager.get_session(session_id)
      assert session != nil
      assert session.device_id == device.id
    end

    test "joins existing session", %{
      user: user,
      device: device,
      session_id: session_id
    } do
      # Create first connection
      {:ok, _, _socket1} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      # Create second connection with same session_id
      {:ok, _, socket2} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      assert socket2.assigns.session_id == session_id

      # Verify session has multiple RC channels
      session = SessionManager.get_session(session_id)
      assert length(session.rc_channel_pids) == 2
    end

    test "rejects unauthorized user", %{
      user: user,
      device: device,
      organization: organization,
      session_id: session_id
    } do
      # Remove user's access
      Organizations.update_role(organization.id, user.id, :member)

      assert {:error, %{reason: "unauthorized"}} =
               CastmillWeb.UserSocket
               |> socket(user.id, %{user: user})
               |> subscribe_and_join(
                 RemoteControlChannel,
                 "remote_control:" <> device.id,
                 %{"session_id" => session_id}
               )
    end

    test "rejects join without session_id", %{
      user: user,
      device: device
    } do
      assert {:error, %{reason: "Missing session_id parameter"}} =
               CastmillWeb.UserSocket
               |> socket(user.id, %{user: user})
               |> subscribe_and_join(
                 RemoteControlChannel,
                 "remote_control:" <> device.id,
                 %{}
               )
    end
  end

  describe "handle_in/3 control_command" do
    test "forwards control command to device", %{
      user: user,
      device: device,
      session_id: session_id
    } do
      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      # Subscribe to device control topic
      Phoenix.PubSub.subscribe(Castmill.PubSub, "device_control:#{device.id}")

      ref =
        push(socket, "control_command", %{
          "session_id" => session_id,
          "command" => "pause",
          "params" => %{"position" => 100}
        })

      # Verify command was forwarded via PubSub
      assert_receive %{
        type: "control_command",
        session_id: ^session_id,
        command: "pause",
        params: %{"position" => 100}
      }

      assert_reply ref, :ok, %{status: "command_sent"}
    end

    test "validates control command schema", %{
      user: user,
      device: device,
      session_id: session_id
    } do
      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      # Invalid command (missing required field)
      ref =
        push(socket, "control_command", %{
          "session_id" => session_id
          # missing "command" field
        })

      assert_reply ref, :error, %{reason: _reason}
    end
  end

  describe "handle_in/3 stop_session" do
    test "stops session and notifies device", %{
      user: user,
      device: device,
      session_id: session_id
    } do
      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      # Subscribe to device control topic
      Phoenix.PubSub.subscribe(Castmill.PubSub, "device_control:#{device.id}")

      ref = push(socket, "stop_session", %{"reason" => "user_requested"})

      # Verify stop message was sent via PubSub
      assert_receive %{
        type: "stop_session",
        session_id: ^session_id
      }

      assert_reply ref, :ok, %{status: "session_stopped"}

      # Verify session was stopped
      assert nil == SessionManager.get_session(session_id)
    end
  end

  describe "handle_info/2 relay_frame" do
    test "relays media frame to RC client", %{
      user: user,
      device: device,
      session_id: session_id
    } do
      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      frame = %{
        "type" => "media_frame",
        "session_id" => session_id,
        "frame_type" => "idr",
        "timestamp" => 1_234_567_890,
        "data" => "test_data"
      }

      # Simulate receiving frame from SessionManager
      send(socket.channel_pid, {:relay_frame, frame})

      # Verify frame was pushed to client
      assert_push "media_frame", ^frame
    end
  end

  describe "terminate/2" do
    test "removes RC channel from session on disconnect", %{
      user: user,
      device: device,
      session_id: session_id
    } do
      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          RemoteControlChannel,
          "remote_control:" <> device.id,
          %{"session_id" => session_id}
        )

      channel_pid = socket.channel_pid

      # Verify session exists
      session = SessionManager.get_session(session_id)
      assert channel_pid in session.rc_channel_pids

      # Close the channel
      Process.unlink(channel_pid)
      GenServer.stop(channel_pid)

      :timer.sleep(100)

      # Session should be cleaned up (only one RC channel)
      assert nil == SessionManager.get_session(session_id)
    end
  end
end
