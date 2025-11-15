defmodule Castmill.Devices.RcRelaySupervisor do
  @moduledoc """
  DynamicSupervisor for RC relay processes.
  
  Manages the lifecycle of RcRelay GenServers, one per active RC session.
  """
  use DynamicSupervisor

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc """
  Starts a relay for a session.
  """
  def start_relay(session_id) do
    child_spec = %{
      id: Castmill.Devices.RcRelay,
      start: {Castmill.Devices.RcRelay, :start_link, [session_id]},
      restart: :transient
    }

    DynamicSupervisor.start_child(__MODULE__, child_spec)
  end

  @doc """
  Stops a relay for a session.
  """
  def stop_relay(session_id) do
    case Castmill.Devices.RcRelay.stop(session_id) do
      :ok -> 
        :ok
      {:error, :session_not_found} -> 
        require Logger
        Logger.debug("Attempted to stop relay for session #{session_id} but it was already stopped")
        :ok
    end
  end
end
