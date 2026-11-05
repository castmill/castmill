defmodule Castmill.LegacyPlayerLogRateLimiterTest do
  use ExUnit.Case, async: true

  alias Castmill.LegacyPlayerLogRateLimiter

  test "limits each source to 60 log requests per minute" do
    source_ip = {203, 0, 113, 101}

    for _ <- 1..60 do
      assert :ok = LegacyPlayerLogRateLimiter.allow(source_ip)
    end

    assert {:error, :rate_limited} = LegacyPlayerLogRateLimiter.allow(source_ip)
  end

  test "tracks sources independently" do
    assert :ok = LegacyPlayerLogRateLimiter.allow({203, 0, 113, 102})
    assert :ok = LegacyPlayerLogRateLimiter.allow({203, 0, 113, 103})
  end
end
