defmodule Castmill.Devices.RcLoggerTest do
  use ExUnit.Case, async: true
  import ExUnit.CaptureLog

  alias Castmill.Devices.RcLogger

  describe "info/3" do
    test "logs info message with session_id correlation" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      log =
        capture_log(fn ->
          RcLogger.info("Test message", session_id, device_id)
        end)

      assert log =~ "Test message"
      assert log =~ session_id
      assert log =~ device_id
    end

    test "logs info message with additional metadata" do
      session_id = Ecto.UUID.generate()

      log =
        capture_log(fn ->
          RcLogger.info("Test message", session_id, nil, user_id: "user123")
        end)

      assert log =~ "Test message"
      assert log =~ "user_id=user123"
    end
  end

  describe "warning/3" do
    test "logs warning message with correlation IDs" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      log =
        capture_log(fn ->
          RcLogger.warning("Warning message", session_id, device_id)
        end)

      assert log =~ "[warning]"
      assert log =~ "Warning message"
      assert log =~ session_id
    end
  end

  describe "error/3" do
    test "logs error message with correlation IDs" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      log =
        capture_log(fn ->
          RcLogger.error("Error message", session_id, device_id)
        end)

      assert log =~ "[error]"
      assert log =~ "Error message"
      assert log =~ session_id
    end

    test "logs error with reason metadata" do
      session_id = Ecto.UUID.generate()

      log =
        capture_log(fn ->
          RcLogger.error("Error occurred", session_id, nil, reason: "timeout")
        end)

      assert log =~ "Error occurred"
      assert log =~ "reason=timeout"
    end
  end

  describe "debug/3" do
    test "logs debug message with correlation IDs" do
      session_id = Ecto.UUID.generate()
      device_id = Ecto.UUID.generate()

      log =
        capture_log(fn ->
          RcLogger.debug("Debug message", session_id, device_id)
        end)

      assert log =~ "Debug message"
      assert log =~ session_id
    end
  end
end
