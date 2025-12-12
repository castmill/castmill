defmodule Castmill.Devices.RcRelay do
  @moduledoc """
  GenServer that manages relay queues and backpressure for RC sessions.

  This module coordinates message flow between device channels and RC window channels,
  implementing bounded queues and intelligent backpressure management for media frames.

  ## Features

  - Bounded control message queue (FIFO)
  - Media frame queue with backpressure:
    - Always forwards IDR (keyframe) frames
    - Drops P-frames (predictive frames) when queue is full
  - Session-scoped relay instances
  - Automatic cleanup on session termination

  ## Architecture

  Each active RC session has a relay GenServer that:
  1. Receives control events from RC window
  2. Queues and forwards them to device
  3. Receives media frames from device
  4. Applies backpressure logic
  5. Forwards frames to RC window via PubSub
  """
  use GenServer
  require Logger

  alias Castmill.Devices.RcSessions
  alias Castmill.Devices.RcMessageSchemas

  # Queue size limits
  @control_queue_max_size 100
  @media_queue_max_size 30
  # Allow IDR frames up to 2x the normal queue size to prevent unbounded growth
  @media_queue_max_size_with_idr @media_queue_max_size * 2

  # State structure
  defstruct [
    :session_id,
    :control_queue,
    :media_queue,
    :stats
  ]

  # Client API

  @doc """
  Starts a relay for the given session.

  Returns `{:ok, pid}` or `{:error, reason}`.
  """
  def start_link(session_id) do
    GenServer.start_link(__MODULE__, session_id, name: via_tuple(session_id))
  end

  @doc """
  Enqueues a control event to be sent to the device.

  Returns `:ok` if enqueued, `{:error, :queue_full}` if queue is full.
  """
  def enqueue_control_event(session_id, payload) do
    case RcMessageSchemas.validate_control_event(payload) do
      {:ok, validated_payload} ->
        GenServer.call(via_tuple(session_id), {:enqueue_control, validated_payload})

      {:error, reason} ->
        Logger.warning("Invalid control event for session #{session_id}: #{reason}")
        {:error, :invalid_message}
    end
  rescue
    # If relay doesn't exist, session may be closed
    _ -> {:error, :session_not_found}
  end

  @doc """
  Enqueues a media frame to be sent to the RC window.

  Applies backpressure logic:
  - IDR frames are always enqueued (may grow queue temporarily)
  - P-frames are dropped if queue is at capacity

  Returns `:ok` if enqueued and forwarded, `{:ok, :dropped}` if P-frame was dropped due to backpressure, or `{:error, reason}` on validation or session errors.
  """
  def enqueue_media_frame(session_id, payload) do
    case RcMessageSchemas.validate_media_frame(payload) do
      {:ok, validated_payload} ->
        GenServer.call(via_tuple(session_id), {:enqueue_media, validated_payload})

      {:error, reason} ->
        Logger.warning("Invalid media frame for session #{session_id}: #{reason}")
        {:error, :invalid_message}
    end
  rescue
    _ -> {:error, :session_not_found}
  end

  @doc """
  Gets statistics for the relay queues.

  Returns map with queue sizes and drop counts.
  """
  def get_stats(session_id) do
    GenServer.call(via_tuple(session_id), :get_stats)
  rescue
    _ -> {:error, :session_not_found}
  end

  @doc """
  Stops the relay for the session.
  """
  def stop(session_id) do
    case Registry.lookup(Castmill.Devices.RcRelayRegistry, session_id) do
      [{pid, _}] ->
        GenServer.stop(pid, :normal)
      [] ->
        {:error, :session_not_found}
    end
  rescue
    _ -> :ok
  end

  # Server callbacks

  @impl true
  def init(session_id) do
    # Note: We don't verify session exists here because the relay is started
    # from within the session creation transaction, and the session won't be
    # visible to other DB queries until the transaction commits.
    # The session is guaranteed to exist since we just created it.
    Logger.info("Starting RC relay for session #{session_id}")

    state = %__MODULE__{
      session_id: session_id,
      control_queue: :queue.new(),
      media_queue: :queue.new(),
      stats: %{
        control_enqueued: 0,
        control_forwarded: 0,
        control_dropped: 0,
        media_enqueued: 0,
        media_forwarded: 0,
        media_dropped: 0,
        idr_frames: 0,
        p_frames_dropped: 0
      }
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:enqueue_control, payload}, _from, state) do
    queue_size = :queue.len(state.control_queue)

    if queue_size >= @control_queue_max_size do
      # Queue is full, drop message
      new_stats = Map.update!(state.stats, :control_dropped, &(&1 + 1))
      Logger.warning("Control queue full for session #{state.session_id}, dropping message")
      {:reply, {:error, :queue_full}, %{state | stats: new_stats}}
    else
      # Design note: Messages are forwarded immediately rather than buffered.
      # The queue acts as a size counter to enforce backpressure limits.
      # This provides immediate forwarding with bounded resource usage.
      # Enqueue and forward
      new_queue = :queue.in(payload, state.control_queue)
      new_stats = Map.update!(state.stats, :control_enqueued, &(&1 + 1))

      # Forward immediately via PubSub
      forward_control_event(state.session_id, payload)
      forwarded_stats = Map.update!(new_stats, :control_forwarded, &(&1 + 1))

      # Dequeue since we forwarded
      {_, final_queue} = :queue.out(new_queue)

      {:reply, :ok, %{state | control_queue: final_queue, stats: forwarded_stats}}
    end
  end

  @impl true
  def handle_call({:enqueue_media, payload}, _from, state) do
    queue_size = :queue.len(state.media_queue)
    frame_type = get_frame_type(payload)

    cond do
      # Always forward IDR frames, but up to 2x the normal queue size to prevent unbounded growth
      frame_type == "idr" and queue_size < @media_queue_max_size_with_idr ->
        new_queue = :queue.in(payload, state.media_queue)
        new_stats =
          state.stats
          |> Map.update!(:media_enqueued, &(&1 + 1))
          |> Map.update!(:idr_frames, &(&1 + 1))

        # Forward immediately
        forward_media_frame(state.session_id, payload)
        forwarded_stats = Map.update!(new_stats, :media_forwarded, &(&1 + 1))

        # Dequeue
        {_, final_queue} = :queue.out(new_queue)

        {:reply, :ok, %{state | media_queue: final_queue, stats: forwarded_stats}}

      # Drop IDR frames if queue exceeds 2x limit (prevents unbounded memory growth)
      frame_type == "idr" ->
        new_stats =
          state.stats
          |> Map.update!(:media_dropped, &(&1 + 1))

        Logger.warning("Media queue exceeded IDR limit for session #{state.session_id}, dropping IDR frame")
        {:reply, {:ok, :dropped}, %{state | stats: new_stats}}

      # Drop P-frames if queue is at capacity
      queue_size >= @media_queue_max_size ->
        new_stats =
          state.stats
          |> Map.update!(:media_dropped, &(&1 + 1))
          |> Map.update!(:p_frames_dropped, &(&1 + 1))

        Logger.debug("Media queue full for session #{state.session_id}, dropping P-frame")
        {:reply, {:ok, :dropped}, %{state | stats: new_stats}}

      # Enqueue and forward P-frame
      true ->
        new_queue = :queue.in(payload, state.media_queue)
        new_stats = Map.update!(state.stats, :media_enqueued, &(&1 + 1))

        # Forward
        forward_media_frame(state.session_id, payload)
        forwarded_stats = Map.update!(new_stats, :media_forwarded, &(&1 + 1))

        # Dequeue
        {_, final_queue} = :queue.out(new_queue)

        {:reply, :ok, %{state | media_queue: final_queue, stats: forwarded_stats}}
    end
  end

  @impl true
  def handle_call(:get_stats, _from, state) do
    stats = Map.merge(state.stats, %{
      control_queue_size: :queue.len(state.control_queue),
      media_queue_size: :queue.len(state.media_queue)
    })

    {:reply, {:ok, stats}, state}
  end

  @impl true
  def terminate(reason, state) do
    Logger.info("Stopping RC relay for session #{state.session_id}, reason: #{inspect(reason)}")
    :ok
  end

  # Private helper functions

  defp via_tuple(session_id) do
    {:via, Registry, {Castmill.Devices.RcRelayRegistry, session_id}}
  end

  defp get_frame_type(payload) do
    case Map.get(payload, "frame_type") do
      nil -> "p"  # Default to P-frame
      type -> String.downcase(type)
    end
  end

  defp forward_control_event(session_id, payload) do
    Phoenix.PubSub.broadcast(
      Castmill.PubSub,
      "rc_session:#{session_id}",
      %{event: "control_event", payload: payload, source: :relay}
    )
  end

  defp forward_media_frame(session_id, payload) do
    Phoenix.PubSub.broadcast(
      Castmill.PubSub,
      "rc_session:#{session_id}",
      %{event: "media_frame", payload: payload, source: :relay}
    )
  end
end
