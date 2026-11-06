defmodule Castmill.Automations.Sources.ClockTest do
  use ExUnit.Case, async: true

  alias Castmill.Automations.Sources.Clock

  defp config!(config) do
    {:ok, normalized} = Clock.validate_config(config)
    normalized
  end

  defp hourly(minute, extra \\ %{}),
    do: config!(Map.merge(%{"schedule" => %{"type" => "hourly", "minute" => minute}}, extra))

  describe "validate_config/1" do
    test "accepts and normalizes every schedule type" do
      assert {:ok, %{"schedule" => %{"type" => "hourly", "minute" => 8}}} =
               Clock.validate_config(%{"schedule" => %{"type" => "hourly", "minute" => 8}})

      assert {:ok, %{"schedule" => %{"type" => "interval", "every_minutes" => 15}}} =
               Clock.validate_config(%{
                 "schedule" => %{"type" => "interval", "every_minutes" => 15}
               })

      assert {:ok, %{"schedule" => %{"times" => ["08:00", "17:55"]}}} =
               Clock.validate_config(%{
                 "schedule" => %{"type" => "times", "times" => ["17:55", "08:00", "08:00"]}
               })

      assert {:ok, %{"schedule" => %{"type" => "once", "date" => "2026-12-24"}}} =
               Clock.validate_config(%{
                 "schedule" => %{"type" => "once", "date" => "2026-12-24", "time" => "17:55"}
               })
    end

    test "accepts weekdays, window, dates and timezone" do
      assert {:ok, config} =
               Clock.validate_config(%{
                 "schedule" => %{"type" => "hourly", "minute" => 0},
                 "weekdays" => [5, 1, 1],
                 "window" => %{"start" => "08:00", "end" => "18:00"},
                 "dates" => %{"start" => "2026-01-01", "end" => nil},
                 "timezone" => "Europe/Stockholm"
               })

      assert config["weekdays"] == [1, 5]
      assert config["window"] == %{"start" => "08:00", "end" => "18:00"}
      assert config["timezone"] == "Europe/Stockholm"
    end

    test "rejects invalid configurations" do
      invalid = [
        nil,
        %{},
        %{"schedule" => %{"type" => "cron"}},
        %{"schedule" => %{"type" => "hourly", "minute" => 60}},
        %{"schedule" => %{"type" => "hourly", "minute" => "8"}},
        %{"schedule" => %{"type" => "interval", "every_minutes" => 4}},
        %{"schedule" => %{"type" => "times", "times" => []}},
        %{"schedule" => %{"type" => "times", "times" => ["25:00"]}},
        %{
          "schedule" => %{
            "type" => "times",
            "times" => Enum.map(0..49, &"#{rem(&1, 24)}:#{rem(&1, 60)}")
          }
        },
        %{"schedule" => %{"type" => "once", "date" => "2026-02-30", "time" => "10:00"}},
        %{"schedule" => %{"type" => "once", "date" => "2026-02-03"}},
        %{
          "schedule" => %{"type" => "once", "date" => "2026-02-03", "time" => "10:00"},
          "weekdays" => [1]
        },
        %{
          "schedule" => %{"type" => "once", "date" => "2026-02-03", "time" => "10:00"},
          "window" => %{"start" => "08:00", "end" => "09:00"}
        },
        %{"schedule" => %{"type" => "hourly", "minute" => 1}, "weekdays" => [0]},
        %{"schedule" => %{"type" => "hourly", "minute" => 1}, "weekdays" => []},
        %{
          "schedule" => %{"type" => "hourly", "minute" => 1},
          "window" => %{"start" => "20:00", "end" => "02:00"}
        },
        %{
          "schedule" => %{"type" => "hourly", "minute" => 1},
          "dates" => %{"start" => "2026-02-01", "end" => "2026-01-01"}
        },
        %{"schedule" => %{"type" => "hourly", "minute" => 1}, "timezone" => "Mars/Olympus"}
      ]

      for config <- invalid do
        assert {:error, message} = Clock.validate_config(config), inspect(config)
        assert is_binary(message)
      end
    end
  end

  describe "occurrences/4" do
    test "hourly at a minute, in the device timezone" do
      assert Clock.occurrences(
               hourly(8),
               "Europe/Stockholm",
               ~U[2026-11-06 10:00:00Z],
               ~U[2026-11-06 13:00:00Z]
             ) ==
               [~U[2026-11-06 10:08:00Z], ~U[2026-11-06 11:08:00Z], ~U[2026-11-06 12:08:00Z]]
    end

    test "the range is [from, to)" do
      assert Clock.occurrences(
               hourly(0),
               "Etc/UTC",
               ~U[2026-11-06 10:00:00Z],
               ~U[2026-11-06 11:00:00Z]
             ) ==
               [~U[2026-11-06 10:00:00Z]]

      assert Clock.occurrences(
               hourly(0),
               "Etc/UTC",
               ~U[2026-11-06 11:00:00Z],
               ~U[2026-11-06 10:00:00Z]
             ) ==
               []
    end

    test "DST gap (Europe/Stockholm 2026-03-29 02:00 -> 03:00) skips the missing hour" do
      assert Clock.occurrences(
               hourly(30),
               "Europe/Stockholm",
               ~U[2026-03-29 00:00:00Z],
               ~U[2026-03-29 03:00:00Z]
             ) ==
               [~U[2026-03-29 00:30:00Z], ~U[2026-03-29 01:30:00Z], ~U[2026-03-29 02:30:00Z]]
    end

    test "DST overlap (Europe/Stockholm 2026-10-25 03:00 -> 02:00) fires once, at the first instant" do
      assert Clock.occurrences(
               hourly(30),
               "Europe/Stockholm",
               ~U[2026-10-24 23:00:00Z],
               ~U[2026-10-25 03:00:00Z]
             ) ==
               [~U[2026-10-24 23:30:00Z], ~U[2026-10-25 00:30:00Z], ~U[2026-10-25 02:30:00Z]]
    end

    test "times inside a DST gap fire just after the gap" do
      config =
        config!(%{
          "schedule" => %{"type" => "times", "times" => ["02:30", "17:55"]},
          "weekdays" => [7]
        })

      assert Clock.occurrences(
               config,
               "Europe/Stockholm",
               ~U[2026-03-28 00:00:00Z],
               ~U[2026-03-30 00:00:00Z]
             ) ==
               [~U[2026-03-29 01:00:00Z], ~U[2026-03-29 15:55:00Z]]
    end

    test "times on the fall-back day keep the local wall-clock time" do
      config = config!(%{"schedule" => %{"type" => "times", "times" => ["17:55"]}})

      assert Clock.occurrences(
               config,
               "Europe/Stockholm",
               ~U[2026-10-24 00:00:00Z],
               ~U[2026-10-26 00:00:00Z]
             ) ==
               [~U[2026-10-24 15:55:00Z], ~U[2026-10-25 16:55:00Z]]
    end

    test "interval is aligned to the start of the window, and the window is inclusive" do
      config =
        config!(%{
          "schedule" => %{"type" => "interval", "every_minutes" => 45},
          "window" => %{"start" => "08:10", "end" => "09:40"}
        })

      assert Clock.occurrences(
               config,
               "Etc/UTC",
               ~U[2026-03-28 00:00:00Z],
               ~U[2026-03-29 00:00:00Z]
             ) ==
               [~U[2026-03-28 08:10:00Z], ~U[2026-03-28 08:55:00Z], ~U[2026-03-28 09:40:00Z]]
    end

    test "interval without window starts at midnight" do
      config = config!(%{"schedule" => %{"type" => "interval", "every_minutes" => 360}})

      assert Clock.occurrences(
               config,
               "America/New_York",
               ~U[2026-01-10 05:00:00Z],
               ~U[2026-01-11 05:00:00Z]
             ) ==
               [
                 ~U[2026-01-10 05:00:00Z],
                 ~U[2026-01-10 11:00:00Z],
                 ~U[2026-01-10 17:00:00Z],
                 ~U[2026-01-10 23:00:00Z]
               ]
    end

    test "weekdays filter on local dates" do
      # 2026-11-06 is a Friday, 2026-11-07 a Saturday.
      config =
        config!(%{"schedule" => %{"type" => "times", "times" => ["00:30"]}, "weekdays" => [6]})

      # 00:30 Saturday in Tokyo is Friday 15:30 UTC.
      assert Clock.occurrences(
               config,
               "Asia/Tokyo",
               ~U[2026-11-06 00:00:00Z],
               ~U[2026-11-08 00:00:00Z]
             ) ==
               [~U[2026-11-06 15:30:00Z]]
    end

    test "dates bound the occurrences (inclusive)" do
      config =
        hourly(0, %{
          "window" => %{"start" => "12:00", "end" => "12:30"},
          "dates" => %{"start" => "2026-05-02", "end" => "2026-05-03"}
        })

      assert Clock.occurrences(
               config,
               "Etc/UTC",
               ~U[2026-05-01 00:00:00Z],
               ~U[2026-05-06 00:00:00Z]
             ) ==
               [~U[2026-05-02 12:00:00Z], ~U[2026-05-03 12:00:00Z]]
    end

    test "once fires a single time" do
      config =
        config!(%{"schedule" => %{"type" => "once", "date" => "2027-01-02", "time" => "10:00"}})

      assert Clock.occurrences(
               config,
               "America/New_York",
               ~U[2027-01-01 00:00:00Z],
               ~U[2027-01-05 00:00:00Z]
             ) ==
               [~U[2027-01-02 15:00:00Z]]
    end

    test "an explicit rule timezone wins over the device timezone" do
      config = hourly(0, %{"timezone" => "Asia/Kolkata"})

      assert Clock.occurrences(
               config,
               "Europe/Stockholm",
               ~U[2026-11-06 10:00:00Z],
               ~U[2026-11-06 11:00:00Z]
             ) ==
               [~U[2026-11-06 10:30:00Z]]
    end

    test "missing or invalid timezones fall back to UTC" do
      assert Clock.occurrences(hourly(5), nil, ~U[2026-11-06 10:00:00Z], ~U[2026-11-06 11:00:00Z]) ==
               [~U[2026-11-06 10:05:00Z]]

      assert Clock.occurrences(
               hourly(5),
               "Nope/Nope",
               ~U[2026-11-06 10:00:00Z],
               ~U[2026-11-06 11:00:00Z]
             ) ==
               [~U[2026-11-06 10:05:00Z]]
    end
  end

  describe "upcoming/4 and next_occurrence/4" do
    test "returns the next occurrences in order" do
      assert Clock.upcoming(hourly(8), "Etc/UTC", ~U[2026-11-06 10:08:00Z], 3) ==
               [~U[2026-11-06 10:08:00Z], ~U[2026-11-06 11:08:00Z], ~U[2026-11-06 12:08:00Z]]
    end

    test "stops when there are no more occurrences" do
      config =
        config!(%{"schedule" => %{"type" => "once", "date" => "2026-11-07", "time" => "10:00"}})

      assert Clock.upcoming(config, "Etc/UTC", ~U[2026-11-06 00:00:00Z], 10) ==
               [~U[2026-11-07 10:00:00Z]]

      assert Clock.next_occurrence(config, "Etc/UTC", ~U[2026-11-08 00:00:00Z]) == nil
    end
  end

  describe "device_payload/2" do
    test "returns epoch milliseconds for the given range and the effective timezone" do
      payload =
        Clock.device_payload(hourly(8), %{
          timezone: "Europe/Stockholm",
          from: ~U[2026-11-06 00:00:00Z],
          to: ~U[2026-11-20 00:00:00Z]
        })

      assert payload["timezone"] == "Europe/Stockholm"
      assert length(payload["occurrences"]) == 14 * 24

      assert hd(payload["occurrences"]) ==
               DateTime.to_unix(~U[2026-11-06 00:08:00Z], :millisecond)
    end
  end

  test "describes itself" do
    assert Clock.type() == "clock"
    assert Clock.conditions() == [%{name: "at", kind: :event}]
    assert Clock.required_capability() == "clock"
    assert Clock.payload_days() == 14
  end
end
