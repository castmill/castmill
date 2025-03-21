defmodule Castmill.ChannelsTest do
  use Castmill.DataCase

  @moduletag :playlist_data_case

  alias Castmill.Resources

  describe "channels" do
    @describetag :channels

    alias Castmill.Resources.Channel

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.ChannelsFixtures
    import Castmill.PlaylistsFixtures

    test "list_channel/1 returns all channels" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Channel, %{organization_id: organization.id}) == [channel]
    end

    test "update_channel/1 updates the channel name" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Channel, %{organization_id: organization.id}) == [channel]

      update_attrs = %{name: "some updated name"}

      assert {:ok, channel} = Resources.update_channel(channel, update_attrs)
      assert channel.name == "some updated name"
    end

    test "delete_channel/1 deletes channel" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Channel, %{organization_id: organization.id}) == [channel]

      Resources.delete_channel(channel)

      assert Resources.list_resources(Channel, %{organization_id: organization.id}) == []
    end

    test "add_channel_entry/3 adds one entry to a given channel" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Channel, %{organization_id: organization.id}) == [channel]

      assert Resources.list_channel_entries(
               channel.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == []

      entry_attrs = %{
        "name" => "some entry name",
        "start" => DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        "end" => DateTime.to_unix(~U[2005-05-06 19:59:03Z]),
        "timezone" => "Europe/Stockholm",
        "playlist_id" => playlist.id
      }

      assert {:ok, entry} = Resources.add_channel_entry(channel.id, entry_attrs)

      assert Resources.list_channel_entries(
               channel.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [
               entry
             ]
    end

    test "add_channel_entry/3 adds several entries to a given channel" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Channel, %{organization_id: organization.id}) == [channel]

      assert Resources.list_channel_entries(
               channel.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == []

      entry_attrs = %{
        "name" => "some entry name",
        "start" => DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        "end" => DateTime.to_unix(~U[2005-05-05 21:59:03Z]),
        "timezone" => "Europe/Stockholm",
        "playlist_id" => playlist.id
      }

      assert {:ok, entry} = Resources.add_channel_entry(channel.id, entry_attrs)

      assert Resources.list_channel_entries(
               channel.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [
               entry
             ]

      entry_attrs = %{
        "name" => "some entry name",
        "start" => DateTime.to_unix(~U[2005-05-06 19:59:03Z]),
        "end" => DateTime.to_unix(~U[2005-05-06 21:59:03Z]),
        "timezone" => "Europe/Stockholm",
        "playlist_id" => playlist.id
      }

      assert {:ok, entry2} = Resources.add_channel_entry(channel.id, entry_attrs)

      assert Resources.list_channel_entries(
               channel.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [
               entry,
               entry2
             ]
    end

    test "delete_channel/1 deletes channel and its channel entries" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Channel, %{organization_id: organization.id}) == [channel]

      playlist = playlist_fixture(%{organization_id: organization.id})

      entry_attrs = %{
        "name" => "some entry name",
        "start" => DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        "end" => DateTime.to_unix(~U[2005-05-05 21:59:03Z]),
        "timezone" => "Europe/Stockholm",
        "playlist_id" => playlist.id
      }

      assert {:ok, entry} = Resources.add_channel_entry(channel.id, entry_attrs)

      assert Resources.list_channel_entries(
               channel.id,
               DateTime.to_unix(~U[2005-05-05 00:00:00Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [entry]

      Resources.delete_channel(channel)

      assert Resources.list_channel_entries(
               channel.id,
               DateTime.to_unix(~U[2005-05-05 00:00:00Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == []
    end
  end
end
