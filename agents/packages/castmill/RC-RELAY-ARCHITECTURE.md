# Remote Control Relay Architecture

## Overview

The Remote Control (RC) relay system manages message flow between devices and dashboard RC windows during active remote control sessions. It implements intelligent queue management with backpressure to ensure reliable real-time communication while preventing resource exhaustion.

## Architecture

### Components

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│                 │         │              │         │                 │
│  Device (WS)    │────────▶│  RC Relay    │────────▶│  RC Window (WS) │
│                 │         │  GenServer   │         │                 │
│  - Control      │◀────────│              │◀────────│  - Media Frames │
│  - Media        │         │  - Queues    │         │  - Control      │
│                 │         │  - Validate  │         │                 │
└─────────────────┘         │  - Forward   │         └─────────────────┘
                            └──────────────┘
                                   │
                                   │ PubSub
                                   ▼
                            ┌──────────────┐
                            │   Phoenix    │
                            │   PubSub     │
                            └──────────────┘
```

### Key Modules

1. **`Castmill.Devices.RcMessageSchemas`**
   - Validates all WebSocket message payloads
   - Ensures type safety and structure compliance
   - Provides clear error messages

2. **`Castmill.Devices.RcRelay`**
   - GenServer managing per-session relay logic
   - Implements bounded queues with backpressure
   - Forwards validated messages via PubSub
   - Tracks statistics for monitoring

3. **`Castmill.Devices.RcRelaySupervisor`**
   - DynamicSupervisor for relay processes
   - One relay per active session
   - Automatic restart on failure

4. **`Castmill.Devices.RcRelayRegistry`**
   - Registry for session-scoped relay lookup
   - Enables direct relay access by session ID

## Message Flow

### Control Events (RC Window → Device)

1. User sends control event (keyboard/mouse) from RC window
2. `RcWindowChannel` receives message
3. Message validated by `RcMessageSchemas`
4. Valid message enqueued to relay
5. Relay forwards to device via PubSub
6. `DeviceRcChannel` pushes to device WebSocket
7. Activity timestamp updated

```elixir
# Control event example
%{
  "type" => "keydown",
  "key" => "Enter",
  "ctrl" => true,
  "shift" => false,
  "alt" => false,
  "meta" => false
}
```

### Media Frames (Device → RC Window)

1. Device sends media frame with frame type
2. `DeviceMediaChannel` receives frame
3. Frame validated by `RcMessageSchemas`
4. Frame enqueued to relay with backpressure logic
5. Relay forwards to RC window via PubSub
6. `RcWindowChannel` pushes to window WebSocket

```elixir
# Media frame example
%{
  "data" => "base64_encoded_jpeg_or_h264",
  "frame_type" => "idr",  # or "p"
  "timestamp" => 1234567890
}
```

## Backpressure Management

### Control Queue

- **Max Size**: 100 messages
- **Strategy**: Drop new messages when full
- **Use Case**: Prevents memory exhaustion from rapid input
- **Metric**: `control_dropped` counter

### Media Queue

- **Max Size**: 30 frames
- **Strategy**: Intelligent frame dropping
  - **IDR Frames (Keyframes)**: Always forwarded, never dropped
  - **P-Frames (Predictive)**: Dropped when queue is full
- **Rationale**: 
  - IDR frames are required for video decode initialization
  - P-frames can be skipped without breaking the stream
  - Ensures smooth video even under network congestion

```elixir
# Backpressure logic
def handle_call({:enqueue_media, payload}, _from, state) do
  frame_type = get_frame_type(payload)
  queue_size = :queue.len(state.media_queue)

  cond do
    # Always forward IDR frames
    frame_type == "idr" ->
      enqueue_and_forward(payload, state)

    # Drop P-frames if queue is full
    queue_size >= @media_queue_max_size ->
      {:reply, {:ok, :dropped}, increment_dropped(state)}

    # Enqueue P-frame
    true ->
      enqueue_and_forward(payload, state)
  end
end
```

## Message Schemas

### Control Event Schema

**Keyboard Events** (`keydown`, `keyup`):
```elixir
%{
  "type" => "keydown" | "keyup",           # required
  "key" => string,                          # required
  "code" => string,                         # optional
  "shift" => boolean,                       # optional
  "ctrl" => boolean,                        # optional
  "alt" => boolean,                         # optional
  "meta" => boolean                         # optional
}
```

**Mouse Events** (`click`, `mousedown`, `mouseup`, `mousemove`):
```elixir
%{
  "type" => "click" | "mousedown" | "mouseup" | "mousemove",  # required
  "x" => number,                            # required
  "y" => number,                            # required
  "button" => 0 | 1 | 2                     # optional (0=left, 1=middle, 2=right)
}
```

### Media Frame Schema

```elixir
%{
  "data" => string,                         # required (base64 encoded)
  "frame_type" => "idr" | "p" | "IDR" | "P", # optional (default: "p")
  "timestamp" => number,                    # optional
  # Additional optional fields for metadata
  "width" => number,
  "height" => number,
  "sequence" => number
}
```

### Media Metadata Schema

```elixir
%{
  "resolution" => string,                   # e.g., "1920x1080"
  "fps" => number,                          # frames per second
  "codec" => string,                        # e.g., "h264", "jpeg"
  "bitrate" => number,                      # optional
  # Any other metadata fields are allowed
}
```

### Device Event Schema

```elixir
%{
  "type" => string,                         # required (event type)
  # Any other fields are allowed based on event type
}
```

## Session Lifecycle with Relay

### Session Creation

1. `RcSessions.create_session/2` called via REST API
2. Session record created in database
3. `RcRelaySupervisor.start_relay/1` starts relay GenServer
4. Relay subscribes to session PubSub topic
5. Session enters "created" state

### Session Starting

1. First connection (device or window) joins
2. Session transitions to "starting" state
3. Relay remains active, ready to forward messages

### Session Streaming

1. Both device and window are connected
2. Session transitions to "streaming" state
3. Messages flow bidirectionally through relay
4. Activity timestamps updated on each message

### Session Closure

1. `RcSessions.transition_to_closed/1` called
2. Relay receives shutdown signal
3. `RcRelaySupervisor.stop_relay/1` terminates relay
4. PubSub broadcasts "session_closed" event
5. Channels disconnect gracefully

## Statistics and Monitoring

The relay tracks comprehensive statistics for each session:

```elixir
%{
  # Control queue stats
  control_enqueued: integer,      # Total control events enqueued
  control_forwarded: integer,     # Total control events forwarded
  control_dropped: integer,       # Control events dropped (queue full)
  control_queue_size: integer,    # Current control queue size

  # Media queue stats
  media_enqueued: integer,        # Total media frames enqueued
  media_forwarded: integer,       # Total media frames forwarded
  media_dropped: integer,         # Total frames dropped
  media_queue_size: integer,      # Current media queue size

  # Frame type stats
  idr_frames: integer,            # IDR frames processed
  p_frames_dropped: integer       # P-frames dropped due to backpressure
}
```

Access statistics:
```elixir
{:ok, stats} = RcRelay.get_stats(session_id)
```

## Testing

### Unit Tests

- **Message Schema Tests** (`rc_message_schemas_test.exs`)
  - Validates all message types
  - Tests error conditions
  - Ensures clear error messages

- **Relay Tests** (`rc_relay_test.exs`)
  - Queue management
  - Backpressure logic
  - Statistics accuracy
  - IDR/P-frame handling

### Integration Tests

- **Relay Integration Tests** (`rc_relay_integration_test.exs`)
  - End-to-end message flow
  - Control and media relay
  - Backpressure under load
  - Session lifecycle
  - Multi-channel coordination

### Running Tests

```bash
cd packages/castmill

# Run all relay tests
mix test test/castmill/devices/rc_relay_test.exs

# Run integration tests
mix test test/castmill_web/channels/rc_relay_integration_test.exs

# Run message schema tests
mix test test/castmill/devices/rc_message_schemas_test.exs

# Run all RC-related tests
mix test test/castmill/devices/rc_*
mix test test/castmill_web/channels/*rc*
```

## Performance Considerations

### Memory Usage

- Each relay holds two queues in memory
- Control queue: ~100 * message_size (~10KB typical)
- Media queue: ~30 * frame_size (~500KB typical for JPEG)
- Total per session: ~15MB maximum

### CPU Usage

- Message validation: O(1) per message
- Queue operations: O(1) enqueue/dequeue
- PubSub broadcasting: Handled by Phoenix
- Statistics updates: Atomic counters

### Network Impact

- Relay adds minimal latency (< 1ms)
- Backpressure prevents network congestion
- IDR prioritization ensures video continuity

## References

- [Phoenix PubSub Documentation](https://hexdocs.pm/phoenix_pubsub/)
- [GenServer Guide](https://hexdocs.pm/elixir/GenServer.html)
- [OTP Supervisor](https://hexdocs.pm/elixir/Supervisor.html)
- [Video Codec Basics (IDR/P-frames)](https://en.wikipedia.org/wiki/Video_compression_picture_types)
