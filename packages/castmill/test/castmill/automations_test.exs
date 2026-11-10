defmodule Castmill.AutomationsTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures
  import Castmill.ChannelsFixtures
  import Castmill.DevicesFixtures

  alias Castmill.Automations
  alias Castmill.Automations.Automation
  alias Castmill.Devices

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    playlist = playlist_fixture(%{organization_id: organization.id, name: "Spring offer"})

    device =
      device_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

    %{network: network, organization: organization, playlist: playlist, device: device}
  end

  defp rule(playlist, extra \\ %{}) do
    Map.merge(
      %{
        "when" => %{
          "source" => "clock",
          "condition" => "at",
          "config" => %{"schedule" => %{"type" => "hourly", "minute" => 8}}
        },
        "then" => %{"action" => "interrupt", "config" => %{"playlist_id" => playlist.id}}
      },
      extra
    )
  end

  defp automation_fixture(organization, playlist, attrs \\ %{}) do
    {:ok, automation} =
      Automations.create_automation(
        organization.id,
        Map.merge(%{"name" => "Spring", "rules" => [rule(playlist)]}, attrs)
      )

    automation
  end

  describe "CRUD" do
    test "creates an automation with normalized rules", %{
      organization: organization,
      playlist: playlist
    } do
      assert {:ok, %Automation{} = automation} =
               Automations.create_automation(organization.id, %{
                 name: "Spring",
                 rules: [rule(playlist)]
               })

      assert automation.enabled
      assert [%{"id" => id, "then" => %{"config" => %{"plays" => 1}}}] = automation.rules
      assert is_binary(id)

      # Rules are stored as jsonb and read back as maps.
      assert Repo.get!(Automation, automation.id).rules == automation.rules
    end

    test "validates name and rules", %{organization: organization, playlist: playlist} do
      assert {:error, changeset} = Automations.create_automation(organization.id, %{})
      assert %{name: ["can't be blank"]} = errors_on(changeset)

      assert {:error, changeset} =
               Automations.create_automation(organization.id, %{
                 "name" => "Bad",
                 "rules" => [rule(playlist, %{"when" => %{"source" => "gps"}})]
               })

      assert %{rules: ["rule 1: when.source 'gps' is not supported"]} = errors_on(changeset)
    end

    test "rejects playlists of other organizations", %{
      organization: organization,
      network: network
    } do
      other = organization_fixture(%{network_id: network.id, name: "Foreign org"})

      foreign =
        %Castmill.Resources.Playlist{}
        |> Castmill.Resources.Playlist.changeset(%{name: "Foreign", organization_id: other.id})
        |> Repo.insert!()

      assert {:error, changeset} =
               Automations.create_automation(organization.id, %{
                 "name" => "Steal",
                 "rules" => [rule(foreign)]
               })

      assert %{rules: ["references a playlist that does not exist"]} = errors_on(changeset)
    end

    test "lists, searches and paginates", %{organization: organization, playlist: playlist} do
      automation_fixture(organization, playlist, %{"name" => "Alpha"})
      automation_fixture(organization, playlist, %{"name" => "Beta"})

      assert {[%{name: "Alpha"}, %{name: "Beta"}], 2} =
               Automations.list_automations(organization.id)

      assert {[%{name: "Beta"}], 1} =
               Automations.list_automations(organization.id, %{"search" => "bet"})

      assert {[%{name: "Beta"}], 2} =
               Automations.list_automations(organization.id, %{"page" => "2", "page_size" => "1"})
    end

    test "gets automations only within the organization", %{
      organization: organization,
      playlist: playlist,
      network: network
    } do
      automation = automation_fixture(organization, playlist)
      other = organization_fixture(%{network_id: network.id, name: "Foreign org"})

      assert %Automation{} = Automations.get_automation(organization.id, automation.id)
      assert %Automation{} = Automations.get_automation(organization.id, "#{automation.id}")
      assert Automations.get_automation(other.id, automation.id) == nil
      assert Automations.get_automation(organization.id, "abc") == nil
      assert %Automation{} = Automations.get_automation(automation.id)
      assert Automations.get_automation("x") == nil
    end

    test "updates and deletes, notifying assigned devices", %{
      organization: organization,
      playlist: playlist,
      device: device
    } do
      automation = automation_fixture(organization, playlist)
      {:ok, automation} = Automations.set_assignments(automation, [device.id], [])
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      assert {:ok, updated} =
               Automations.update_automation(automation, %{
                 "name" => "Renamed",
                 "enabled" => false
               })

      assert updated.name == "Renamed"
      refute updated.enabled
      assert_receive %{event: "automations_updated"}

      assert {:ok, _} = Automations.delete_automation(updated)
      assert_receive %{event: "automations_updated"}
      assert Automations.get_automation(organization.id, automation.id) == nil
    end
  end

  describe "quotas" do
    test "enforces the automations quota", %{organization: organization, playlist: playlist} do
      Castmill.Quotas.add_quota_to_organization(organization.id, :automations, 1)
      automation_fixture(organization, playlist)

      assert {:error, :quota_exceeded} =
               Automations.create_automation(organization.id, %{"name" => "Second"})
    end

    test "enforces the rules quota", %{organization: organization, playlist: playlist} do
      Castmill.Quotas.add_quota_to_organization(organization.id, :automation_rules, 3)

      automation =
        automation_fixture(organization, playlist, %{"rules" => [rule(playlist), rule(playlist)]})

      assert Automations.rules_used(organization.id) == 2

      assert {:error, :rules_quota_exceeded} =
               Automations.create_automation(organization.id, %{
                 "name" => "Two",
                 "rules" => [rule(playlist), rule(playlist)]
               })

      # Updating replaces the automation's own rules.
      assert {:ok, _} =
               Automations.update_automation(automation, %{
                 "rules" => [rule(playlist), rule(playlist), rule(playlist)]
               })

      assert {:error, :rules_quota_exceeded} =
               Automations.update_automation(automation, %{
                 "rules" => List.duplicate(rule(playlist), 4)
               })
    end
  end

  describe "assignments and effective automations" do
    setup %{organization: organization, playlist: playlist, device: device} do
      channel_a =
        channel_fixture(%{organization_id: organization.id, name: "A", timezone: "Europe/London"})

      channel_b =
        channel_fixture(%{organization_id: organization.id, name: "B", timezone: "Europe/London"})

      {:ok, _} = Devices.add_channel(device.id, channel_a.id)
      {:ok, _} = Devices.add_channel(device.id, channel_b.id)

      automations =
        for name <- ~w(d1 d2 c1 c2 shared off) do
          automation_fixture(organization, playlist, %{"name" => name})
        end
        |> Map.new(&{&1.name, &1})

      %{channel_a: channel_a, channel_b: channel_b, automations: automations}
    end

    test "device automations come first, then channel automations, deduplicated", %{
      device: device,
      channel_a: channel_a,
      channel_b: channel_b,
      automations: a
    } do
      {:ok, _} = Automations.set_assignments(a["d2"], [device.id], [])
      {:ok, _} = Automations.set_assignments(a["d1"], [device.id], [])
      {:ok, _} = Automations.set_assignments(a["shared"], [device.id], [channel_b.id])
      {:ok, _} = Automations.set_assignments(a["c1"], [], [channel_a.id])
      {:ok, _} = Automations.set_assignments(a["c2"], [], [channel_b.id])
      {:ok, _} = Automations.set_assignments(a["off"], [device.id], [])
      {:ok, _} = Automations.update_automation(a["off"], %{"enabled" => false})

      effective = Automations.effective_automations(device.id)
      names = Enum.map(effective, fn {automation, _via} -> automation.name end)

      # Direct assignments in assignment order (positions per device), then
      # channel automations in channel order.
      assert names == ["d2", "d1", "shared", "c1", "c2"]

      {_, shared_via} =
        Enum.find(effective, fn {automation, _} -> automation.name == "shared" end)

      assert [%{type: "device"}, %{type: "channel", id: channel_id, name: "B"}] = shared_via
      assert channel_id == channel_b.id

      with_disabled = Automations.effective_automations(device.id, include_disabled: true)
      assert length(with_disabled) == 6
    end

    test "devices without automations get an empty payload", %{organization: organization} do
      other_device = device_fixture(%{organization_id: organization.id})
      payload = Automations.device_payload(other_device, ~U[2026-11-06 10:00:00Z])
      assert payload["automations"] == []
      assert payload["generated_at"] == DateTime.to_unix(~U[2026-11-06 10:00:00Z], :millisecond)
      assert payload["valid_until"] == DateTime.to_unix(~U[2026-11-20 10:00:00Z], :millisecond)
    end

    test "builds the device payload with UTC occurrences in the device timezone", %{
      device: device,
      automations: a,
      playlist: playlist
    } do
      {:ok, _} = Automations.set_assignments(a["d1"], [device.id], [])
      payload = Automations.device_payload(device, ~U[2026-11-06 10:00:00Z])

      assert payload["timezone"] == "Europe/Stockholm"

      assert [%{"id" => id, "name" => "d1", "via" => [%{type: "device"}], "rules" => [rule]}] =
               payload["automations"]

      assert id == a["d1"].id
      assert rule["source"] == "clock"
      assert rule["kind"] == "event"
      assert rule["index"] == 0
      assert rule["action"] == "interrupt"
      assert rule["action_config"]["playlist_id"] == playlist.id
      assert rule["resources"] == %{playlists: [playlist.id]}
      assert rule["source_payload"]["timezone"] == "Europe/Stockholm"

      # 10:08 Stockholm (CET) = 09:08 UTC, so the first one is 10:08 UTC (11:08 local).
      assert hd(rule["source_payload"]["occurrences"]) ==
               DateTime.to_unix(~U[2026-11-06 10:08:00Z], :millisecond)

      assert length(rule["source_payload"]["occurrences"]) == 14 * 24
    end

    test "falls back to the channel timezone when the device has none", %{
      organization: organization,
      channel_a: channel_a,
      automations: a
    } do
      device =
        organization.id
        |> then(&device_fixture(%{organization_id: &1}))
        |> Ecto.Changeset.change(timezone: "")
        |> Repo.update!()

      {:ok, _} = Devices.add_channel(device.id, channel_a.id)
      {:ok, _} = Automations.set_assignments(a["c1"], [], [channel_a.id])

      payload = Automations.device_payload(device, ~U[2026-11-06 10:00:00Z])
      assert payload["timezone"] == "Etc/UTC"
      [%{"rules" => [rule]}] = payload["automations"]
      assert rule["source_payload"]["timezone"] == "Europe/London"
    end

    test "rejects devices or channels from another organization", %{
      network: network,
      automations: a
    } do
      other = organization_fixture(%{network_id: network.id, name: "Foreign org"})

      foreign_channel =
        channel_fixture(%{organization_id: other.id, timezone: "Europe/Stockholm"})

      assert {:error, :invalid_assignment} =
               Automations.set_assignments(a["d1"], [], [foreign_channel.id])

      assert {:error, :invalid_assignment} =
               Automations.set_assignments(a["d1"], [Ecto.UUID.generate()], [])

      assert {:error, :invalid_assignment} = Automations.set_assignments(a["d1"], ["nope"], [])
      assert {:error, :invalid_assignment} = Automations.set_assignments(a["d1"], [], ["x"])
    end

    test "assignments are replaced and notify old and new devices", %{
      organization: organization,
      device: device,
      channel_a: channel_a,
      automations: a
    } do
      other_device = device_fixture(%{organization_id: organization.id})
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      {:ok, automation} = Automations.set_assignments(a["d1"], [device.id], [channel_a.id])
      assert [%{device_id: device_id}] = automation.automations_devices
      assert device_id == device.id
      assert [%{channel_id: channel_id}] = automation.automations_channels
      assert channel_id == channel_a.id
      assert_receive %{event: "automations_updated"}

      {:ok, automation} = Automations.set_assignments(automation, [other_device.id], [])
      assert [%{device_id: other_id}] = automation.automations_devices
      assert other_id == other_device.id
      # The device that lost the automation is notified too.
      assert_receive %{event: "automations_updated"}
      assert Automations.affected_device_ids(automation) == [other_device.id]
    end

    test "channel membership changes notify the device", %{
      device: device,
      channel_a: channel_a,
      channel_b: channel_b,
      automations: a
    } do
      {:ok, _} = Automations.set_assignments(a["c1"], [], [channel_a.id])
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      Automations.notify_channel_membership_changed(device.id, "#{channel_b.id}")
      refute_receive %{event: "automations_updated"}, 50

      Automations.notify_channel_membership_changed(device.id, channel_a.id)
      assert_receive %{event: "automations_updated"}
      assert :ok = Automations.notify_channel_membership_changed(device.id, "bad")
    end
  end

  describe "referential integrity and device access" do
    test "blocks deleting a referenced playlist", %{
      organization: organization,
      playlist: playlist
    } do
      automation = automation_fixture(organization, playlist)

      assert Automations.playlist_referenced?(organization.id, playlist.id)

      assert [%{id: id}] =
               Automations.automations_referencing_playlist(organization.id, "#{playlist.id}")

      assert id == automation.id
      assert Automations.automations_referencing_playlist(organization.id, "x") == []

      assert {:error, :playlist_has_automations} = Castmill.Resources.delete_playlist(playlist)

      {:ok, _} = Automations.delete_automation(automation)
      assert {:ok, _} = Castmill.Resources.delete_playlist(playlist)
    end

    test "devices can fetch playlists referenced by their effective automations", %{
      organization: organization,
      playlist: playlist,
      device: device
    } do
      automation = automation_fixture(organization, playlist)
      refute Devices.has_access_to_playlist(device.id, playlist.id)

      {:ok, _} = Automations.set_assignments(automation, [device.id], [])
      assert Devices.has_access_to_playlist(device.id, playlist.id)
      assert Automations.device_references_playlist?(device.id, "#{playlist.id}")
      refute Automations.device_references_playlist?(device.id, "nope")

      {:ok, _} = Automations.update_automation(automation, %{"enabled" => false})
      refute Devices.has_access_to_playlist(device.id, playlist.id)
    end

    test "notifies devices when a referenced playlist changes", %{
      organization: organization,
      playlist: playlist,
      device: device
    } do
      automation = automation_fixture(organization, playlist)
      {:ok, _} = Automations.set_assignments(automation, [device.id], [])
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      Automations.notify_playlist_changed(organization.id, playlist.id)
      assert_receive %{event: "automations_updated"}
    end
  end

  describe "run now, previews, next firing and warnings" do
    test "run_rule sends the rule to online assigned devices", %{
      organization: organization,
      playlist: playlist,
      device: device
    } do
      automation = automation_fixture(organization, playlist)
      {:ok, automation} = Automations.set_assignments(automation, [device.id], [])
      [%{"id" => rule_id}] = automation.rules

      assert {:ok, 0} = Automations.run_rule(automation, rule_id)

      {:ok, _} = Devices.update_device(device, %{online: true})
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      assert {:ok, 1} = Automations.run_rule(automation, rule_id)
      assert_receive %{event: "automation_run", automation_id: automation_id, rule: rule}
      assert automation_id == automation.id
      assert rule["id"] == rule_id
      assert rule["action"] == "interrupt"

      assert {:error, :not_found} = Automations.run_rule(automation, "missing")
    end

    test "preview returns the next firings", %{} do
      assert {:ok, %{timezone: "Europe/Stockholm", occurrences: occurrences}} =
               Automations.preview(
                 %{
                   "source" => "clock",
                   "config" => %{"schedule" => %{"type" => "hourly", "minute" => 8}}
                 },
                 "Europe/Stockholm",
                 3,
                 ~U[2026-11-06 10:00:00Z]
               )

      assert occurrences == [
               ~U[2026-11-06 10:08:00Z],
               ~U[2026-11-06 11:08:00Z],
               ~U[2026-11-06 12:08:00Z]
             ]

      assert {:ok, %{timezone: "Etc/UTC", occurrences: occurrences}} =
               Automations.preview(
                 %{
                   source: "clock",
                   config: %{schedule: %{type: "interval", every_minutes: 30}}
                 },
                 "Bad/Zone",
                 "1000",
                 ~U[2026-11-06 10:00:00Z]
               )

      assert length(occurrences) == 50

      assert {:error, "when.source is required"} = Automations.preview(nil, nil, 10)
    end

    test "next_firing uses the channel or device timezone", %{
      organization: organization,
      playlist: playlist,
      device: device
    } do
      automation =
        automation_fixture(organization, playlist, %{
          "rules" => [
            rule(playlist, %{
              "when" => %{
                "source" => "clock",
                "config" => %{"schedule" => %{"type" => "times", "times" => ["12:00"]}}
              }
            })
          ]
        })

      now = ~U[2026-11-06 08:00:00Z]
      assert Automations.next_firing(automation, now) == ~U[2026-11-06 12:00:00Z]

      {:ok, automation} = Automations.set_assignments(automation, [device.id], [])
      assert Automations.next_firing(automation, now) == ~U[2026-11-06 11:00:00Z]

      disabled = %{automation | enabled: false}
      assert Automations.next_firing(disabled, now) == nil
    end

    test "warns about devices lacking capabilities", %{
      organization: organization,
      playlist: playlist,
      device: device
    } do
      automation = automation_fixture(organization, playlist)
      {:ok, automation} = Automations.set_assignments(automation, [device.id], [])
      [%{"id" => rule_id}] = automation.rules

      assert [
               %{rule_id: ^rule_id, missing: "automation_sources:clock"},
               %{rule_id: ^rule_id, missing: "automation_actions:interrupt"}
             ] = Automations.warnings(automation)

      {:ok, _} =
        Devices.update_device(device, %{
          info: %{
            "capabilities" => %{
              "automation_sources" => ["clock"],
              "automation_actions" => ["interrupt"]
            }
          }
        })

      assert Automations.warnings(automation) == []
    end

    test "to_json includes assignments, next firing and warnings", %{
      organization: organization,
      playlist: playlist,
      device: device
    } do
      channel = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      automation = automation_fixture(organization, playlist)
      {:ok, automation} = Automations.set_assignments(automation, [device.id], [channel.id])

      json = Automations.to_json(automation, ~U[2026-11-06 10:00:00Z])

      assert [%{id: device_id, name: _, online: false, timezone: "Europe/Stockholm"}] =
               json.devices

      assert device_id == device.id
      assert [%{id: channel_id, timezone: "Europe/London"}] = json.channels
      assert channel_id == channel.id
      assert json.next_firing == ~U[2026-11-06 10:08:00Z]
      assert length(json.warnings) == 2
      assert Jason.encode!(json)
    end

    test "channel_automations lists occurrences in the channel timezone", %{
      organization: organization,
      playlist: playlist
    } do
      channel = channel_fixture(%{organization_id: organization.id, timezone: "Asia/Kolkata"})
      automation = automation_fixture(organization, playlist)
      {:ok, _} = Automations.set_assignments(automation, [], [channel.id])

      disabled =
        automation_fixture(organization, playlist, %{"name" => "off", "enabled" => false})

      {:ok, _} = Automations.set_assignments(disabled, [], [channel.id])

      [entry, off] =
        Automations.channel_automations(
          channel,
          ~U[2026-11-06 10:00:00Z],
          ~U[2026-11-06 12:00:00Z]
        )

      assert entry.id == automation.id
      # :08 in Kolkata (+05:30) is :38 UTC
      assert Enum.map(entry.occurrences, & &1.at) == [
               ~U[2026-11-06 10:38:00Z],
               ~U[2026-11-06 11:38:00Z]
             ]

      assert off.occurrences == []
    end
  end
end
