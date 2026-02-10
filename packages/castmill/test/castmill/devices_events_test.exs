defmodule Castmill.DevicesEventsTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  alias Castmill.Devices
  alias Castmill.Devices.DevicesEvents
  alias Castmill.Repo

  @max_logs 100

  setup do
    # Substitute with real device creation if needed
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    device = device_fixture(%{organization_id: organization.id})

    {:ok, device: device}
  end

  describe "insert_event/2" do
    test "inserts a new event for a device", %{device: device} do
      attrs = %{device_id: device.id, type: "o", msg: "Device is online"}

      assert {:ok, _} = Devices.insert_event(attrs, @max_logs)

      assert 1 ==
               Repo.aggregate(
                 from(l in DevicesEvents, where: l.device_id == ^device.id),
                 :count,
                 :id
               )
    end

    test "deletes the oldest event when event limit is reached", %{device: device} do
      # Fill up to maximum events
      for n <- 1..@max_logs do
        attrs = %{device_id: device.id, type: "i", msg: "Log #{n}"}
        Devices.insert_event(attrs, @max_logs)
      end

      # Check that exactly `@max_logs` events are present
      assert @max_logs ==
               Repo.aggregate(
                 from(l in DevicesEvents, where: l.device_id == ^device.id),
                 :count,
                 :id
               )

      # Add one more event, which should cause the first event to be deleted
      Devices.insert_event(%{device_id: device.id, type: "x", msg: "Latest event"}, @max_logs)

      assert @max_logs ==
               Repo.aggregate(
                 from(l in DevicesEvents, where: l.device_id == ^device.id),
                 :count,
                 :id
               )

      # Ensure the first event (with message "Log 1") is no longer present
      assert [] ==
               Repo.all(
                 from(l in DevicesEvents, where: l.device_id == ^device.id and l.msg == "Log 1")
               )
    end

    test "does not insert event with an invalid type", %{device: device} do
      # Test with an invalid type
      attrs = %{device_id: device.id, type: "z", msg: "Invalid type event"}

      assert_raise Ecto.InvalidChangesetError, fn ->
        Devices.insert_event(attrs, @max_logs)
      end
    end

    test "ensures events remain under the maximum count when inserting many", %{device: device} do
      initial_logs = 10
      max_to_insert = 150

      # Insert a few initial events
      for n <- 1..initial_logs do
        Devices.insert_event(
          %{device_id: device.id, type: "o", msg: "Initial Log #{n}"},
          @max_logs
        )
      end

      # Insert many more events, expecting old events to be purged
      for n <- 1..max_to_insert do
        Devices.insert_event(%{device_id: device.id, type: "e", msg: "New Log #{n}"}, @max_logs)
      end

      assert @max_logs ==
               Repo.aggregate(
                 from(l in DevicesEvents, where: l.device_id == ^device.id),
                 :count,
                 :id
               )

      # The initial events should no longer exist
      assert [] ==
               Repo.all(
                 from(l in DevicesEvents,
                   where: l.device_id == ^device.id and ilike(l.msg, ^"%Initial Log%")
                 )
               )
    end
  end

  describe "list_devices_events/1" do
    test "returns events with pagination", %{device: device} do
      # Insert 30 events
      for n <- 1..30 do
        Devices.insert_event(%{device_id: device.id, type: "o", msg: "Log #{n}"}, @max_logs)
      end

      # Retrieve the first page (10 items per page)
      params = %{device_id: device.id, page: 1, page_size: 10, search: nil}
      logs_page_1 = Devices.list_devices_events(params)
      assert length(logs_page_1) == 10

      # Retrieve the second page (next 10 items)
      params = %{device_id: device.id, page: 2, page_size: 10, search: nil}
      logs_page_2 = Devices.list_devices_events(params)
      assert length(logs_page_2) == 10

      # Ensure that pages contain different entries
      refute Enum.any?(logs_page_1, fn l1 ->
               Enum.any?(logs_page_2, fn l2 -> l1.id == l2.id end)
             end)
    end

    test "returns events that match the search pattern", %{device: device} do
      # Insert events with different messages
      Devices.insert_event(%{device_id: device.id, type: "o", msg: "Online event"}, @max_logs)
      Devices.insert_event(%{device_id: device.id, type: "x", msg: "Offline event"}, @max_logs)
      Devices.insert_event(%{device_id: device.id, type: "e", msg: "Error occurred"}, @max_logs)
      Devices.insert_event(%{device_id: device.id, type: "w", msg: "Warning sign"}, @max_logs)

      # Search for events containing the word "event"
      params = %{device_id: device.id, page: 1, page_size: 10, search: "event"}
      matching_logs = Devices.list_devices_events(params)

      assert length(matching_logs) == 2
      assert Enum.all?(matching_logs, fn event -> String.contains?(event.msg, "event") end)
    end

    test "sorts events by type", %{device: device} do
      # Insert events with different types
      Devices.insert_event(%{device_id: device.id, type: "w", msg: "Warning"}, @max_logs)
      Devices.insert_event(%{device_id: device.id, type: "e", msg: "Error"}, @max_logs)
      Devices.insert_event(%{device_id: device.id, type: "o", msg: "Online"}, @max_logs)
      Devices.insert_event(%{device_id: device.id, type: "i", msg: "Info"}, @max_logs)
      Devices.insert_event(%{device_id: device.id, type: "x", msg: "Offline"}, @max_logs)

      # Sort by type in ascending order
      params = %{
        device_id: device.id,
        page: 1,
        page_size: 10,
        key: "type",
        direction: "ascending"
      }

      sorted_logs = Devices.list_devices_events(params)

      # Verify events are returned (no SQL error)
      assert length(sorted_logs) == 5

      # Verify they are sorted by type field (alphabetically: e, i, o, w, x)
      types = Enum.map(sorted_logs, & &1.type)
      assert types == ["e", "i", "o", "w", "x"]
    end

    test "sorts events by type with timestamp as secondary sort", %{device: device} do
      # Insert multiple events with the same type at different times
      # Using Process.sleep to ensure different timestamps
      {:ok, event1} =
        Devices.insert_event(%{device_id: device.id, type: "e", msg: "Error 1"}, @max_logs)

      Process.sleep(10)

      {:ok, event2} =
        Devices.insert_event(%{device_id: device.id, type: "e", msg: "Error 2"}, @max_logs)

      Process.sleep(10)

      {:ok, event3} =
        Devices.insert_event(%{device_id: device.id, type: "e", msg: "Error 3"}, @max_logs)

      Process.sleep(10)

      {:ok, event4} =
        Devices.insert_event(%{device_id: device.id, type: "i", msg: "Info 1"}, @max_logs)

      Process.sleep(10)

      {:ok, event5} =
        Devices.insert_event(%{device_id: device.id, type: "i", msg: "Info 2"}, @max_logs)

      # Sort by type in ascending order (should use timestamp desc as secondary sort)
      params = %{
        device_id: device.id,
        page: 1,
        page_size: 10,
        key: "type",
        direction: "ascending"
      }

      sorted_logs = Devices.list_devices_events(params)

      # Verify events are returned
      assert length(sorted_logs) == 5

      # Verify primary sort by type (e before i)
      types = Enum.map(sorted_logs, & &1.type)
      assert Enum.take(types, 3) == ["e", "e", "e"]
      assert Enum.drop(types, 3) == ["i", "i"]

      # Verify secondary sort by timestamp descending within same type
      # For type "e": event3 (newest) should come before event2, which should come before event1 (oldest)
      error_events = Enum.filter(sorted_logs, fn e -> e.type == "e" end)
      assert Enum.at(error_events, 0).id == event3.id
      assert Enum.at(error_events, 1).id == event2.id
      assert Enum.at(error_events, 2).id == event1.id

      # For type "i": event5 (newest) should come before event4 (oldest)
      info_events = Enum.filter(sorted_logs, fn e -> e.type == "i" end)
      assert Enum.at(info_events, 0).id == event5.id
      assert Enum.at(info_events, 1).id == event4.id
    end
  end
end
