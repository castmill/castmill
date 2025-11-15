defmodule Castmill.Devices.RcRelayTest do
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.AccountsFixtures
  import Castmill.RcSessionsFixtures

  alias Castmill.Devices.RcRelay
  alias Castmill.Devices.RcRelaySupervisor

  setup do
    # Create test data
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})
    device = device_fixture(%{organization_id: organization.id})

    # Create an active RC session (relay will be started automatically)
    session = rc_session_fixture(%{device_id: device.id, user_id: user.id})

    # Subscribe to PubSub to verify messages
    Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session.id}")

    {:ok, session: session, device: device, user: user}
  end

  describe "relay initialization" do
    test "relay is started automatically when session is created", %{session: session} do
      # Get stats to verify relay is running
      assert {:ok, stats} = RcRelay.get_stats(session.id)
      assert is_map(stats)
      assert stats.control_enqueued == 0
      assert stats.media_enqueued == 0
    end
  end

  describe "enqueue_control_event/2" do
    test "enqueues and forwards valid control event", %{session: session} do
      payload = %{"type" => "keydown", "key" => "Enter"}

      assert :ok = RcRelay.enqueue_control_event(session.id, payload)

      # Should receive the forwarded event via PubSub
      assert_receive %{event: "control_event", payload: ^payload, source: :relay}

      # Verify stats
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.control_enqueued == 1
      assert stats.control_forwarded == 1
    end

    test "validates control event before enqueuing", %{session: session} do
      invalid_payload = %{"invalid" => "message"}

      assert {:error, :invalid_message} = RcRelay.enqueue_control_event(session.id, invalid_payload)

      # Should not receive any message
      refute_receive %{event: "control_event"}

      # Stats should show no activity
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.control_enqueued == 0
    end

    test "handles queue full condition", %{session: session} do
      # Fill the queue beyond capacity (max 100)
      valid_payload = %{"type" => "keydown", "key" => "a"}

      # Enqueue 105 messages - first 100 should succeed, rest should fail
      results =
        for _ <- 1..105 do
          RcRelay.enqueue_control_event(session.id, valid_payload)
        end

      # Should have at least one queue_full error
      assert Enum.any?(results, fn result -> result == {:error, :queue_full} end)

      # Clear PubSub messages
      :timer.sleep(50)
      flush_messages()

      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.control_dropped > 0
    end

    test "returns error for non-existent session" do
      fake_session_id = Ecto.UUID.generate()
      payload = %{"type" => "keydown", "key" => "Enter"}

      assert {:error, :session_not_found} = RcRelay.enqueue_control_event(fake_session_id, payload)
    end
  end

  describe "enqueue_media_frame/2" do
    test "enqueues and forwards IDR frame", %{session: session} do
      payload = %{"data" => "base64data", "frame_type" => "idr"}

      assert :ok = RcRelay.enqueue_media_frame(session.id, payload)

      # Should receive the forwarded frame via PubSub
      assert_receive %{event: "media_frame", payload: ^payload, source: :relay}

      # Verify stats
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.media_enqueued == 1
      assert stats.media_forwarded == 1
      assert stats.idr_frames == 1
    end

    test "enqueues and forwards P-frame when queue not full", %{session: session} do
      payload = %{"data" => "base64data", "frame_type" => "p"}

      assert :ok = RcRelay.enqueue_media_frame(session.id, payload)

      # Should receive the forwarded frame via PubSub
      assert_receive %{event: "media_frame", payload: ^payload, source: :relay}

      # Verify stats
      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.media_enqueued == 1
      assert stats.media_forwarded == 1
    end

    test "always forwards IDR frames even when queue is full", %{session: session} do
      # Fill queue with P-frames
      p_frame = %{"data" => "pframe", "frame_type" => "p"}

      for _ <- 1..30 do
        RcRelay.enqueue_media_frame(session.id, p_frame)
      end

      # Clear PubSub messages
      :timer.sleep(50)
      flush_messages()

      # Now send IDR frame - should be forwarded despite full queue
      idr_frame = %{"data" => "idrframe", "frame_type" => "idr"}
      assert :ok = RcRelay.enqueue_media_frame(session.id, idr_frame)

      # Should receive IDR frame
      assert_receive %{event: "media_frame", payload: ^idr_frame, source: :relay}

      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.idr_frames >= 1
    end

    test "drops P-frames when queue is full (backpressure)", %{session: session} do
      # Fill queue to capacity with P-frames
      p_frame = %{"data" => "pframe", "frame_type" => "p"}

      for _ <- 1..30 do
        RcRelay.enqueue_media_frame(session.id, p_frame)
      end

      # Clear PubSub messages
      :timer.sleep(50)
      flush_messages()

      # Try to enqueue more P-frames - should be dropped
      results =
        for _ <- 1..10 do
          RcRelay.enqueue_media_frame(session.id, p_frame)
        end

      # Should have at least some dropped frames
      assert Enum.any?(results, fn result -> result == {:ok, :dropped} end)

      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.p_frames_dropped > 0
    end

    test "validates media frame before enqueuing", %{session: session} do
      invalid_payload = %{"frame_type" => "idr"}  # Missing data field

      assert {:error, :invalid_message} = RcRelay.enqueue_media_frame(session.id, invalid_payload)

      # Should not receive any message
      refute_receive %{event: "media_frame"}

      {:ok, stats} = RcRelay.get_stats(session.id)
      assert stats.media_enqueued == 0
    end

    test "defaults to P-frame when frame_type not specified", %{session: session} do
      payload = %{"data" => "base64data"}

      assert :ok = RcRelay.enqueue_media_frame(session.id, payload)

      # Should receive the frame
      assert_receive %{event: "media_frame", payload: ^payload, source: :relay}

      # Fill queue and verify it gets dropped like a P-frame
      for _ <- 1..30 do
        RcRelay.enqueue_media_frame(session.id, payload)
      end

      :timer.sleep(50)
      flush_messages()

      # Next frame should be dropped
      assert {:ok, :dropped} = RcRelay.enqueue_media_frame(session.id, payload)
    end

    test "returns error for non-existent session" do
      fake_session_id = Ecto.UUID.generate()
      payload = %{"data" => "base64data", "frame_type" => "idr"}

      assert {:error, :session_not_found} = RcRelay.enqueue_media_frame(fake_session_id, payload)
    end
  end

  describe "get_stats/1" do
    test "returns comprehensive statistics", %{session: session} do
      # Enqueue some messages
      control = %{"type" => "keydown", "key" => "a"}
      idr = %{"data" => "idr", "frame_type" => "idr"}
      p_frame = %{"data" => "p", "frame_type" => "p"}

      RcRelay.enqueue_control_event(session.id, control)
      RcRelay.enqueue_media_frame(session.id, idr)
      RcRelay.enqueue_media_frame(session.id, p_frame)

      :timer.sleep(50)

      {:ok, stats} = RcRelay.get_stats(session.id)

      # Verify stat structure
      assert is_integer(stats.control_enqueued)
      assert is_integer(stats.control_forwarded)
      assert is_integer(stats.control_dropped)
      assert is_integer(stats.media_enqueued)
      assert is_integer(stats.media_forwarded)
      assert is_integer(stats.media_dropped)
      assert is_integer(stats.idr_frames)
      assert is_integer(stats.p_frames_dropped)
      assert is_integer(stats.control_queue_size)
      assert is_integer(stats.media_queue_size)

      # Verify counts
      assert stats.control_enqueued >= 1
      assert stats.media_enqueued >= 2
      assert stats.idr_frames >= 1
    end

    test "returns error for non-existent session" do
      fake_session_id = Ecto.UUID.generate()
      assert {:error, :session_not_found} = RcRelay.get_stats(fake_session_id)
    end
  end

  describe "relay lifecycle" do
    test "relay stops when session is closed", %{session: session} do
      # Verify relay is running
      assert {:ok, _stats} = RcRelay.get_stats(session.id)

      # Close the session
      Castmill.Devices.RcSessions.transition_to_closed(session.id)

      # Relay should be stopped
      :timer.sleep(100)
      assert {:error, :session_not_found} = RcRelay.get_stats(session.id)
    end

    test "can manually stop relay", %{session: session} do
      # Verify relay is running
      assert {:ok, _stats} = RcRelay.get_stats(session.id)

      # Stop relay
      :ok = RcRelay.stop(session.id)

      # Relay should be stopped
      :timer.sleep(50)
      assert {:error, :session_not_found} = RcRelay.get_stats(session.id)
    end
  end

  # Helper to flush all messages from mailbox
  defp flush_messages do
    receive do
      _ -> flush_messages()
    after
      0 -> :ok
    end
  end
end
