defmodule Castmill.Relay.SessionManagerTest do
  use ExUnit.Case, async: false

  alias Castmill.Relay.SessionManager

  setup do
    # Start the SessionManager if not already started
    case GenServer.whereis(SessionManager) do
      nil ->
        {:ok, pid} = SessionManager.start_link([])
        on_exit(fn -> GenServer.stop(pid) end)
        {:ok, manager_pid: pid}

      pid ->
        {:ok, manager_pid: pid}
    end
  end

  describe "session lifecycle" do
    test "creates a new session", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)

      assert {:ok, session} = SessionManager.create_session(session_id, device_id, rc_pid)
      assert session.session_id == session_id
      assert session.device_id == device_id
      assert rc_pid in session.rc_channel_pids

      # Cleanup
      Process.exit(rc_pid, :kill)
      :timer.sleep(50)
    end

    test "prevents duplicate session creation", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)

      assert {:ok, _session} = SessionManager.create_session(session_id, device_id, rc_pid)
      assert {:error, :session_exists} = SessionManager.create_session(session_id, device_id, rc_pid)

      # Cleanup
      Process.exit(rc_pid, :kill)
      :timer.sleep(50)
    end

    test "adds additional RC channel to existing session", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid1 = spawn(fn -> :timer.sleep(:infinity) end)
      rc_pid2 = spawn(fn -> :timer.sleep(:infinity) end)

      assert {:ok, _session} = SessionManager.create_session(session_id, device_id, rc_pid1)
      assert :ok = SessionManager.add_rc_channel(session_id, rc_pid2)

      session = SessionManager.get_session(session_id)
      assert rc_pid1 in session.rc_channel_pids
      assert rc_pid2 in session.rc_channel_pids

      # Cleanup
      Process.exit(rc_pid1, :kill)
      Process.exit(rc_pid2, :kill)
      :timer.sleep(50)
    end

    test "sets device channel for session", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)
      device_pid = spawn(fn -> :timer.sleep(:infinity) end)

      assert {:ok, _session} = SessionManager.create_session(session_id, device_id, rc_pid)
      assert :ok = SessionManager.set_device_channel(session_id, device_pid)

      session = SessionManager.get_session(session_id)
      assert session.device_channel_pid == device_pid
      assert session.status == :active

      # Cleanup
      Process.exit(rc_pid, :kill)
      Process.exit(device_pid, :kill)
      :timer.sleep(50)
    end

    test "stops session and cleans up", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)

      assert {:ok, _session} = SessionManager.create_session(session_id, device_id, rc_pid)
      assert :ok = SessionManager.stop_session(session_id)

      assert nil == SessionManager.get_session(session_id)

      # Cleanup
      Process.exit(rc_pid, :kill)
      :timer.sleep(50)
    end
  end

  describe "RC channel management" do
    test "removes RC channel from session", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid1 = spawn(fn -> :timer.sleep(:infinity) end)
      rc_pid2 = spawn(fn -> :timer.sleep(:infinity) end)

      SessionManager.create_session(session_id, device_id, rc_pid1)
      SessionManager.add_rc_channel(session_id, rc_pid2)

      assert :ok = SessionManager.remove_rc_channel(session_id, rc_pid1)

      session = SessionManager.get_session(session_id)
      refute rc_pid1 in session.rc_channel_pids
      assert rc_pid2 in session.rc_channel_pids

      # Cleanup
      Process.exit(rc_pid1, :kill)
      Process.exit(rc_pid2, :kill)
      :timer.sleep(50)
    end

    test "stops session when last RC channel is removed", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)

      SessionManager.create_session(session_id, device_id, rc_pid)
      assert :ok = SessionManager.remove_rc_channel(session_id, rc_pid)

      assert nil == SessionManager.get_session(session_id)

      # Cleanup
      Process.exit(rc_pid, :kill)
      :timer.sleep(50)
    end
  end

  describe "frame relaying and backpressure" do
    test "relays IDR frames to RC clients", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"

      # Create a test process to receive frames
      test_pid = self()

      rc_pid =
        spawn(fn ->
          receive do
            {:relay_frame, frame} -> send(test_pid, {:received, frame})
          after
            1000 -> send(test_pid, :timeout)
          end
        end)

      SessionManager.create_session(session_id, device_id, rc_pid)
      SessionManager.set_device_channel(session_id, self())

      frame = %{
        "type" => "media_frame",
        "session_id" => session_id,
        "frame_type" => "idr",
        "timestamp" => 1_234_567_890,
        "data" => "test_data"
      }

      SessionManager.enqueue_frame(session_id, frame)

      # Wait for frame to be relayed
      assert_receive {:received, ^frame}, 1000

      # Cleanup
      Process.exit(rc_pid, :kill)
      :timer.sleep(50)
    end

    test "always forwards IDR frames even with full queue", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"

      # Don't process messages to simulate backpressure
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)

      SessionManager.create_session(session_id, device_id, rc_pid)
      SessionManager.set_device_channel(session_id, self())

      # Fill queue with P-frames
      Enum.each(1..110, fn i ->
        frame = %{
          "frame_type" => "p",
          "timestamp" => i,
          "data" => "data_#{i}"
        }

        SessionManager.enqueue_frame(session_id, frame)
      end)

      # IDR frame should still be forwarded
      idr_frame = %{
        "frame_type" => "idr",
        "timestamp" => 999,
        "data" => "idr_data"
      }

      SessionManager.enqueue_frame(session_id, idr_frame)

      # Queue should be cleared after IDR
      session = SessionManager.get_session(session_id)
      assert :queue.len(session.frame_queue) == 0
      assert session.p_frame_drops == 0

      # Cleanup
      Process.exit(rc_pid, :kill)
      :timer.sleep(50)
    end
  end

  describe "device session listing" do
    test "lists all sessions for a device", %{manager_pid: _pid} do
      device_id = "device-#{:rand.uniform(10000)}"
      session_id1 = "session-1-#{:rand.uniform(10000)}"
      session_id2 = "session-2-#{:rand.uniform(10000)}"

      rc_pid1 = spawn(fn -> :timer.sleep(:infinity) end)
      rc_pid2 = spawn(fn -> :timer.sleep(:infinity) end)

      SessionManager.create_session(session_id1, device_id, rc_pid1)
      SessionManager.create_session(session_id2, device_id, rc_pid2)

      sessions = SessionManager.list_device_sessions(device_id)
      assert length(sessions) == 2

      session_ids = Enum.map(sessions, & &1.session_id)
      assert session_id1 in session_ids
      assert session_id2 in session_ids

      # Cleanup
      Process.exit(rc_pid1, :kill)
      Process.exit(rc_pid2, :kill)
      :timer.sleep(50)
    end
  end

  describe "process monitoring" do
    test "cleans up session when RC channel process dies", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)

      SessionManager.create_session(session_id, device_id, rc_pid)
      assert SessionManager.get_session(session_id) != nil

      Process.exit(rc_pid, :kill)
      :timer.sleep(100)

      # Session should be cleaned up
      assert nil == SessionManager.get_session(session_id)
    end

    test "cleans up session when device channel process dies", %{manager_pid: _pid} do
      session_id = "test-session-#{:rand.uniform(10000)}"
      device_id = "device-123"
      rc_pid = spawn(fn -> :timer.sleep(:infinity) end)
      device_pid = spawn(fn -> :timer.sleep(:infinity) end)

      SessionManager.create_session(session_id, device_id, rc_pid)
      SessionManager.set_device_channel(session_id, device_pid)

      Process.exit(device_pid, :kill)
      :timer.sleep(100)

      # Session should be cleaned up
      assert nil == SessionManager.get_session(session_id)

      # Cleanup
      Process.exit(rc_pid, :kill)
      :timer.sleep(50)
    end
  end
end
