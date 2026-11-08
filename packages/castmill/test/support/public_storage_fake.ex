defmodule Castmill.PublicStorage.Fake do
  @moduledoc false
  # In-memory `Castmill.PublicStorage` used by tests. Files are kept in the
  # calling test process (downloads run inline in tests), so tests using it
  # must not be async.
  @behaviour Castmill.PublicStorage

  def install do
    previous = Application.get_env(:castmill, :public_storage)
    Application.put_env(:castmill, :public_storage, __MODULE__)

    ExUnit.Callbacks.on_exit(fn ->
      if previous,
        do: Application.put_env(:castmill, :public_storage, previous),
        else: Application.delete_env(:castmill, :public_storage)
    end)

    :ok
  end

  @doc "Makes the next operations fail with `reason`."
  def fail(reason), do: Process.put({__MODULE__, :fail}, reason)

  def files, do: Process.get({__MODULE__, :files}, %{})

  @impl true
  def put(key, body, content_type) do
    case Process.get({__MODULE__, :fail}) do
      nil ->
        Process.put({__MODULE__, :files}, Map.put(files(), key, {body, content_type}))
        send(self(), {:feed_media_put, key})
        {:ok, "https://cdn.test/" <> key}

      reason ->
        {:error, reason}
    end
  end

  @impl true
  def delete(key) do
    case Process.get({__MODULE__, :fail}) do
      nil ->
        Process.put({__MODULE__, :files}, Map.delete(files(), key))
        send(self(), {:feed_media_deleted, key})
        :ok

      reason ->
        {:error, reason}
    end
  end
end
