# RC Session Observability Implementation

## Overview

This document describes the observability features implemented for Remote Control (RC) sessions in the Castmill backend. The implementation provides comprehensive logging, metrics, and alerting capabilities to monitor and debug RC session operations.

## Components

### 1. RcLogger (`lib/castmill/devices/rc_logger.ex`)

Provides structured logging with correlation IDs for all RC session operations.

**Features:**
- Session ID and Device ID correlation in all log messages
- Consistent metadata format across all logs
- Support for debug, info, warning, and error levels
- Additional custom metadata support

**Usage Example:**
```elixir
RcLogger.info("RC session created", session_id, device_id, [
  user_id: user_id,
  timeout_seconds: 300
])
```

**Log Output Format:**
All logs include the following metadata:
- `session_id`: UUID of the RC session
- `device_id`: UUID of the device
- `component`: Always set to `:rc_session`
- Additional custom metadata as needed

### 2. RcTelemetry (`lib/castmill/devices/rc_telemetry.ex`)

Emits telemetry events for monitoring RC session lifecycle and performance.

**Events Emitted:**

#### Session Lifecycle Events
- `[:castmill, :rc_session, :created]` - When a new session is created
- `[:castmill, :rc_session, :state_transition]` - On state transitions
- `[:castmill, :rc_session, :closed]` - When session closes
- `[:castmill, :rc_session, :timeout]` - When session times out

#### Performance Events
- `[:castmill, :rc_session, :control_event]` - Control event sent (includes latency)
- `[:castmill, :rc_session, :media_frame]` - Media frame received (includes size, FPS)
- `[:castmill, :rc_session, :activity]` - Session activity update

#### Error Events
- `[:castmill, :rc_session, :relay_failed]` - Relay start failure
- `[:castmill, :rc_session, :queue_full]` - Control queue full
- `[:castmill, :rc_session, :frames_dropped]` - Frames dropped

#### Monitoring Events
- `[:castmill, :rc_session, :active_sessions]` - Current active session count

**Usage Example:**
```elixir
RcTelemetry.session_created(session_id, device_id, user_id)
RcTelemetry.control_event_sent(session_id, device_id, latency_us)
```

### 3. Metrics Definitions (`lib/castmill_web/telemetry.ex`)

Metrics defined in the Phoenix telemetry module for monitoring:

**Counters:**
- `castmill.rc_session.created.count` - Total sessions created
- `castmill.rc_session.closed.count` - Total sessions closed
- `castmill.rc_session.timeout.count` - Total timeouts (tagged by state)
- `castmill.rc_session.state_transition.count` - State transitions (tagged by from/to state)
- `castmill.rc_session.control_event.count` - Control events sent
- `castmill.rc_session.media_frame.count` - Media frames received
- `castmill.rc_session.frames_dropped.count` - Frames dropped
- `castmill.rc_session.relay_failed.count` - Relay failures
- `castmill.rc_session.queue_full.count` - Queue full events

**Summaries:**
- `castmill.rc_session.closed.duration` - Session duration (milliseconds)
- `castmill.rc_session.control_event.latency` - Control event latency (microseconds)
- `castmill.rc_session.media_frame.size` - Frame size (bytes)

**Last Values:**
- `castmill.rc_session.media_frame.fps` - Current FPS
- `castmill.rc_session.active_sessions.count` - Active session count

## Instrumentation Points

### Session Lifecycle

#### Session Creation (`RcSessions.create_session/3`)
- **Log:** Info level with session details and timeout
- **Telemetry:** `session_created` event
- **Metrics:** Increments `created.count`

#### State Transitions (`RcSessions.transition_state/2`)
- **Log:** Info level with from/to states
- **Telemetry:** `state_transition` event
- **Metrics:** Increments `state_transition.count` with state tags

#### Session Closure (`RcSessions.transition_to_closed/1`)
- **Log:** Info level with duration
- **Telemetry:** `session_closed` event with duration
- **Metrics:** Increments `closed.count`, records duration

#### Session Timeout (`RcSessions.check_and_close_timed_out_sessions/1`)
- **Log:** Warning level with timeout details
- **Telemetry:** `session_timeout` event
- **Metrics:** Increments `timeout.count` with state tag

#### Relay Failure
- **Log:** Error level with failure reason
- **Telemetry:** `relay_failed` event
- **Metrics:** Increments `relay_failed.count`

### Channel Operations

#### Device Connection (`DeviceRcChannel.join/3`)
- **Log:** Info level on successful connection
- **Metrics:** Tracked via state transition to "starting"

#### Device Disconnection (`DeviceRcChannel.terminate/2`)
- **Log:** Info level on disconnection
- **Metrics:** Tracked indirectly via session state

#### RC Window Connection (`RcWindowChannel.join/3`)
- **Log:** Info level with user details
- **Metrics:** Tracked via state transition to "starting"

#### RC Window Disconnection (`RcWindowChannel.terminate/2`)
- **Log:** Info level on disconnection

#### Control Events (`RcWindowChannel.handle_in("control_event", ...`)
- **Log:** Warning level if queue full
- **Telemetry:** `control_event_sent` with latency measurement
- **Metrics:** Increments `control_event.count`, records latency
- **Alert:** Logs and emits telemetry when queue is full

#### Media Frames (`RcWindowChannel.handle_info(%{event: "media_frame", ...`)
- **Telemetry:** `media_frame_received` with size and FPS
- **Metrics:** Increments `media_frame.count`, records size and FPS

#### Session Activity (`RcSessions.update_activity/1`)
- **Telemetry:** `session_activity` event
- **Metrics:** Increments `activity.count`

## Correlation IDs

All logs and telemetry events include correlation IDs for traceability:

- **session_id**: Unique identifier for the RC session
- **device_id**: Unique identifier for the device

These IDs allow:
- Tracing all events related to a specific session
- Correlating logs across different components
- Debugging issues by filtering on session or device
- Aggregating metrics per device or session

## Alerts and Monitoring

### Timeout Alerts

Sessions that exceed their timeout period trigger:
1. Warning-level log with timeout details
2. Telemetry timeout event
3. Automatic closure of the session

**Configuration:**
- Default timeout: 300 seconds (5 minutes)
- Configurable per session via `timeout_seconds` option
- Checked periodically and on-demand

### Stuck Session Detection

Stuck sessions are detected via:
- Timeout mechanism (no activity for timeout period)
- State-based monitoring (sessions in active states for too long)

**Indicators of stuck sessions:**
- High `timeout.count` metric
- Sessions in "starting" state for extended periods
- Control events with increasing latency

### Error Tracking

The following errors are tracked:

1. **Relay Start Failures**
   - Log level: Error
   - Metric: `relay_failed.count`
   - Indicates infrastructure issues

2. **Queue Full Events**
   - Log level: Warning
   - Metric: `queue_full.count`
   - Indicates backpressure or slow device

3. **Frame Drops**
   - Metric: `frames_dropped.count`
   - Indicates network or performance issues

## Usage Examples

### Monitoring Active Sessions

```elixir
# Get current active sessions count
:telemetry.execute(
  [:castmill, :rc_session, :active_sessions],
  %{count: active_count},
  %{}
)
```

### Tracking Session Performance

```elixir
# Session duration is automatically tracked
# Check metrics:
# - castmill.rc_session.closed.duration (summary)
# - Filter by session_id or device_id for specific analysis
```

### Debugging High Latency

```elixir
# Control event latency is automatically tracked
# Check metrics:
# - castmill.rc_session.control_event.latency (summary)
# Look for sessions with consistently high latency
```

### Finding Timed Out Sessions

```elixir
# Check logs for:
# [warning] RC session timed out session_id=... device_id=... state=...

# Check metrics:
# - castmill.rc_session.timeout.count (counter)
# - Tagged by state to identify where timeouts occur
```

## Testing

Comprehensive tests ensure observability works correctly:

### Logger Tests (`test/castmill/devices/rc_logger_test.exs`)
- Verifies correlation IDs are included
- Tests all log levels
- Validates custom metadata

### Telemetry Tests (`test/castmill/devices/rc_telemetry_test.exs`)
- Verifies all events are emitted
- Validates measurements and metadata
- Tests edge cases

### Integration Tests (`test/castmill/devices/rc_sessions_test.exs`)
- Tests logging in session lifecycle
- Verifies telemetry in real scenarios
- Validates timeout alerting

## Performance Considerations

1. **Logging:** Uses Elixir's Logger which is asynchronous by default
2. **Telemetry:** Events are lightweight and non-blocking
3. **Metrics:** Stored in-memory, minimal overhead
4. **Correlation IDs:** Passed as metadata, no performance impact

## Future Enhancements

Potential improvements:
1. Add distributed tracing support (OpenTelemetry)
2. Export metrics to Prometheus/StatsD
3. Add custom alerting rules
4. Dashboard for real-time monitoring
5. Anomaly detection for unusual patterns
6. Historical trend analysis
