defmodule Castmill.Devices.RcTelemetry do
  @moduledoc """
  Telemetry instrumentation for Remote Control sessions.
  
  Emits telemetry events for monitoring session lifecycle, performance metrics,
  and operational health.
  """

  @doc """
  Emits telemetry event when a new RC session is created.
  """
  def session_created(session_id, device_id, user_id) do
    :telemetry.execute(
      [:castmill, :rc_session, :created],
      %{count: 1},
      %{session_id: session_id, device_id: device_id, user_id: user_id}
    )
  end

  @doc """
  Emits telemetry event when an RC session transitions state.
  """
  def session_state_transition(session_id, device_id, from_state, to_state) do
    :telemetry.execute(
      [:castmill, :rc_session, :state_transition],
      %{count: 1},
      %{
        session_id: session_id,
        device_id: device_id,
        from_state: from_state,
        to_state: to_state
      }
    )
  end

  @doc """
  Emits telemetry event when an RC session is closed.
  """
  def session_closed(session_id, device_id, duration_ms) do
    :telemetry.execute(
      [:castmill, :rc_session, :closed],
      %{count: 1, duration: duration_ms},
      %{session_id: session_id, device_id: device_id}
    )
  end

  @doc """
  Emits telemetry event when a session times out.
  """
  def session_timeout(session_id, device_id, state) do
    :telemetry.execute(
      [:castmill, :rc_session, :timeout],
      %{count: 1},
      %{session_id: session_id, device_id: device_id, state: state}
    )
  end

  @doc """
  Emits telemetry event when a control event is sent.
  Includes latency measurement in microseconds.
  """
  def control_event_sent(session_id, device_id, latency_us) do
    :telemetry.execute(
      [:castmill, :rc_session, :control_event],
      %{count: 1, latency: latency_us},
      %{session_id: session_id, device_id: device_id}
    )
  end

  @doc """
  Emits telemetry event when a media frame is received.
  """
  def media_frame_received(session_id, device_id, frame_size_bytes, frame_metadata \\ %{}) do
    measurements = %{
      count: 1,
      size: frame_size_bytes
    }

    measurements =
      case frame_metadata do
        %{fps: fps} -> Map.put(measurements, :fps, fps)
        _ -> measurements
      end

    :telemetry.execute(
      [:castmill, :rc_session, :media_frame],
      measurements,
      %{session_id: session_id, device_id: device_id}
    )
  end

  @doc """
  Emits telemetry event when frames are dropped.
  """
  def frames_dropped(session_id, device_id, dropped_count) do
    :telemetry.execute(
      [:castmill, :rc_session, :frames_dropped],
      %{count: dropped_count},
      %{session_id: session_id, device_id: device_id}
    )
  end

  @doc """
  Emits telemetry event for session activity update.
  """
  def session_activity(session_id, device_id) do
    :telemetry.execute(
      [:castmill, :rc_session, :activity],
      %{count: 1},
      %{session_id: session_id, device_id: device_id}
    )
  end

  @doc """
  Emits telemetry event with current count of active sessions.
  """
  def active_sessions_count(count) do
    :telemetry.execute(
      [:castmill, :rc_session, :active_sessions],
      %{count: count},
      %{}
    )
  end

  @doc """
  Emits telemetry event when a relay fails to start.
  """
  def relay_start_failed(session_id, device_id, reason) do
    :telemetry.execute(
      [:castmill, :rc_session, :relay_failed],
      %{count: 1},
      %{session_id: session_id, device_id: device_id, reason: inspect(reason)}
    )
  end

  @doc """
  Emits telemetry event when control queue is full.
  """
  def control_queue_full(session_id, device_id) do
    :telemetry.execute(
      [:castmill, :rc_session, :queue_full],
      %{count: 1},
      %{session_id: session_id, device_id: device_id}
    )
  end
end
