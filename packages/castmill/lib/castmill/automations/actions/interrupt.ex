defmodule Castmill.Automations.Actions.Interrupt do
  @moduledoc """
  Interrupt action: interrupts playback with a playlist, then normal
  programming continues with the next item (the interrupted item is not
  resumed, which avoids seeking).

  Configuration (string keys):

      %{
        "playlist_id" => 12,
        "start" => "immediately" | "after_current_item",
        "max_wait_seconds" => 120,  # max wait for the current item to end
        "plays" => 1,               # for state conditions the content loops while active
        "priority" => "normal" | "high"
      }
  """

  @behaviour Castmill.Automations.Action

  @start_modes ~w(immediately after_current_item)
  @priorities ~w(normal high)
  @default_max_wait_seconds 120
  @max_wait_seconds 3600
  @max_plays 100

  @impl true
  def type, do: "interrupt"

  @impl true
  def supports(kind), do: kind in [:event, :state]

  @impl true
  def required_capability, do: "interrupt"

  @impl true
  def referenced_resources(%{"playlist_id" => playlist_id}) when is_integer(playlist_id),
    do: %{playlists: [playlist_id]}

  def referenced_resources(_config), do: %{playlists: []}

  @impl true
  def validate_config(config) when is_map(config) do
    with {:ok, playlist_id} <- validate_playlist_id(Map.get(config, "playlist_id")),
         {:ok, start} <- validate_enum(config, "start", @start_modes, "immediately"),
         {:ok, max_wait} <-
           validate_integer(
             config,
             "max_wait_seconds",
             0,
             @max_wait_seconds,
             @default_max_wait_seconds
           ),
         {:ok, plays} <- validate_integer(config, "plays", 1, @max_plays, 1),
         {:ok, priority} <- validate_enum(config, "priority", @priorities, "normal") do
      {:ok,
       %{
         "playlist_id" => playlist_id,
         "start" => start,
         "max_wait_seconds" => max_wait,
         "plays" => plays,
         "priority" => priority
       }}
    end
  end

  def validate_config(_config), do: {:error, "interrupt configuration must be an object"}

  defp validate_playlist_id(id) when is_integer(id) and id > 0, do: {:ok, id}

  defp validate_playlist_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {parsed, ""} when parsed > 0 -> {:ok, parsed}
      _ -> {:error, "playlist_id is required"}
    end
  end

  defp validate_playlist_id(_id), do: {:error, "playlist_id is required"}

  defp validate_enum(config, key, allowed, default) do
    case Map.get(config, key) do
      nil -> {:ok, default}
      value -> if value in allowed, do: {:ok, value}, else: invalid_enum(key, allowed)
    end
  end

  defp invalid_enum(key, allowed),
    do: {:error, "#{key} must be one of #{Enum.join(allowed, ", ")}"}

  defp validate_integer(config, key, min, max, default) do
    case Map.get(config, key) do
      nil ->
        {:ok, default}

      value when is_integer(value) and value >= min and value <= max ->
        {:ok, value}

      _ ->
        {:error, "#{key} must be an integer between #{min} and #{max}"}
    end
  end
end
