defmodule Castmill.CalendarsTest do
  use Castmill.DataCase

  @moduletag :playlist_data_case

  alias Castmill.Resources

  describe "calendars" do
    @describetag :calendars

    alias Castmill.Resources.Calendar

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.CalendarsFixtures
    import Castmill.PlaylistsFixtures

    test "list_calendar/1 returns all calendars" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      calendar =
        calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Calendar, %{organization_id: organization.id}) == [calendar]
    end

    test "update_calendar/1 updates the calendar name" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      calendar =
        calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Calendar, %{organization_id: organization.id}) == [calendar]

      update_attrs = %{name: "some updated name"}

      assert {:ok, calendar} = Resources.update_calendar(calendar, update_attrs)
      assert calendar.name == "some updated name"
    end

    test "delete_calendar/1 deletes calendar" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      calendar =
        calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Calendar, %{organization_id: organization.id}) == [calendar]

      Resources.delete_calendar(calendar)

      assert Resources.list_resources(Calendar, %{organization_id: organization.id}) == []
    end

    test "add_calendar_entry/3 adds one entry to a given calendar" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})

      calendar =
        calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Calendar, %{organization_id: organization.id}) == [calendar]

      assert Resources.list_calendar_entries(
               calendar.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == []

      entry_attrs = %{
        name: "some entry name",
        start: DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        end: DateTime.to_unix(~U[2005-05-06 19:59:03Z]),
        timezone: "Europe/Stockholm"
      }

      assert {:ok, entry} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(
               calendar.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [
               entry
             ]
    end

    test "add_calendar_entry/3 adds several entries to a given calendar" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})

      calendar =
        calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Calendar, %{organization_id: organization.id}) == [calendar]

      assert Resources.list_calendar_entries(
               calendar.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == []

      entry_attrs = %{
        name: "some entry name",
        start: DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        end: DateTime.to_unix(~U[2005-05-05 21:59:03Z]),
        timezone: "Europe/Stockholm"
      }

      assert {:ok, entry} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(
               calendar.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [
               entry
             ]

      entry_attrs = %{
        name: "some entry name",
        start: DateTime.to_unix(~U[2005-05-06 19:59:03Z]),
        end: DateTime.to_unix(~U[2005-05-06 21:59:03Z]),
        timezone: "Europe/Stockholm"
      }

      assert {:ok, entry2} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(
               calendar.id,
               DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [
               entry,
               entry2
             ]
    end

    test "delete_calendar/1 deletes calendar and its calendar entries" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      calendar =
        calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_resources(Calendar, %{organization_id: organization.id}) == [calendar]

      entry_attrs = %{
        name: "some entry name",
        start: DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        end: DateTime.to_unix(~U[2005-05-05 21:59:03Z]),
        timezone: "Europe/Stockholm"
      }

      playlist = playlist_fixture(%{organization_id: organization.id})

      assert {:ok, entry} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(
               calendar.id,
               DateTime.to_unix(~U[2005-05-05 00:00:00Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == [entry]

      Resources.delete_calendar(calendar)

      assert Resources.list_calendar_entries(
               calendar.id,
               DateTime.to_unix(~U[2005-05-05 00:00:00Z]),
               DateTime.to_unix(~U[9999-12-31 00:00:00Z])
             ) == []
    end
  end
end
