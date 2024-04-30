defmodule Castmill.Hooks do
  use GenServer

  # Starts the GenServer
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  # State initialization
  def init(_state), do: {:ok, %{hooks: %{}, next_id: 1}}

  # Registers a hook
  def register_hook(hook_name, callback) do
    case Castmill.HookSchemas.validate_hook(hook_name) do
      :ok -> GenServer.call(__MODULE__, {:register_hook, hook_name, callback})
      {:error, reason} -> {:error, reason}
    end
  end

  def unregister_hook(hook_name, id) do
    GenServer.call(__MODULE__, {:unregister_hook, hook_name, id})
  end

  # Triggers a hook
  def trigger_hook(hook_name, args) do
    case Castmill.HookSchemas.validate_hook(hook_name, args) do
      :ok -> GenServer.cast(__MODULE__, {:trigger_hook, hook_name, args})
      {:error, _reason} = error -> error
    end
  end

  # GenServer callback for handling hook registration
  def handle_call({:register_hook, hook_name, callback}, _from, state) do
    id = state.next_id
    hooks = Map.update(state.hooks, hook_name, %{id => callback}, &Map.put(&1, id, callback))
    new_state = %{state | hooks: hooks, next_id: state.next_id + 1}
    {:reply, {:ok, id}, new_state}
  end

  def handle_call({:unregister_hook, hook_name, id}, _from, state) do
    hooks = Map.update(state.hooks, hook_name, %{}, &Map.delete(&1, id))
    {:reply, :ok, %{state | hooks: hooks}}
  end

  # GenServer callback for handling hook triggering
  def handle_cast({:trigger_hook, hook_name, args}, state) do
    hooks = Map.get(state.hooks, hook_name, %{})
    Enum.each(hooks, fn {_id, hook} -> hook.(args) end)
    {:noreply, state}
  end
end
