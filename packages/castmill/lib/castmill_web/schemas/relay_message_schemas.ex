defmodule CastmillWeb.Schemas.RelayMessageSchemas do
  @moduledoc """
  Schema definitions and validation for relay messages between devices and remote control clients.
  
  This module defines schemas for:
  - Session control messages (start_session, stop_session)
  - Media relay messages (video frames, control commands)
  - Status messages
  """

  import Tarams

  @doc """
  Schema for start_session message from RC client.
  
  ## Example
      %{
        "type" => "start_session",
        "device_id" => "device-123",
        "session_id" => "session-456"
      }
  """
  def start_session_schema do
    %{
      type: [type: :string, required: true, equals: "start_session"],
      device_id: [type: :string, required: true],
      session_id: [type: :string, required: true]
    }
  end

  @doc """
  Schema for stop_session message.
  
  ## Example
      %{
        "type" => "stop_session",
        "session_id" => "session-456",
        "reason" => "user_disconnected"
      }
  """
  def stop_session_schema do
    %{
      type: [type: :string, required: true, equals: "stop_session"],
      session_id: [type: :string, required: true],
      reason: [type: :string, required: false]
    }
  end

  @doc """
  Schema for media frame message from device.
  
  ## Example
      %{
        "type" => "media_frame",
        "session_id" => "session-456",
        "frame_type" => "idr",  # or "p", "b"
        "timestamp" => 1234567890,
        "data" => "base64_encoded_data"
      }
  """
  def media_frame_schema do
    %{
      type: [type: :string, required: true, equals: "media_frame"],
      session_id: [type: :string, required: true],
      frame_type: [type: :string, required: true, in: ["idr", "p", "b"]],
      timestamp: [type: :integer, required: true],
      data: [type: :string, required: true]
    }
  end

  @doc """
  Schema for control command from RC to device.
  
  ## Example
      %{
        "type" => "control_command",
        "session_id" => "session-456",
        "command" => "pause",
        "params" => %{}
      }
  """
  def control_command_schema do
    %{
      type: [type: :string, required: true, equals: "control_command"],
      session_id: [type: :string, required: true],
      command: [type: :string, required: true],
      params: [type: :map, required: false, default: %{}]
    }
  end

  @doc """
  Schema for session status message.
  
  ## Example
      %{
        "type" => "session_status",
        "session_id" => "session-456",
        "status" => "active",
        "device_id" => "device-123"
      }
  """
  def session_status_schema do
    %{
      type: [type: :string, required: true, equals: "session_status"],
      session_id: [type: :string, required: true],
      status: [type: :string, required: true, in: ["active", "inactive", "error"]],
      device_id: [type: :string, required: true]
    }
  end

  @doc """
  Validates a message against its schema based on the message type.
  
  Returns `{:ok, validated_data}` or `{:error, reason}`.
  """
  def validate_message(%{"type" => type} = message) do
    schema =
      case type do
        "start_session" -> start_session_schema()
        "stop_session" -> stop_session_schema()
        "media_frame" -> media_frame_schema()
        "control_command" -> control_command_schema()
        "session_status" -> session_status_schema()
        _ -> nil
      end

    if schema do
      case Tarams.cast(message, schema) do
        {:ok, validated} -> {:ok, validated}
        {:error, errors} -> {:error, format_errors(errors)}
      end
    else
      {:error, "Unknown message type: #{type}"}
    end
  end

  def validate_message(_message) do
    {:error, "Message must include a 'type' field"}
  end

  defp format_errors(errors) do
    errors
    |> Enum.map(fn {field, messages} ->
      "#{field}: #{Enum.join(messages, ", ")}"
    end)
    |> Enum.join("; ")
  end
end
