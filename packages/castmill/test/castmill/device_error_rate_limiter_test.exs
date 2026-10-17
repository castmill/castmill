defmodule Castmill.DeviceErrorRateLimiterTest do
  use ExUnit.Case, async: true

  alias Castmill.DeviceErrorRateLimiter

  test "limits each device to 120 error-report aggregates per minute" do
    device_id = Ecto.UUID.generate()

    assert :ok = DeviceErrorRateLimiter.allow(device_id, 100)
    assert :ok = DeviceErrorRateLimiter.allow(device_id, 20)
    assert {:error, :error_report_rate_limited} = DeviceErrorRateLimiter.allow(device_id, 1)
  end

  test "tracks device quotas independently" do
    assert :ok = DeviceErrorRateLimiter.allow(Ecto.UUID.generate(), 120)
    assert :ok = DeviceErrorRateLimiter.allow(Ecto.UUID.generate(), 120)
  end
end
