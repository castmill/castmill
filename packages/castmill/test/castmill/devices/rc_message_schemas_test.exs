defmodule Castmill.Devices.RcMessageSchemasTest do
  use ExUnit.Case, async: true

  alias Castmill.Devices.RcMessageSchemas

  describe "validate_control_event/1" do
    test "validates keyboard keydown event" do
      payload = %{"type" => "keydown", "key" => "Enter"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_control_event(payload)
    end

    test "validates keyboard keyup event" do
      payload = %{"type" => "keyup", "key" => "Escape"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_control_event(payload)
    end

    test "validates keyboard event with modifiers" do
      payload = %{
        "type" => "keydown",
        "key" => "c",
        "shift" => false,
        "ctrl" => true,
        "alt" => false,
        "meta" => false
      }

      assert {:ok, ^payload} = RcMessageSchemas.validate_control_event(payload)
    end

    test "validates mouse click event" do
      payload = %{"type" => "click", "x" => 100, "y" => 200, "button" => 0}
      assert {:ok, ^payload} = RcMessageSchemas.validate_control_event(payload)
    end

    test "validates mouse move event" do
      payload = %{"type" => "mousemove", "x" => 50, "y" => 75}
      assert {:ok, ^payload} = RcMessageSchemas.validate_control_event(payload)
    end

    test "validates mouse down event" do
      payload = %{"type" => "mousedown", "x" => 300, "y" => 400, "button" => 1}
      assert {:ok, ^payload} = RcMessageSchemas.validate_control_event(payload)
    end

    test "validates mouse up event" do
      payload = %{"type" => "mouseup", "x" => 150, "y" => 250, "button" => 0}
      assert {:ok, ^payload} = RcMessageSchemas.validate_control_event(payload)
    end

    test "rejects event without type field" do
      payload = %{"key" => "Enter"}
      assert {:error, msg} = RcMessageSchemas.validate_control_event(payload)
      assert msg =~ "missing required field 'type'"
    end

    test "rejects event with unknown type" do
      payload = %{"type" => "unknown_event"}
      assert {:error, msg} = RcMessageSchemas.validate_control_event(payload)
      assert msg =~ "unknown event type"
    end

    test "rejects keyboard event without key field" do
      payload = %{"type" => "keydown"}
      assert {:error, msg} = RcMessageSchemas.validate_control_event(payload)
      assert msg =~ "missing required field 'key'"
    end

    test "rejects mouse event without x coordinate" do
      payload = %{"type" => "click", "y" => 100}
      assert {:error, msg} = RcMessageSchemas.validate_control_event(payload)
      assert msg =~ "missing required field 'x'"
    end

    test "rejects mouse event without y coordinate" do
      payload = %{"type" => "click", "x" => 100}
      assert {:error, msg} = RcMessageSchemas.validate_control_event(payload)
      assert msg =~ "missing required field 'y'"
    end

    test "rejects mouse event with non-numeric coordinates" do
      payload = %{"type" => "click", "x" => "100", "y" => 200}
      assert {:error, msg} = RcMessageSchemas.validate_control_event(payload)
      assert msg =~ "must be a number"
    end

    test "rejects non-map payload" do
      assert {:error, msg} = RcMessageSchemas.validate_control_event("not a map")
      assert msg =~ "must be a map"
    end
  end

  describe "validate_media_frame/1" do
    test "validates frame with IDR type" do
      payload = %{"data" => "base64encodeddata", "frame_type" => "idr"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_media_frame(payload)
    end

    test "validates frame with P type" do
      payload = %{"data" => "base64encodeddata", "frame_type" => "p"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_media_frame(payload)
    end

    test "validates frame with uppercase IDR type" do
      payload = %{"data" => "base64encodeddata", "frame_type" => "IDR"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_media_frame(payload)
    end

    test "validates frame without frame_type (defaults to P)" do
      payload = %{"data" => "base64encodeddata"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_media_frame(payload)
    end

    test "validates frame with timestamp" do
      payload = %{
        "data" => "base64encodeddata",
        "frame_type" => "idr",
        "timestamp" => 123456
      }

      assert {:ok, ^payload} = RcMessageSchemas.validate_media_frame(payload)
    end

    test "rejects frame without data field" do
      payload = %{"frame_type" => "idr"}
      assert {:error, msg} = RcMessageSchemas.validate_media_frame(payload)
      assert msg =~ "missing required field 'data'"
    end

    test "rejects frame with invalid frame_type" do
      payload = %{"data" => "base64encodeddata", "frame_type" => "invalid"}
      assert {:error, msg} = RcMessageSchemas.validate_media_frame(payload)
      assert msg =~ "must be 'idr' or 'p'"
    end

    test "rejects non-map payload" do
      assert {:error, msg} = RcMessageSchemas.validate_media_frame("not a map")
      assert msg =~ "must be a map"
    end
  end

  describe "validate_media_metadata/1" do
    test "validates metadata with common fields" do
      payload = %{"resolution" => "1920x1080", "fps" => 30, "codec" => "h264"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_media_metadata(payload)
    end

    test "validates empty metadata" do
      payload = %{}
      assert {:ok, ^payload} = RcMessageSchemas.validate_media_metadata(payload)
    end

    test "validates metadata with various fields" do
      payload = %{
        "resolution" => "1280x720",
        "fps" => 15,
        "bitrate" => 2_000_000,
        "custom_field" => "value"
      }

      assert {:ok, ^payload} = RcMessageSchemas.validate_media_metadata(payload)
    end

    test "rejects non-map payload" do
      assert {:error, msg} = RcMessageSchemas.validate_media_metadata("not a map")
      assert msg =~ "must be a map"
    end
  end

  describe "validate_device_event/1" do
    test "validates device event with type" do
      payload = %{"type" => "screen_update", "data" => "test"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_device_event(payload)
    end

    test "validates device event with minimal fields" do
      payload = %{"type" => "status_change"}
      assert {:ok, ^payload} = RcMessageSchemas.validate_device_event(payload)
    end

    test "validates device event with extra fields" do
      payload = %{
        "type" => "error",
        "message" => "Connection failed",
        "code" => 500
      }

      assert {:ok, ^payload} = RcMessageSchemas.validate_device_event(payload)
    end

    test "rejects event without type field" do
      payload = %{"data" => "test"}
      assert {:error, msg} = RcMessageSchemas.validate_device_event(payload)
      assert msg =~ "missing required field 'type'"
    end

    test "rejects non-map payload" do
      assert {:error, msg} = RcMessageSchemas.validate_device_event("not a map")
      assert msg =~ "must be a map"
    end
  end
end
