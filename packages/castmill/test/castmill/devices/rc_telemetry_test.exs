defmodule Castmill.Devices.RcTelemetryTest do
  use ExUnit.Case, async: true

  alias Castmill.Devices.RcTelemetry

  setup do
    # Attach a test handler to capture telemetry events
    test_pid = self()
    handler_id = "test-handler-#{:erlang.unique_integer([:positive])}"

    :telemetry.attach_many(
      handler_id,
      [
        [:castmill, :rc_session, :created],
        [:castmill, :rc_session, :state_transition],
        [:castmill, :rc_session, :closed],
        [:castmill, :rc_session, :timeout],
        [:castmill, :rc_session, :control_event],
        [:castmill, :rc_session, :media_frame],
        [:castmill, :rc_session, :frames_dropped],
        [:castmill, :rc_session, :activity],
        [:castmill, :rc_session, :active_sessions],
        [:castmill, :rc_session, :relay_failed],
        [:castmill, :rc_session, :queue_full]
      ],
      fn event_name, measurements, metadata, _config ->
        send(test_pid, {:telemetry_event, event_name, measurements, metadata})
      end,
      nil
    )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    :ok
  end

  describe "session_created/3" do
    test "emits telemetry event with correct data" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()
      user_id = Ecto.UUID.generate()

      RcTelemetry.session_created(session_id, device_id, user_id)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :created], measurements,
                      metadata}

      assert measurements.count == 1
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
      assert metadata.user_id == user_id
    end
  end

  describe "session_state_transition/4" do
    test "emits telemetry event for state transitions" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      RcTelemetry.session_state_transition(session_id, device_id, "created", "starting")

      assert_receive {:telemetry_event, [:castmill, :rc_session, :state_transition],
                      measurements, metadata}

      assert measurements.count == 1
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
      assert metadata.from_state == "created"
      assert metadata.to_state == "starting"
    end
  end

  describe "session_closed/3" do
    test "emits telemetry event with duration" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()
      duration_ms = 5000

      RcTelemetry.session_closed(session_id, device_id, duration_ms)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :closed], measurements,
                      metadata}

      assert measurements.count == 1
      assert measurements.duration == duration_ms
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
    end
  end

  describe "session_timeout/3" do
    test "emits telemetry event for timeout" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      RcTelemetry.session_timeout(session_id, device_id, "streaming")

      assert_receive {:telemetry_event, [:castmill, :rc_session, :timeout], measurements,
                      metadata}

      assert measurements.count == 1
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
      assert metadata.state == "streaming"
    end
  end

  describe "control_event_sent/3" do
    test "emits telemetry event with latency" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()
      latency_us = 1500

      RcTelemetry.control_event_sent(session_id, device_id, latency_us)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :control_event], measurements,
                      metadata}

      assert measurements.count == 1
      assert measurements.latency == latency_us
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
    end
  end

  describe "media_frame_received/4" do
    test "emits telemetry event with frame size" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()
      frame_size = 1024

      RcTelemetry.media_frame_received(session_id, device_id, frame_size)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :media_frame], measurements,
                      metadata}

      assert measurements.count == 1
      assert measurements.size == frame_size
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
    end

    test "emits telemetry event with fps metadata" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()
      frame_size = 2048

      RcTelemetry.media_frame_received(session_id, device_id, frame_size, %{fps: 30})

      assert_receive {:telemetry_event, [:castmill, :rc_session, :media_frame], measurements,
                      _metadata}

      assert measurements.fps == 30
      assert measurements.size == frame_size
    end
  end

  describe "frames_dropped/3" do
    test "emits telemetry event for dropped frames" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()
      dropped_count = 5

      RcTelemetry.frames_dropped(session_id, device_id, dropped_count)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :frames_dropped], measurements,
                      metadata}

      assert measurements.count == dropped_count
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
    end
  end

  describe "session_activity/2" do
    test "emits telemetry event for activity update" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      RcTelemetry.session_activity(session_id, device_id)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :activity], measurements,
                      metadata}

      assert measurements.count == 1
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
    end
  end

  describe "active_sessions_count/1" do
    test "emits telemetry event with active session count" do
      count = 5

      RcTelemetry.active_sessions_count(count)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :active_sessions], measurements,
                      _metadata}

      assert measurements.count == count
    end
  end

  describe "relay_start_failed/3" do
    test "emits telemetry event for relay failure" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()
      reason = :already_started

      RcTelemetry.relay_start_failed(session_id, device_id, reason)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :relay_failed], measurements,
                      metadata}

      assert measurements.count == 1
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
      assert metadata.reason =~ "already_started"
    end
  end

  describe "control_queue_full/2" do
    test "emits telemetry event when queue is full" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      RcTelemetry.control_queue_full(session_id, device_id)

      assert_receive {:telemetry_event, [:castmill, :rc_session, :queue_full], measurements,
                      metadata}

      assert measurements.count == 1
      assert metadata.session_id == session_id
      assert metadata.device_id == device_id
    end
  end
end
