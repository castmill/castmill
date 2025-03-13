defmodule Castmill.Resources.ChannelEntryTest do
  use ExUnit.Case, async: true
  alias Castmill.Resources.ChannelEntry

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.ChannelsFixtures

  # Enhanced setup block to provide a channel
  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Castmill.Repo)

    # Create necessary dependencies and a channel
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})

    {:ok, channel: channel}
  end

  @moduletag :channel_entry
  describe "ChannelEntry changeset" do
    test "validates that dates are in the same week", %{channel: channel} do
      wednesday = ~U[2023-08-09 19:59:03Z]
      thursday = ~U[2023-08-10 19:59:03Z]
      next_wednesday = ~U[2023-08-16 19:59:03Z]

      common_attrs = %{playlist_id: 1, channel_id: channel.id}

      # Same week (valid)
      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(%{start: wednesday, end: thursday}, common_attrs)
        )

      assert changeset.valid?, "Changeset should be valid for dates in the same week"

      # Different weeks (invalid)
      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(%{start: wednesday, end: next_wednesday}, common_attrs)
        )

      assert not changeset.valid?, "Changeset should be invalid for dates in different weeks"
      assert [start: {"and end date must be in the same week", []}] == changeset.errors
    end

    test "validates start date is before end date", %{channel: channel} do
      # This test already works, just reusing the setup channel for consistency
      today = ~U[2023-08-09 19:59:03Z]
      yesterday = ~U[2023-08-08 19:59:03Z]

      common_attrs = %{playlist_id: 1, channel_id: channel.id}

      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(%{start: today, end: yesterday}, common_attrs)
        )

      assert not changeset.valid?
      assert [start: {"must be before the end date", []}] == changeset.errors
    end

    test "validates repeat_weekly_until is in the future or nil", %{channel: channel} do
      today = ~U[2023-08-09 19:59:03Z]
      tomorrow = ~U[2023-08-10 19:59:03Z]
      yesterday = ~U[2023-08-08 19:59:03Z]
      future = DateTime.add(DateTime.utc_now(), 24 * 60 * 60, :second)

      common_attrs = %{start: today, end: tomorrow, playlist_id: 1, channel_id: channel.id}

      # Future date (valid)
      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(common_attrs, %{repeat_weekly_until: DateTime.to_date(future)})
        )

      assert changeset.valid?, "Changeset should be valid with future repeat_weekly_until"

      # Nil (valid)
      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(common_attrs, %{repeat_weekly_until: nil})
        )

      assert changeset.valid?, "Changeset should be valid with nil repeat_weekly_until"

      # Past date (invalid)
      changeset =
        ChannelEntry.changeset(
          %ChannelEntry{},
          Map.merge(common_attrs, %{repeat_weekly_until: DateTime.to_date(yesterday)})
        )

      assert not changeset.valid?, "Changeset should be invalid with past repeat_weekly_until"
      assert [repeat_weekly_until: {"must be in the future or nil", []}] == changeset.errors
    end
  end
end
