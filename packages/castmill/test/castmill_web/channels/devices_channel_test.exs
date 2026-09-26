defmodule CastmillWeb.DevicesChannelTest do
  use CastmillWeb.ChannelCase, async: true

  alias CastmillWeb.DevicesChannel

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  setup do
    # Create network, organization, and device
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})

    # Register a device
    {:ok, devices_registration} = device_registration_fixture()

    {:ok, {device, token}} =
      Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
        name: "Test Device"
      })

    # Create socket with device assigns - device_ip must be a tuple
    socket =
      CastmillWeb.DeviceSocket
      |> socket("device_id", %{
        device: %{device_id: device.id, hardware_id: "test", device_ip: {127, 0, 0, 1}}
      })

    %{socket: socket, device: device, token: token, organization: organization}
  end

  describe "handle_info/2 - channel_updated" do
    test "pushes channel_updated event to client", %{socket: socket, device: device, token: token} do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_updated message
      message = %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: 456
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_updated", %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: 456
      }
    end

    test "pushes channel_updated event with nil default_playlist_id", %{
      socket: socket,
      device: device,
      token: token
    } do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_updated message with nil default_playlist_id
      message = %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: nil
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_updated", %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: nil
      }
    end
  end

  describe "handle_info/2 - channel_added" do
    test "pushes channel_added event to client", %{socket: socket, device: device, token: token} do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_added message
      message = %{
        event: "channel_added",
        channel: %{
          id: 123,
          name: "Test Channel",
          timezone: "Europe/Amsterdam",
          default_playlist_id: 456,
          entries: []
        }
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_added", %{
        event: "channel_added",
        channel: %{
          id: 123,
          name: "Test Channel",
          timezone: "Europe/Amsterdam",
          default_playlist_id: 456,
          entries: []
        }
      }
    end
  end

  describe "handle_info/2 - channel_removed" do
    test "pushes channel_removed event to client", %{socket: socket, device: device, token: token} do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_removed message
      message = %{
        event: "channel_removed",
        channel_id: 123
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_removed", %{
        event: "channel_removed",
        channel_id: 123
      }
    end
  end

  describe "handle_info/2 - playlist_updated" do
    test "pushes playlist_updated event to client", %{
      socket: socket,
      device: device,
      token: token
    } do
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      message = %{event: "playlist_updated", playlist_id: 123}

      DevicesChannel.handle_info(message, socket)

      assert_push "playlist_updated", %{event: "playlist_updated", playlist_id: 123}
    end
  end

  describe "handle_in/3 - res:delete" do
    test "forwards the response and acknowledges the device", %{socket: socket} do
      ref =
        self()
        |> :erlang.term_to_binary()
        |> Base.url_encode64()

      result = %{success: true, deleted: 3}

      assert {:reply, :ok, ^socket} =
               DevicesChannel.handle_in(
                 "res:delete",
                 %{"ref" => ref, "result" => result},
                 socket
               )

      assert_receive {:device_response, ^result}
    end
  end

  describe "handle_in/3 - errors:report" do
    test "aggregates valid reports for the authenticated device", %{
      socket: socket,
      device: device,
      token: token
    } do
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      now = DateTime.utc_now() |> DateTime.to_iso8601()

      payload = %{
        "reports" => [
          %{
            "report_id" => "report-1",
            "fingerprint" => "media-load-1",
            "category" => "media-load",
            "message" => "Unable to load media",
            "count" => 3,
            "first_occurred_at" => now,
            "last_occurred_at" => now
          }
        ],
        "dropped_count" => 0
      }

      assert {:reply, {:ok, %{accepted_report_ids: ["report-1"]}}, _socket} =
               DevicesChannel.handle_in("errors:report", payload, socket)

      events =
        Castmill.Devices.list_devices_events(%{
          device_id: device.id,
          page: 1,
          page_size: 10,
          key: "timestamp",
          direction: "descending"
        })

      event = Enum.find(events, &(&1.type == "e"))

      assert event.type == "e"
      assert event.occurrence_count == 3
      assert event.category == "media-load"

      assert {:reply, {:ok, %{accepted_report_ids: ["report-1"]}}, _socket} =
               DevicesChannel.handle_in("errors:report", payload, socket)

      event =
        Castmill.Devices.list_devices_events(%{
          device_id: device.id,
          page: 1,
          page_size: 10,
          key: "timestamp",
          direction: "descending"
        })
        |> Enum.find(&(&1.type == "e"))

      assert event.occurrence_count == 3
    end

    test "rejects malformed reports", %{socket: socket} do
      assert {:reply, {:error, %{reason: "invalid_error_report_id"}}, ^socket} =
               DevicesChannel.handle_in(
                 "errors:report",
                 %{
                   "reports" => [%{"message" => "missing required fields"}],
                   "dropped_count" => 0
                 },
                 socket
               )
    end

    test "rejects valid batches that exceed the device error-report rate limit", %{
      socket: socket,
      device: device
    } do
      now = DateTime.utc_now() |> DateTime.to_iso8601()

      reports =
        for index <- 1..20 do
          %{
            "report_id" => "rate-limit-#{index}",
            "fingerprint" => "rate-limit-#{index}",
            "category" => "runtime",
            "message" => "Rate limit test",
            "count" => 1,
            "first_occurred_at" => now,
            "last_occurred_at" => now
          }
        end

      payload = %{"reports" => reports, "dropped_count" => 0}

      for _ <- 1..6 do
        assert {:reply, {:ok, _}, _socket} =
                 DevicesChannel.handle_in("errors:report", payload, socket)
      end

      assert {:reply, {:error, %{reason: "error_report_rate_limited"}}, ^socket} =
               DevicesChannel.handle_in("errors:report", payload, socket)

      event_count =
        Castmill.Devices.list_devices_events(%{
          device_id: device.id,
          page: 1,
          page_size: 100,
          key: "timestamp",
          direction: "descending"
        })
        |> Enum.count(&(&1.type == "e"))

      assert event_count <= 100
    end

    test "deduplicates retried overflow reports using their client report ID", %{
      socket: socket,
      device: device
    } do
      payload = %{
        "reports" => [],
        "dropped_count" => 3,
        "dropped_report_id" => "overflow-report-1"
      }

      assert {:reply, {:ok, %{accepted_report_ids: []}}, _socket} =
               DevicesChannel.handle_in("errors:report", payload, socket)

      assert {:reply, {:ok, %{accepted_report_ids: []}}, _socket} =
               DevicesChannel.handle_in("errors:report", payload, socket)

      event =
        Castmill.Devices.list_devices_events(%{
          device_id: device.id,
          page: 1,
          page_size: 10,
          key: "timestamp",
          direction: "descending"
        })
        |> Enum.find(&(&1.category == "overflow"))

      assert event.occurrence_count == 3
    end

    test "accepts and truncates oversized legacy UTF-8 fields", %{
      socket: socket,
      device: device
    } do
      now = DateTime.utc_now() |> DateTime.to_iso8601()

      payload = %{
        "reports" => [
          %{
            "report_id" => "legacy-report",
            "fingerprint" => "legacy-runtime",
            "category" => "runtime",
            "message" => String.duplicate("bäckasiner ", 150),
            "stack" => String.duplicate("bäckasiner ", 600),
            "count" => 2,
            "first_occurred_at" => now,
            "last_occurred_at" => now
          }
        ],
        "dropped_count" => 0
      }

      assert {:reply, {:ok, %{accepted_report_ids: ["legacy-report"]}}, _socket} =
               DevicesChannel.handle_in("errors:report", payload, socket)

      event =
        Castmill.Devices.list_devices_events(%{
          device_id: device.id,
          page: 1,
          page_size: 10
        })
        |> Enum.find(&(&1.fingerprint == "legacy-runtime"))

      assert byte_size(event.msg) <= 1024
      assert byte_size(event.stack) <= 4096
      assert String.ends_with?(event.msg, "…")
      assert String.ends_with?(event.stack, "…")
      assert event.occurrence_count == 2
    end

    test "stores diagnostic markup as bounded text", %{socket: socket, device: device} do
      now = DateTime.utc_now() |> DateTime.to_iso8601()

      message =
        "<script>alert('device-controlled diagnostic')</script>" <> String.duplicate("x", 2_000)

      payload = %{
        "reports" => [
          %{
            "report_id" => "markup-report",
            "fingerprint" => "markup-runtime",
            "category" => "runtime",
            "message" => message,
            "count" => 1,
            "first_occurred_at" => now,
            "last_occurred_at" => now
          }
        ],
        "dropped_count" => 0
      }

      assert {:reply, {:ok, %{accepted_report_ids: ["markup-report"]}}, _socket} =
               DevicesChannel.handle_in("errors:report", payload, socket)

      event =
        Castmill.Devices.list_devices_events(%{
          device_id: device.id,
          page: 1,
          page_size: 10
        })
        |> Enum.find(&(&1.fingerprint == "markup-runtime"))

      assert String.starts_with?(
               event.msg,
               "<script>alert('device-controlled diagnostic')</script>"
             )

      assert byte_size(event.msg) <= 1024
    end
  end
end
