defmodule CastmillWeb.RcWindowChannelTest do
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

    {:ok, device: device, user: user, session: session, organization: organization}
  end

  describe "join rc_window:session_id" do
    test "successfully joins with valid authenticated user and device_manager role", %{
      user: user,
      session: session,
      organization: organization
    } do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      assert socket.assigns.session_id == session.id
      assert socket.assigns.device_id == session.device_id

      # Verify session transitioned to starting or streaming
      updated_session = RcSessions.get_session(session.id)
      assert updated_session.state in ["starting", "streaming"]
    end

    test "rejects join without authenticated user" do
      session_id = Ecto.UUID.generate()

      assert {:error, %{reason: "Unauthorized"}} =
               CastmillWeb.RcSocket
               |> socket("user_socket", %{})
               |> subscribe_and_join(
                 CastmillWeb.RcWindowChannel,
                 "rc_window:#{session_id}",
                 %{}
               )
    end

    test "rejects join with non-existent session", %{user: user, organization: organization} do
      fake_session_id = Ecto.UUID.generate()

      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      assert {:error, %{reason: "Session not found"}} =
               CastmillWeb.RcSocket
               |> socket("user_socket", %{user: user})
               |> subscribe_and_join(
                 CastmillWeb.RcWindowChannel,
                 "rc_window:#{fake_session_id}",
                 %{}
               )
    end

    test "rejects join when user doesn't own the session", %{
      session: session,
      organization: organization
    } do
      # Create another user
      other_user = user_fixture(%{organization_id: organization.id})
      Castmill.Organizations.set_user_role(organization.id, other_user.id, :device_manager)

      assert {:error, %{reason: "Unauthorized or invalid session"}} =
               CastmillWeb.RcSocket
               |> socket("user_socket", %{user: other_user})
               |> subscribe_and_join(
                 CastmillWeb.RcWindowChannel,
                 "rc_window:#{session.id}",
                 %{}
               )
    end

    test "rejects join with stopped session", %{user: user, session: session, organization: organization} do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      # Stop the session (transitions to closed)
      {:ok, _} = RcSessions.stop_session(session.id)

      assert {:error, %{reason: "Unauthorized or invalid session"}} =
               CastmillWeb.RcSocket
               |> socket("user_socket", %{user: user})
               |> subscribe_and_join(
                 CastmillWeb.RcWindowChannel,
                 "rc_window:#{session.id}",
                 %{}
               )
    end

    test "rejects join when user lacks device_manager role", %{user: user, session: session, organization: organization} do
      # Set user to a lower role (viewer)
      Castmill.Organizations.set_user_role(organization.id, user.id, :viewer)

      assert {:error, %{reason: reason}} =
               CastmillWeb.RcSocket
               |> socket("user_socket", %{user: user})
               |> subscribe_and_join(
                 CastmillWeb.RcWindowChannel,
                 "rc_window:#{session.id}",
                 %{}
               )

      assert reason =~ "Insufficient permissions"
      assert reason =~ "device_manager"
    end
  end

  describe "handle_in control_event" do
    test "forwards control events to device via PubSub", %{user: user, session: session, organization: organization} do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
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
    test "pushes device_connected message to RC window", %{
      user: user,
      session: session,
      device: device,
      organization: organization
    } do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, _socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
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
    test "pushes device_disconnected message to RC window", %{
      user: user,
      session: session,
      device: device,
      organization: organization
    } do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, _socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
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
    test "pushes media frames to RC window", %{user: user, session: session, organization: organization} do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, _socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
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
    test "pushes media metadata to RC window", %{user: user, session: session, organization: organization} do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, _socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
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
    test "pushes media_stream_ready message to RC window", %{
      user: user,
      session: session,
      device: device,
      organization: organization
    } do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, _socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Broadcast media_stream_ready via PubSub
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session_id}",
        %{event: "media_stream_ready", device_id: device.id}
      )

      # RC window should receive the message
      assert_push "media_stream_ready", %{device_id: device_id}
      assert device_id == device.id
    end
  end

  describe "handle_info session_closed" do
    test "disconnects RC window when session is closed (timeout)", %{
      user: user,
      session: session,
      organization: organization
    } do
      # Set user to device_manager role
      Castmill.Organizations.set_user_role(organization.id, user.id, :device_manager)

      {:ok, _, _socket} =
        CastmillWeb.RcSocket
        |> socket("user_socket", %{user: user})
        |> subscribe_and_join(
          CastmillWeb.RcWindowChannel,
          "rc_window:#{session.id}",
          %{}
        )

      # Broadcast session_closed event (e.g., from timeout)
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session.id}",
        %{event: "session_closed"}
      )

      # RC window should receive session_closed message
      assert_push "session_closed", %{}
    end
  end
end
