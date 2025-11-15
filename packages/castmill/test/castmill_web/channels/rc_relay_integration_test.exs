defmodule CastmillWeb.Channels.RcRelayIntegrationTest do
  use CastmillWeb.ChannelCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.RcSessionsFixtures
  import Castmill.AccountsFixtures

  alias Castmill.Devices.RcSessions
  alias Castmill.Devices.RcRelay

  setup do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})
    device = device_fixture(%{organization_id: organization.id})

    # Set user to device_manager role for RC access
    Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

    # Create an active RC session
    session = rc_session_fixture(%{device_id: device.id, user_id: user.id})

    {:ok, session: session, device: device, user: user, organization: organization}
  end

  describe "control message relay flow" do
    test "control messages flow from RC window through relay to device", %{
      session: session,
      device: device,
      user: user
    } do
      # Join device RC channel
      {:ok, _, _device_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      # Join RC window channel
      {:ok, _, window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Send control event from RC window
      control_payload = %{"type" => "keydown", "key" => "Enter", "ctrl" => true}
      ref = push(window_socket, "control_event", control_payload)
      assert_reply ref, :ok

      # Device should receive the control event
      assert_push "control_event", ^control_payload

      # Verify relay statistics
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.control_forwarded >= 1
    end

    test "invalid control events are rejected", %{session: session, user: user} do
      # Join RC window channel
      {:ok, _, window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Send invalid control event
      invalid_payload = %{"invalid" => "message"}
      ref = push(window_socket, "control_event", invalid_payload)
      assert_reply ref, :error, %{reason: "Invalid control event message"}
    end

    test "control queue full returns error", %{session: session, user: user} do
      # Join RC window channel
      {:ok, _, window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Flood the queue with messages
      control_payload = %{"type" => "keydown", "key" => "a"}

      # Send many messages rapidly
      for _ <- 1..110 do
        push(window_socket, "control_event", control_payload)
      end

      # Wait for processing
      :timer.sleep(100)

      # Check that some were dropped
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.control_dropped > 0 or stats.control_queue_size > 0
    end
  end

  describe "media frame relay flow with backpressure" do
    test "media frames flow from device through relay to RC window", %{
      session: session,
      device: device,
      user: user
    } do
      # Join device media channel
      {:ok, _, device_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Join RC window channel
      {:ok, _, _window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Send IDR frame from device
      idr_payload = %{"data" => Base.encode64("idr_frame"), "frame_type" => "idr"}
      ref = push(device_socket, "media_frame", idr_payload)
      assert_reply ref, :ok

      # RC window should receive the frame
      assert_push "media_frame", ^idr_payload

      # Verify relay statistics
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.media_forwarded >= 1
      assert stats.idr_frames >= 1
    end

    test "IDR frames are always forwarded even under backpressure", %{
      session: session,
      device: device,
      user: user
    } do
      # Join device media channel
      {:ok, _, device_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Join RC window channel
      {:ok, _, _window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Fill queue with P-frames
      p_payload = %{"data" => Base.encode64("p_frame"), "frame_type" => "p"}

      for _ <- 1..35 do
        push(device_socket, "media_frame", p_payload)
      end

      :timer.sleep(100)

      # Send IDR frame - should be forwarded
      idr_payload = %{"data" => Base.encode64("idr_frame"), "frame_type" => "idr"}
      ref = push(device_socket, "media_frame", idr_payload)
      assert_reply ref, :ok

      # RC window should receive the IDR frame
      assert_push "media_frame", ^idr_payload

      # Verify IDR was counted
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.idr_frames >= 1
    end

    test "P-frames are dropped under backpressure", %{session: session, device: device} do
      # Join device media channel
      {:ok, _, device_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Fill queue with P-frames rapidly
      p_payload = %{"data" => Base.encode64("p_frame"), "frame_type" => "p"}

      for _ <- 1..50 do
        push(device_socket, "media_frame", p_payload)
      end

      :timer.sleep(150)

      # Check that P-frames were dropped
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.p_frames_dropped > 0
    end

    test "media metadata is forwarded without backpressure", %{
      session: session,
      device: device,
      user: user
    } do
      # Join device media channel
      {:ok, _, device_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Join RC window channel
      {:ok, _, _window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Send metadata
      metadata = %{"resolution" => "1920x1080", "fps" => 30}
      ref = push(device_socket, "media_metadata", metadata)
      assert_reply ref, :ok

      # RC window should receive metadata
      assert_push "media_metadata", ^metadata
    end
  end

  describe "session lifecycle with relay" do
    test "relay is cleaned up when session is closed", %{
      session: session,
      device: device,
      user: user
    } do
      # Verify relay is running
      assert {:ok, _stats} = RcRelay.get_stats(session.id)

      # Join device and window channels
      {:ok, _, _device_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      {:ok, _, _window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Close session
      RcSessions.transition_to_closed(session.id)

      # Channels should receive close notification
      assert_push "session_closed", %{}

      :timer.sleep(100)

      # Relay should be stopped
      assert {:error, :session_not_found} = RcRelay.get_stats(session.id)
    end

    test "device and window can exchange messages through relay", %{
      session: session,
      device: device,
      user: user
    } do
      # Join both channels
      {:ok, _, _device_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceRcChannel,
          "device_rc:#{device.id}",
          %{"token" => device.token, "session_id" => session.id}
        )

      {:ok, _, device_media_socket} =
        CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      {:ok, _, window_socket} =
        CastmillWeb.RcSocket
        |> socket("user_id", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Send control from window to device
      control = %{"type" => "click", "x" => 100, "y" => 200, "button" => 0}
      push(window_socket, "control_event", control)

      # Device should receive it
      assert_push "control_event", ^control

      # Send media frame from device to window
      frame = %{"data" => Base.encode64("frame"), "frame_type" => "idr"}
      push(device_media_socket, "media_frame", frame)

      # Window should receive it
      assert_push "media_frame", ^frame

      # Verify both were relayed
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.control_forwarded >= 1
      assert stats.media_forwarded >= 1
    end
  end
end
