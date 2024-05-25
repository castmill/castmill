defmodule Castmill.Resources.ChannelEntryTest do
  use ExUnit.Case, async: true
  alias Castmill.Resources.ChannelEntry

  @moduletag :channel_entry
  describe "ChannelEntry changeset" do
    test "validates that dates are in the same week" do
      # Let's use a fixed date, e.g., a Wednesday
      wednesday = DateTime.to_unix(~U[2023-08-09 19:59:03Z])
      thursday = DateTime.to_unix(~U[2023-08-10 19:59:03Z])
      next_wednesday = DateTime.to_unix(~U[2023-08-16 19:59:03Z])

      # Mock values for required fields
      common_attrs = %{playlist_id: 1, channel_id: 1}

      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(%{start: wednesday, end: thursday}, common_attrs)
        )

      assert changeset.valid?

      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(%{start: wednesday, end: next_wednesday}, common_attrs)
        )

      assert not changeset.valid?
      assert [start: {"and end date must be in the same week", []}] == changeset.errors
    end

    test "validates start date is before end date" do
      today = DateTime.to_unix(~U[2023-08-09 19:59:03Z])
      yesterday = DateTime.to_unix(~U[2023-08-08 19:59:03Z])

      # Mock values for required fields
      common_attrs = %{playlist_id: 1, channel_id: 1}

      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(%{start: today, end: yesterday}, common_attrs)
        )

      assert not changeset.valid?
      assert [start: {"must be before the end date", []}] == changeset.errors
    end

    test "validates repeat_weekly_until is in the future or nil" do
      today = DateTime.to_unix(~U[2023-08-09 19:59:03Z])
      tomorrow = today + 24 * 60 * 60
      yesterday = today - 24 * 60 * 60
      future = ChannelEntry.timestamp() + 24 * 60 * 60

      # Common attributes for the required fields
      common_attrs = %{
        start: today,
        end: tomorrow,
        playlist_id: 1,
        channel_id: 1
      }

      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(common_attrs, %{
            repeat_weekly_until: DateTime.to_date(DateTime.from_unix!(future))
          })
        )

      assert changeset.valid?

      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(common_attrs, %{repeat_weekly_until: nil})
        )

      assert changeset.valid?

      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(common_attrs, %{
            repeat_weekly_until: DateTime.to_date(DateTime.from_unix!(yesterday))
          })
        )

      assert not changeset.valid?
      assert [repeat_weekly_until: {"must be in the future or nil", []}] == changeset.errors
    end
  end
end
