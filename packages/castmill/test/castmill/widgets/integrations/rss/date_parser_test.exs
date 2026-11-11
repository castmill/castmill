defmodule Castmill.Widgets.Integrations.Rss.DateParserTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.Rss.DateParser

  defp parse!(value) do
    {:ok, datetime} = DateParser.parse(value)
    DateTime.to_iso8601(datetime)
  end

  describe "RFC 822 dates" do
    test "parses numeric offsets and converts to UTC" do
      assert parse!("Wed, 01 Jan 2025 12:00:00 +0000") == "2025-01-01T12:00:00Z"
      assert parse!("Wed, 01 Jan 2025 12:00:00 +0200") == "2025-01-01T10:00:00Z"
      assert parse!("Tue, 31 Dec 2024 22:30:00 -05:30") == "2025-01-01T04:00:00Z"
    end

    test "parses named time zones" do
      assert parse!("Wed, 01 Jan 2025 12:00:00 GMT") == "2025-01-01T12:00:00Z"
      assert parse!("Wed, 01 Jan 2025 07:00:00 EST") == "2025-01-01T12:00:00Z"
      assert parse!("Wed, 01 Jul 2025 05:00:00 PDT") == "2025-07-01T12:00:00Z"
    end

    test "tolerates missing weekday, seconds, full month names and two digit years" do
      assert parse!("1 Jan 2025 12:00 GMT") == "2025-01-01T12:00:00Z"
      assert parse!("Monday, 3 March 2025 08:15:00 +0000") == "2025-03-03T08:15:00Z"
      assert parse!("Wed, 01 Jan 25 12:00:00 GMT") == "2025-01-01T12:00:00Z"
      assert parse!("01 Jan 2025") == "2025-01-01T00:00:00Z"
    end
  end

  describe "ISO 8601 dates" do
    test "parses offsets and fractional seconds" do
      assert parse!("2025-01-01T12:00:00Z") == "2025-01-01T12:00:00Z"
      assert parse!("2025-01-01T14:00:00+02:00") == "2025-01-01T12:00:00Z"
      assert parse!("2025-01-01T14:00:00+0200") == "2025-01-01T12:00:00Z"
      assert parse!("2025-01-01T12:00:00.123Z") == "2025-01-01T12:00:00Z"
    end

    test "assumes UTC when no offset is given" do
      assert parse!("2025-01-01 12:00:00") == "2025-01-01T12:00:00Z"
      assert parse!("2025-01-01") == "2025-01-01T00:00:00Z"
    end
  end

  test "rejects invalid input" do
    assert DateParser.parse(nil) == :error
    assert DateParser.parse("") == :error
    assert DateParser.parse("yesterday") == :error
    assert DateParser.parse("Wed, 45 Foo 2025 12:00:00 GMT") == :error
  end

  test "formats dates for display" do
    {:ok, datetime} = DateParser.parse("2025-01-05T12:00:00Z")
    assert DateParser.format(datetime) == "Jan 5, 2025"
  end
end
