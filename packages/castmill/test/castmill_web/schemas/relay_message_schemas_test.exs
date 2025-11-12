defmodule CastmillWeb.Schemas.RelayMessageSchemasTest do
  use ExUnit.Case, async: true

  alias CastmillWeb.Schemas.RelayMessageSchemas

  describe "start_session_schema validation" do
    test "validates valid start_session message" do
      message = %{
        "type" => "start_session",
        "device_id" => "device-123",
        "session_id" => "session-456"
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.type == "start_session"
      assert validated.device_id == "device-123"
      assert validated.session_id == "session-456"
    end

    test "rejects start_session message with missing device_id" do
      message = %{
        "type" => "start_session",
        "session_id" => "session-456"
      }

      assert {:error, _reason} = RelayMessageSchemas.validate_message(message)
    end

    test "rejects start_session message with missing session_id" do
      message = %{
        "type" => "start_session",
        "device_id" => "device-123"
      }

      assert {:error, _reason} = RelayMessageSchemas.validate_message(message)
    end
  end

  describe "stop_session_schema validation" do
    test "validates valid stop_session message" do
      message = %{
        "type" => "stop_session",
        "session_id" => "session-456",
        "reason" => "user_disconnected"
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.type == "stop_session"
      assert validated.session_id == "session-456"
      assert validated.reason == "user_disconnected"
    end

    test "validates stop_session message without optional reason" do
      message = %{
        "type" => "stop_session",
        "session_id" => "session-456"
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.type == "stop_session"
      assert validated.session_id == "session-456"
    end
  end

  describe "media_frame_schema validation" do
    test "validates valid media_frame message with idr frame" do
      message = %{
        "type" => "media_frame",
        "session_id" => "session-456",
        "frame_type" => "idr",
        "timestamp" => 1_234_567_890,
        "data" => "base64_encoded_data"
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.type == "media_frame"
      assert validated.frame_type == "idr"
      assert validated.timestamp == 1_234_567_890
    end

    test "validates valid media_frame message with p frame" do
      message = %{
        "type" => "media_frame",
        "session_id" => "session-456",
        "frame_type" => "p",
        "timestamp" => 1_234_567_890,
        "data" => "base64_encoded_data"
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.frame_type == "p"
    end

    test "rejects media_frame with invalid frame_type" do
      message = %{
        "type" => "media_frame",
        "session_id" => "session-456",
        "frame_type" => "invalid",
        "timestamp" => 1_234_567_890,
        "data" => "base64_encoded_data"
      }

      assert {:error, _reason} = RelayMessageSchemas.validate_message(message)
    end

    test "rejects media_frame with missing data" do
      message = %{
        "type" => "media_frame",
        "session_id" => "session-456",
        "frame_type" => "idr",
        "timestamp" => 1_234_567_890
      }

      assert {:error, _reason} = RelayMessageSchemas.validate_message(message)
    end
  end

  describe "control_command_schema validation" do
    test "validates valid control_command message" do
      message = %{
        "type" => "control_command",
        "session_id" => "session-456",
        "command" => "pause",
        "params" => %{"key" => "value"}
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.type == "control_command"
      assert validated.command == "pause"
      assert validated.params == %{"key" => "value"}
    end

    test "validates control_command without optional params" do
      message = %{
        "type" => "control_command",
        "session_id" => "session-456",
        "command" => "pause"
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.params == %{}
    end
  end

  describe "session_status_schema validation" do
    test "validates valid session_status message" do
      message = %{
        "type" => "session_status",
        "session_id" => "session-456",
        "status" => "active",
        "device_id" => "device-123"
      }

      assert {:ok, validated} = RelayMessageSchemas.validate_message(message)
      assert validated.status == "active"
    end

    test "rejects session_status with invalid status value" do
      message = %{
        "type" => "session_status",
        "session_id" => "session-456",
        "status" => "invalid_status",
        "device_id" => "device-123"
      }

      assert {:error, _reason} = RelayMessageSchemas.validate_message(message)
    end
  end

  describe "validate_message error handling" do
    test "rejects message with unknown type" do
      message = %{
        "type" => "unknown_type",
        "some_field" => "value"
      }

      assert {:error, reason} = RelayMessageSchemas.validate_message(message)
      assert reason =~ "Unknown message type"
    end

    test "rejects message without type field" do
      message = %{"some_field" => "value"}

      assert {:error, reason} = RelayMessageSchemas.validate_message(message)
      assert reason =~ "must include a 'type' field"
    end
  end
end
