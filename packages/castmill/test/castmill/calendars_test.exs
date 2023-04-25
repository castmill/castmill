defmodule Castmill.CalendarsTest do
  use Castmill.DataCase

  @moduletag :playlist_data_case

  alias Castmill.Resources
  alias Castmill.Calendars.Calendar

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.CalendarsFixtures
  import Castmill.PlaylistsFixtures

  describe "calendars" do
    @describetag :calendars

    test "list_calendar/1 returns all calendars" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      assert Resources.list_calendars(organization.id) == [calendar]
    end

    test "update_calendar/1 updates the calendar name" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id) == [calendar]

      update_attrs = %{name: "some updated name"}

      assert {:ok, calendar} = Resources.update_calendar(calendar, update_attrs)
      assert calendar.name == "some updated name"
    end

    test "delete_calendar/1 deletes calendar" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id) == [calendar]

      Resources.delete_calendar(calendar)

      assert Resources.list_calendars(organization.id) == []
    end

    test "add_calendar_entry/3 adds one entry to a given calendar" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id) == [calendar]

      assert Resources.list_calendar_entries(calendar.id, ~D[2005-05-05], ~D[9999-12-31]) == []

      entry_attrs = %{
        name: "some entry name",
        start: ~D[2005-05-05],
        end: ~D[2005-05-05],
        timezone: "Europe/Stockholm"
      }

      assert {:ok, entry} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(calendar.id, ~D[2005-05-05], ~D[9999-12-31]) == [entry]
    end

    test "add_calendar_entry/3 adds several entries to a given calendar" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id) == [calendar]

      assert Resources.list_calendar_entries(calendar.id, ~D[2005-05-05], ~D[9999-12-31]) == []

      entry_attrs = %{
        name: "some entry name",
        start: ~D[2005-05-05],
        end: ~D[2005-05-05],
        timezone: "Europe/Stockholm"
      }

      assert {:ok, entry} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(calendar.id, ~D[2005-05-05], ~D[9999-12-31]) == [entry]

      entry_attrs = %{
        name: "some entry name",
        start: ~D[2005-05-06],
        end: ~D[2005-05-06],
        timezone: "Europe/Stockholm"
      }

      assert {:ok, entry2} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(calendar.id, ~D[2005-05-05], ~D[9999-12-31]) == [entry, entry2]
    end

    test "delete_calendar/1 deletes calendar and its calendar entries" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id) == [calendar]

      entry_attrs = %{
        name: "some entry name",
        start: ~D[2005-05-05],
        end: ~D[2005-05-05],
        timezone: "Europe/Stockholm"
      }

      playlist = playlist_fixture(%{organization_id: organization.id})

      assert {:ok, entry} = Resources.add_calendar_entry(calendar.id, playlist.id, entry_attrs)

      assert Resources.list_calendar_entries(calendar.id, ~D[2005-05-05], ~D[9999-12-31]) == [entry]

      Resources.delete_calendar(calendar)

      assert Resources.list_calendar_entries(calendar.id, ~D[2005-05-05], ~D[9999-12-31]) == []
    end

  end

  describe "pagination" do
    @describetag :pagination

    test "list_calendars/2 returns the specified number of calendars" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      cal1 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal2 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal3 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal4 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id, 2) == [cal1, cal2]
    end

    test "list_calendars/2 returns the specified number of calendars starting from the offset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      cal1 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal2 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id, 3) == [cal1, cal2]
    end

    test "list_calendars/3 returns the specified number of calendars starting from the offset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      cal1 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal2 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal3 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal4 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal5 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id, 2, 2) == [cal3, cal4]
    end

    test "list_calendars/3 returns all calendars if limit + offset is greater than the number of calendars" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      cal1 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal2 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal3 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})
      cal4 = calendar_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      assert Resources.list_calendars(organization.id, 2, 2) == [cal3, cal4]
    end
  end
end