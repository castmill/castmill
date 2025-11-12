defmodule Castmill.Relay.SessionManager do
  @moduledoc """
  Manages remote control sessions between devices and RC clients.
  
  This GenServer maintains active session state, including:
  - Session ID to device ID mapping
  - Session ID to RC client channel PIDs
  - Bounded queues for backpressure management
  - Frame dropping logic for P-frames
  """

  use GenServer
  require Logger

  @max_queue_size 100
  @max_p_frame_drops 5

  defmodule SessionState do
    @moduledoc false
    defstruct [
      :session_id,
      :device_id,
      :device_channel_pid,
      :rc_channel_pids,
      :frame_queue,
      :p_frame_drops,
      :status,
      :created_at
    ]
  end

  # Client API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Creates a new remote control session.
  """
  def create_session(session_id, device_id, rc_channel_pid) do
    GenServer.call(__MODULE__, {:create_session, session_id, device_id, rc_channel_pid})
  end

  @doc """
  Adds a remote control channel to an existing session (for multiple viewers).
  """
  def add_rc_channel(session_id, rc_channel_pid) do
    GenServer.call(__MODULE__, {:add_rc_channel, session_id, rc_channel_pid})
  end

  @doc """
  Removes a remote control channel from a session.
  """
  def remove_rc_channel(session_id, rc_channel_pid) do
    GenServer.call(__MODULE__, {:remove_rc_channel, session_id, rc_channel_pid})
  end

  @doc """
  Associates a device channel with a session.
  """
  def set_device_channel(session_id, device_channel_pid) do
    GenServer.call(__MODULE__, {:set_device_channel, session_id, device_channel_pid})
  end

  @doc """
  Enqueues a media frame for relay to RC clients.
  Implements backpressure by dropping P-frames when queue is full.
  Always forwards IDR frames.
  """
  def enqueue_frame(session_id, frame) do
    GenServer.cast(__MODULE__, {:enqueue_frame, session_id, frame})
  end

  @doc """
  Stops a session and cleans up resources.
  """
  def stop_session(session_id) do
    GenServer.call(__MODULE__, {:stop_session, session_id})
  end

  @doc """
  Gets session information.
  """
  def get_session(session_id) do
    GenServer.call(__MODULE__, {:get_session, session_id})
  end

  @doc """
  Lists all active sessions for a device.
  """
  def list_device_sessions(device_id) do
    GenServer.call(__MODULE__, {:list_device_sessions, device_id})
  end

  # Server callbacks

  @impl true
  def init(_opts) do
    # State: %{session_id => SessionState}
    {:ok, %{}}
  end

  @impl true
  def handle_call({:create_session, session_id, device_id, rc_channel_pid}, _from, state) do
    if Map.has_key?(state, session_id) do
      {:reply, {:error, :session_exists}, state}
    else
      session = %SessionState{
        session_id: session_id,
        device_id: device_id,
        device_channel_pid: nil,
        rc_channel_pids: [rc_channel_pid],
        frame_queue: :queue.new(),
        p_frame_drops: 0,
        status: :pending,
        created_at: DateTime.utc_now()
      }

      # Monitor the RC channel process
      Process.monitor(rc_channel_pid)

      Logger.info("Created session #{session_id} for device #{device_id}")

      {:reply, {:ok, session}, Map.put(state, session_id, session)}
    end
  end

  @impl true
  def handle_call({:add_rc_channel, session_id, rc_channel_pid}, _from, state) do
    case Map.get(state, session_id) do
      nil ->
        {:reply, {:error, :session_not_found}, state}

      session ->
        if rc_channel_pid in session.rc_channel_pids do
          {:reply, {:error, :already_added}, state}
        else
          Process.monitor(rc_channel_pid)
          updated_session = %{session | rc_channel_pids: [rc_channel_pid | session.rc_channel_pids]}
          {:reply, :ok, Map.put(state, session_id, updated_session)}
        end
    end
  end

  @impl true
  def handle_call({:remove_rc_channel, session_id, rc_channel_pid}, _from, state) do
    case Map.get(state, session_id) do
      nil ->
        {:reply, {:error, :session_not_found}, state}

      session ->
        updated_pids = List.delete(session.rc_channel_pids, rc_channel_pid)

        if Enum.empty?(updated_pids) do
          # No more RC clients, stop the session
          Logger.info("Last RC client disconnected, stopping session #{session_id}")
          {:reply, :ok, Map.delete(state, session_id)}
        else
          updated_session = %{session | rc_channel_pids: updated_pids}
          {:reply, :ok, Map.put(state, session_id, updated_session)}
        end
    end
  end

  @impl true
  def handle_call({:set_device_channel, session_id, device_channel_pid}, _from, state) do
    case Map.get(state, session_id) do
      nil ->
        {:reply, {:error, :session_not_found}, state}

      session ->
        Process.monitor(device_channel_pid)
        updated_session = %{session | device_channel_pid: device_channel_pid, status: :active}
        Logger.info("Device connected to session #{session_id}")
        {:reply, :ok, Map.put(state, session_id, updated_session)}
    end
  end

  @impl true
  def handle_call({:stop_session, session_id}, _from, state) do
    case Map.get(state, session_id) do
      nil ->
        {:reply, {:error, :session_not_found}, state}

      _session ->
        Logger.info("Stopping session #{session_id}")
        {:reply, :ok, Map.delete(state, session_id)}
    end
  end

  @impl true
  def handle_call({:get_session, session_id}, _from, state) do
    {:reply, Map.get(state, session_id), state}
  end

  @impl true
  def handle_call({:list_device_sessions, device_id}, _from, state) do
    sessions =
      state
      |> Enum.filter(fn {_id, session} -> session.device_id == device_id end)
      |> Enum.map(fn {_id, session} -> session end)

    {:reply, sessions, state}
  end

  @impl true
  def handle_cast({:enqueue_frame, session_id, frame}, state) do
    case Map.get(state, session_id) do
      nil ->
        Logger.warning("Attempted to enqueue frame for non-existent session #{session_id}")
        {:noreply, state}

      session ->
        {updated_session, should_relay} = process_frame(session, frame)

        if should_relay do
          relay_frame_to_rc_clients(updated_session, frame)
        end

        {:noreply, Map.put(state, session_id, updated_session)}
    end
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    # Handle process death - could be device or RC channel
    updated_state =
      Enum.reduce(state, state, fn {session_id, session}, acc ->
        cond do
          session.device_channel_pid == pid ->
            Logger.info("Device channel died for session #{session_id}")
            Map.delete(acc, session_id)

          pid in session.rc_channel_pids ->
            Logger.info("RC channel died for session #{session_id}")
            updated_pids = List.delete(session.rc_channel_pids, pid)

            if Enum.empty?(updated_pids) do
              Map.delete(acc, session_id)
            else
              Map.put(acc, session_id, %{session | rc_channel_pids: updated_pids})
            end

          true ->
            acc
        end
      end)

    {:noreply, updated_state}
  end

  # Private functions

  defp process_frame(session, %{"frame_type" => frame_type} = frame) do
    queue_size = :queue.len(session.frame_queue)

    cond do
      # Always relay IDR frames (keyframes)
      frame_type == "idr" ->
        {%{session | frame_queue: :queue.new(), p_frame_drops: 0}, true}

      # Drop P-frames if queue is full
      frame_type == "p" && queue_size >= @max_queue_size ->
        drops = session.p_frame_drops + 1

        if drops >= @max_p_frame_drops do
          Logger.warning(
            "Dropped #{drops} P-frames for session #{session.session_id}, requesting keyframe"
          )

          # Request keyframe from device
          request_keyframe(session)
          {%{session | p_frame_drops: drops}, false}
        else
          {%{session | p_frame_drops: drops}, false}
        end

      # Relay frame if queue not full
      queue_size < @max_queue_size ->
        {%{session | frame_queue: :queue.in(frame, session.frame_queue), p_frame_drops: 0}, true}

      # Default: don't relay
      true ->
        {session, false}
    end
  end

  defp relay_frame_to_rc_clients(session, frame) do
    Enum.each(session.rc_channel_pids, fn pid ->
      send(pid, {:relay_frame, frame})
    end)
  end

  defp request_keyframe(session) do
    if session.device_channel_pid do
      send(session.device_channel_pid, {:request_keyframe, session.session_id})
    end
  end
end
