defmodule Castmill.Devices.RcMessageSchemas do
  @moduledoc """
  Message validation schemas for Remote Control WebSocket messages.

  Defines and validates all message types used in the RC session flow
  to ensure type safety and proper message structure.
  """

  @doc """
  Validates a control event message from RC window to device.

  Control events include keyboard and mouse interactions.

  ## Examples

      iex> validate_control_event(%{"type" => "keydown", "key" => "Enter"})
      {:ok, %{"type" => "keydown", "key" => "Enter"}}

      iex> validate_control_event(%{"invalid" => "message"})
      {:error, "Invalid control event: missing required field 'type'"}
  """
  def validate_control_event(payload) when is_map(payload) do
    case payload do
      %{"type" => type} when type in ["keydown", "keyup"] ->
        validate_keyboard_event(payload)

      %{"type" => type} when type in ["click", "mousedown", "mouseup", "mousemove"] ->
        validate_mouse_event(payload)

      # Android control event format: %{"event_type" => "tap", "data" => %{"x" => ..., "y" => ...}}
      # Also includes "key" for transformed keyboard events
      %{"event_type" => event_type, "data" => data} when is_map(data) and event_type in ["tap", "long_press", "swipe", "multi_step", "global_action", "init_mapper", "key"] ->
        {:ok, payload}

      %{"type" => _} ->
        {:error, "Invalid control event: unknown event type"}

      %{"event_type" => _} ->
        {:error, "Invalid control event: unknown Android event type or missing data"}

      _ ->
        {:error, "Invalid control event: missing required field 'type' or 'event_type'"}
    end
  end

  def validate_control_event(_), do: {:error, "Control event must be a map"}

  @doc """
  Validates a media frame message from device to RC window.

  Media frames contain video data and frame metadata including frame type
  (IDR or P-frame) for backpressure management.

  ## Examples

      iex> validate_media_frame(%{"data" => "base64data", "frame_type" => "idr"})
      {:ok, %{"data" => "base64data", "frame_type" => "idr"}}
  """
  def validate_media_frame(payload) when is_map(payload) do
    with {:ok, _} <- validate_required_field(payload, "data"),
         {:ok, _} <- validate_frame_type(payload) do
      {:ok, payload}
    else
      error -> error
    end
  end

  def validate_media_frame(_), do: {:error, "Media frame must be a map"}

  @doc """
  Validates media metadata message from device to RC window.

  Contains information about the media stream such as resolution, FPS, codec.

  ## Examples

      iex> validate_media_metadata(%{"resolution" => "1920x1080", "fps" => 30})
      {:ok, %{"resolution" => "1920x1080", "fps" => 30}}
  """
  def validate_media_metadata(payload) when is_map(payload) do
    # Metadata is optional fields, just verify it's a map
    # Common fields: resolution, fps, codec, bitrate
    {:ok, payload}
  end

  def validate_media_metadata(_), do: {:error, "Media metadata must be a map"}

  @doc """
  Validates a device event message from device to RC window.

  Device events are status updates or notifications from the device.

  ## Examples

      iex> validate_device_event(%{"type" => "screen_update", "data" => "test"})
      {:ok, %{"type" => "screen_update", "data" => "test"}}
  """
  def validate_device_event(payload) when is_map(payload) do
    case validate_required_field(payload, "type") do
      {:ok, _} -> {:ok, payload}
      error -> error
    end
  end

  def validate_device_event(_), do: {:error, "Device event must be a map"}

  # Private helper functions

  defp validate_keyboard_event(payload) do
    with {:ok, _} <- validate_required_field(payload, "key"),
         {:ok, _} <- validate_optional_boolean_field(payload, "shift"),
         {:ok, _} <- validate_optional_boolean_field(payload, "ctrl"),
         {:ok, _} <- validate_optional_boolean_field(payload, "alt"),
         {:ok, _} <- validate_optional_boolean_field(payload, "meta") do
      {:ok, payload}
    else
      error -> error
    end
  end

  defp validate_mouse_event(payload) do
    case payload["type"] do
      "mousemove" ->
        with {:ok, _} <- validate_required_number_field(payload, "x"),
             {:ok, _} <- validate_required_number_field(payload, "y") do
          {:ok, payload}
        else
          error -> error
        end

      _ ->
        with {:ok, _} <- validate_required_number_field(payload, "x"),
             {:ok, _} <- validate_required_number_field(payload, "y"),
             {:ok, _} <- validate_optional_number_field(payload, "button") do
          {:ok, payload}
        else
          error -> error
        end
    end
  end

  defp validate_frame_type(payload) do
    case Map.get(payload, "frame_type") do
      nil ->
        # Default to P-frame if not specified
        {:ok, "p"}

      type when type in ["idr", "p", "IDR", "P"] ->
        {:ok, String.downcase(type)}

      _ ->
        {:error, "Invalid frame_type: must be 'idr' or 'p'"}
    end
  end

  defp validate_required_field(payload, field) do
    case Map.get(payload, field) do
      nil -> {:error, "Invalid message: missing required field '#{field}'"}
      value -> {:ok, value}
    end
  end

  defp validate_required_number_field(payload, field) do
    case Map.get(payload, field) do
      nil -> {:error, "Invalid message: missing required field '#{field}'"}
      value when is_number(value) -> {:ok, value}
      _ -> {:error, "Invalid message: field '#{field}' must be a number"}
    end
  end

  defp validate_optional_number_field(payload, field) do
    case Map.get(payload, field) do
      nil -> {:ok, nil}
      value when is_number(value) -> {:ok, value}
      _ -> {:error, "Invalid message: field '#{field}' must be a number"}
    end
  end

  defp validate_optional_boolean_field(payload, field) do
    case Map.get(payload, field) do
      nil -> {:ok, nil}
      value when is_boolean(value) -> {:ok, value}
      _ -> {:error, "Invalid message: field '#{field}' must be a boolean"}
    end
  end
end
