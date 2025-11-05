defmodule CastmillWeb.RcWindowChannelTest do
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

  describe "join rc_window:session_id" do
    test "successfully joins with valid user and session", %{user: user, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      assert socket.assigns.session_id == session.id
      assert socket.assigns.device_id == session.device_id
    end

    test "rejects join without user_id" do
      session_id = Ecto.UUID.generate()

      assert {:error, %{reason: "Unauthorized"}} = CastmillWeb.RcSocket
        |> socket("user_socket", %{})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session_id}",
          %{}
        )
    end

    test "rejects join with non-existent session", %{user: user} do
      fake_session_id = Ecto.UUID.generate()

      assert {:error, %{reason: "Session not found"}} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{fake_session_id}",
          %{}
        )
    end

    test "rejects join when user doesn't own the session", %{session: session} do
      # Create another user
      other_network = network_fixture()
      other_org = organization_fixture(%{network_id: other_network.id})
      other_user = user_fixture(%{organization_id: other_org.id})

      assert {:error, %{reason: "Unauthorized or invalid session"}} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: other_user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )
    end

    test "rejects join with stopped session", %{user: user, session: session} do
      # Stop the session
      {:ok, _} = RcSessions.stop_session(session.id)

      assert {:error, %{reason: "Unauthorized or invalid session"}} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )
    end
  end

  describe "handle_in control_event" do
    test "forwards control events to device via PubSub", %{user: user, session: session} do
      {:ok, _, socket} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Subscribe to session PubSub to verify the event is broadcast
      Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

      # Send control event
      control_payload = %{"action" => "click", "x" => 100, "y" => 200}
      ref = push(socket, "control_event", control_payload)
      assert_reply ref, :ok

      # Should receive the forwarded event via PubSub
      assert_receive %{event: "control_event", payload: ^control_payload}
    end
  end

  describe "handle_info device_connected" do
    test "pushes device_connected message to RC window", %{user: user, session: session, device: device} do
      {:ok, _, _socket} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Broadcast device_connected via PubSub
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "device_connected", device_id: device.id}
      )

      # RC window should receive the message
      assert_push "device_connected", %{device_id: device_id}
      assert device_id == device.id
    end
  end

  describe "handle_info device_disconnected" do
    test "pushes device_disconnected message to RC window", %{user: user, session: session, device: device} do
      {:ok, _, _socket} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Broadcast device_disconnected via PubSub
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "device_disconnected", device_id: device.id}
      )

      # RC window should receive the message
      assert_push "device_disconnected", %{device_id: device_id}
      assert device_id == device.id
    end
  end

  describe "handle_info media_frame" do
    test "pushes media frames to RC window", %{user: user, session: session} do
      {:ok, _, _socket} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Broadcast media frame via PubSub
      frame_data = Base.encode64("fake_frame_data")
      frame_payload = %{"data" => frame_data, "timestamp" => 123456}
      
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "media_frame", payload: frame_payload}
      )

      # RC window should receive the frame
      assert_push "media_frame", %{"data" => ^frame_data}
    end
  end

  describe "handle_info media_metadata" do
    test "pushes media metadata to RC window", %{user: user, session: session} do
      {:ok, _, _socket} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Broadcast media metadata via PubSub
      metadata = %{"resolution" => "1920x1080", "fps" => 30}
      
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "media_metadata", payload: metadata}
      )

      # RC window should receive the metadata
      assert_push "media_metadata", ^metadata
    end
  end

  describe "handle_info media_stream_ready" do
    test "pushes media_stream_ready message to RC window", %{user: user, session: session, device: device} do
      {:ok, _, _socket} = CastmillWeb.RcSocket
        |> socket("user_socket", %{user_id: user.id})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Broadcast media_stream_ready via PubSub
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "media_stream_ready", device_id: device.id}
      )

      # RC window should receive the message
      assert_push "media_stream_ready", %{device_id: device_id}
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
