defmodule CastmillWeb.DeviceMediaChannelTest do
  use CastmillWeb.ChannelCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.RcSessionsFixtures

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

  describe "join device_media:device_id:session_id" do
    test "successfully joins with valid token and session", %{device: device, session: session} do
      # Subscribe to the PubSub topic to verify notifications
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      assert socket.assigns.device_id == device.id
      assert socket.assigns.session_id == session.id

      # Should receive media_stream_ready notification
      assert_receive %{event: "media_stream_ready", device_id: device_id}
      assert device_id == device.id
    end

    test "rejects join with invalid token", %{device: device, session: session} do
      assert {:error, %{reason: _}} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => "invalid_token"}
        )
    end

    test "rejects join with non-existent session", %{device: device} do
      fake_session_id = Ecto.UUID.generate()

      assert {:error, %{reason: "Session not found"}} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{fake_session_id}",
          %{"token" => device.token}
        )
    end

    test "rejects join with stopped session", %{device: device, session: session} do
      # Stop the session
      {:ok, _} = RcSessions.stop_session(session.id)

      assert {:error, %{reason: "Invalid session"}} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )
    end
  end

  describe "handle_in media_frame" do
    test "forwards media frames to RC window via PubSub", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Subscribe to session PubSub to receive forwarded frames
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      # Send media frame
      frame_data = Base.encode64("fake_frame_data")
      ref = push(socket, "media_frame", %{"data" => frame_data, "timestamp" => 123456})
      assert_reply ref, :ok

      # Should receive the forwarded frame via PubSub
      assert_receive %{event: "media_frame", payload: %{"data" => ^frame_data}}
    end
  end

  describe "handle_in media_metadata" do
    test "forwards media metadata to RC window via PubSub", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Subscribe to session PubSub to receive forwarded metadata
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      # Send media metadata
      metadata = %{"resolution" => "1920x1080", "fps" => 30}
      ref = push(socket, "media_metadata", metadata)
      assert_reply ref, :ok

      # Should receive the forwarded metadata via PubSub
      assert_receive %{event: "media_metadata", payload: ^metadata}
    end
  end

  describe "handle_info stop_session" do
    test "disconnects media stream when session is stopped", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Broadcast stop_session event
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "stop_session"}
      )

      # Media stream should receive session_stopped message
      assert_push "session_stopped", %{}
    end
  end

  describe "terminate" do
    test "notifies RC window when media stream disconnects", %{device: device, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("device_id", %{})
        |> subscribe_and_join(
          CastmillWeb.DeviceMediaChannel,
          "device_media:#{device.id}:#{session.id}",
          %{"token" => device.token}
        )

      # Subscribe to PubSub to verify notification
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      # Close the socket
      close(socket)

      # Should receive media_stream_disconnected notification
      assert_receive %{event: "media_stream_disconnected", device_id: device_id}
      assert device_id == device.id
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
