defmodule CastmillWeb.AutomationControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures
  import Castmill.ChannelsFixtures
  import Castmill.DevicesFixtures

  alias Castmill.Automations
  alias Castmill.Organizations

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    playlist = playlist_fixture(%{organization_id: organization.id, name: "Spring offer"})
    device = device_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

    users =
      for role <- [:admin, :member, :guest] do
        user = user_fixture(%{network_id: network.id})
        {:ok, _} = Organizations.set_user_role(organization.id, user.id, role)
        {role, user}
      end
      |> Map.new()

    conn = put_req_header(conn, "accept", "application/json")

    %{
      conn: conn,
      network: network,
      organization: organization,
      playlist: playlist,
      device: device,
      users: users
    }
  end

  defp as(conn, user), do: assign(conn, :current_user, user)

  defp api_path(organization, suffix \\ ""),
    do: "/dashboard/organizations/#{organization.id}/automations#{suffix}"

  defp rule(playlist) do
    %{
      "when" => %{
        "source" => "clock",
        "condition" => "at",
        "config" => %{"schedule" => %{"type" => "hourly", "minute" => 8}}
      },
      "then" => %{
        "action" => "interrupt",
        "config" => %{"playlist_id" => playlist.id, "start" => "after_current_item"}
      },
      "cooldown_seconds" => 60
    }
  end

  defp create!(organization, playlist, name \\ "Spring") do
    {:ok, automation} =
      Automations.create_automation(organization.id, %{
        "name" => name,
        "rules" => [rule(playlist)]
      })

    automation
  end

  describe "CRUD" do
    test "admins manage automations", %{
      conn: conn,
      organization: organization,
      playlist: playlist,
      users: users
    } do
      conn =
        conn
        |> as(users.admin)
        |> post(api_path(organization), %{
          "automation" => %{"name" => "Spring", "rules" => [rule(playlist)]}
        })

      assert %{"data" => data} = json_response(conn, 201)
      assert data["name"] == "Spring"
      assert data["enabled"] == true
      assert [%{"id" => rule_id, "cooldown_seconds" => 60}] = data["rules"]
      assert data["devices"] == []
      assert data["channels"] == []
      assert data["warnings"] == []
      assert is_binary(data["next_firing"])

      index = build_conn() |> as(users.admin) |> get(api_path(organization), %{"search" => "spr"})
      assert %{"data" => [%{"id" => id}], "count" => 1} = json_response(index, 200)
      assert id == data["id"]

      show = build_conn() |> as(users.admin) |> get(api_path(organization, "/#{id}"))
      assert json_response(show, 200)["data"]["rules"] |> hd() |> Map.get("id") == rule_id

      update =
        build_conn()
        |> as(users.admin)
        |> patch(api_path(organization, "/#{id}"), %{"automation" => %{"enabled" => false}})

      assert json_response(update, 200)["data"]["enabled"] == false
      assert json_response(update, 200)["data"]["next_firing"] == nil

      delete = build_conn() |> as(users.admin) |> delete(api_path(organization, "/#{id}"))
      assert response(delete, 204)

      missing = build_conn() |> as(users.admin) |> get(api_path(organization, "/#{id}"))
      assert json_response(missing, 404)
    end

    test "returns validation and quota errors", %{
      conn: conn,
      organization: organization,
      playlist: playlist,
      users: users
    } do
      conn =
        conn
        |> as(users.admin)
        |> post(api_path(organization), %{
          "automation" => %{
            "name" => "Bad",
            "rules" => [put_in(rule(playlist), ["then", "config", "plays"], 0)]
          }
        })

      assert %{"errors" => %{"rules" => [message]}} = json_response(conn, 422)
      assert message =~ "plays"

      Castmill.Quotas.add_quota_to_organization(organization.id, :automations, 0)

      conn =
        build_conn()
        |> as(users.admin)
        |> post(api_path(organization), %{"name" => "Over"})

      assert %{"errors" => %{"quota" => _}} = json_response(conn, 403)
    end

    test "members can update but not create or delete; guests can only read", %{
      conn: conn,
      organization: organization,
      playlist: playlist,
      users: users
    } do
      automation = create!(organization, playlist)

      conn = conn |> as(users.member) |> post(api_path(organization), %{"name" => "X"})
      assert conn.status == 403

      conn =
        build_conn()
        |> as(users.member)
        |> patch(api_path(organization, "/#{automation.id}"), %{"name" => "Renamed"})

      assert json_response(conn, 200)["data"]["name"] == "Renamed"

      conn =
        build_conn() |> as(users.member) |> delete(api_path(organization, "/#{automation.id}"))

      assert conn.status == 403

      conn = build_conn() |> as(users.guest) |> get(api_path(organization))
      assert %{"count" => 1} = json_response(conn, 200)

      conn =
        build_conn()
        |> as(users.guest)
        |> patch(api_path(organization, "/#{automation.id}"), %{"name" => "Nope"})

      assert conn.status == 403
    end

    test "automations of other organizations are not reachable", %{
      conn: conn,
      network: network,
      organization: organization,
      playlist: playlist,
      users: users
    } do
      automation = create!(organization, playlist)
      other = organization_fixture(%{network_id: network.id, name: "Foreign org"})
      {:ok, _} = Organizations.set_user_role(other.id, users.admin.id, :admin)

      conn = conn |> as(users.admin) |> get(api_path(other, "/#{automation.id}"))
      assert json_response(conn, 404)
    end
  end

  describe "registry and preview" do
    test "lists sources and actions", %{conn: conn, organization: organization, users: users} do
      conn = conn |> as(users.guest) |> get(api_path(organization, "/registry"))

      assert %{
               "sources" => [%{"type" => "clock", "conditions" => [%{"kind" => "event"}]}],
               "actions" => [%{"type" => "interrupt", "supports" => ["event", "state"]}]
             } = json_response(conn, 200)["data"]
    end

    test "previews the next firings", %{conn: conn, organization: organization, users: users} do
      conn =
        conn
        |> as(users.member)
        |> post(api_path(organization, "/preview"), %{
          "when" => %{
            "source" => "clock",
            "config" => %{"schedule" => %{"type" => "hourly", "minute" => 8}}
          },
          "timezone" => "Europe/Stockholm",
          "count" => 5
        })

      assert %{"timezone" => "Europe/Stockholm", "occurrences" => occurrences} =
               json_response(conn, 200)["data"]

      assert length(occurrences) == 5

      conn =
        build_conn()
        |> as(users.member)
        |> post(api_path(organization, "/preview"), %{
          "when" => %{"source" => "clock", "config" => %{"schedule" => %{"type" => "x"}}}
        })

      assert %{"errors" => %{"when" => [_]}} = json_response(conn, 422)
    end
  end

  describe "assignments and run now" do
    test "assigns devices and channels and runs a rule", %{
      conn: conn,
      organization: organization,
      playlist: playlist,
      device: device,
      users: users
    } do
      automation = create!(organization, playlist)
      channel = channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      conn =
        conn
        |> as(users.admin)
        |> put(api_path(organization, "/#{automation.id}/assignments"), %{
          "devices" => [device.id],
          "channels" => [channel.id]
        })

      assert %{"devices" => [%{"id" => device_id}], "channels" => [%{"id" => channel_id}]} =
               json_response(conn, 200)["data"]

      assert device_id == device.id
      assert channel_id == channel.id

      {:ok, _} = Castmill.Devices.update_device(device, %{online: true})
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")
      [%{"id" => rule_id}] = automation.rules

      conn =
        build_conn()
        |> as(users.member)
        |> post(api_path(organization, "/#{automation.id}/rules/#{rule_id}/run"))

      assert %{"devices" => 1} = json_response(conn, 200)["data"]
      assert_receive %{event: "automation_run", rule: %{"id" => ^rule_id}}

      {:ok, _} = Automations.update_automation(automation, %{"enabled" => false})

      conn =
        build_conn()
        |> as(users.admin)
        |> post(api_path(organization, "/#{automation.id}/rules/#{rule_id}/run"))

      assert %{"errors" => %{"automation" => ["Cannot run a disabled automation"]}} =
               json_response(conn, 422)

      refute_receive %{event: "automation_run"}

      {:ok, _} = Automations.update_automation(automation, %{"enabled" => true})

      conn =
        build_conn()
        |> as(users.admin)
        |> post(api_path(organization, "/#{automation.id}/rules/missing/run"))

      assert json_response(conn, 404)

      conn =
        build_conn()
        |> as(users.guest)
        |> post(api_path(organization, "/#{automation.id}/rules/#{rule_id}/run"))

      assert conn.status == 403
    end

    test "rejects assignments to another organization", %{
      conn: conn,
      network: network,
      organization: organization,
      playlist: playlist,
      users: users
    } do
      automation = create!(organization, playlist)
      other = organization_fixture(%{network_id: network.id, name: "Foreign org"})
      channel = channel_fixture(%{organization_id: other.id, timezone: "Europe/Stockholm"})

      conn =
        conn
        |> as(users.admin)
        |> put(api_path(organization, "/#{automation.id}/assignments"), %{
          "channels" => [channel.id]
        })

      assert %{"errors" => %{"assignments" => _}} = json_response(conn, 422)
    end

    test "lists channel automations with occurrences", %{
      conn: conn,
      organization: organization,
      playlist: playlist,
      users: users
    } do
      automation = create!(organization, playlist)
      channel = channel_fixture(%{organization_id: organization.id, timezone: "Etc/UTC"})
      {:ok, _} = Automations.set_assignments(automation, [], [channel.id])

      conn =
        conn
        |> as(users.guest)
        |> get(
          "/dashboard/organizations/#{organization.id}/channels/#{channel.id}/automations",
          %{"from" => "2026-11-06T10:00:00Z", "to" => "2026-11-06T12:00:00Z"}
        )

      assert [%{"id" => id, "occurrences" => occurrences}] = json_response(conn, 200)["data"]
      assert id == automation.id

      assert Enum.map(occurrences, & &1["at"]) == [
               "2026-11-06T10:08:00Z",
               "2026-11-06T11:08:00Z"
             ]
    end
  end

  describe "devices" do
    test "devices fetch their payload and referenced playlists", %{
      organization: organization,
      playlist: playlist
    } do
      token = "device-token-#{System.unique_integer([:positive])}"

      device =
        device_fixture(%{
          organization_id: organization.id,
          timezone: "Europe/Stockholm",
          token: token
        })

      automation = create!(organization, playlist)
      {:ok, _} = Automations.set_assignments(automation, [device.id], [])

      device_conn = fn ->
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer " <> token)
      end

      conn = get(device_conn.(), "/devices/#{device.id}/automations")

      assert %{"automations" => [%{"rules" => [rule]}], "valid_until" => _} =
               json_response(conn, 200)["data"]

      assert rule["action_config"]["playlist_id"] == playlist.id
      assert length(rule["source_payload"]["occurrences"]) == 14 * 24

      conn = get(device_conn.(), "/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 200)["id"] == playlist.id
    end

    test "dashboard users can see the effective payload of a device", %{
      conn: conn,
      organization: organization,
      playlist: playlist,
      device: device,
      users: users
    } do
      automation = create!(organization, playlist)
      {:ok, _} = Automations.set_assignments(automation, [device.id], [])

      conn = conn |> as(users.guest) |> get("/dashboard/devices/#{device.id}/automations")
      assert %{"automations" => [%{"name" => "Spring"}]} = json_response(conn, 200)["data"]
    end

    test "deleting a referenced playlist is blocked", %{
      conn: conn,
      organization: organization,
      playlist: playlist,
      users: users
    } do
      automation = create!(organization, playlist)

      conn =
        conn
        |> as(users.admin)
        |> delete("/dashboard/organizations/#{organization.id}/playlists/#{playlist.id}")

      assert %{"errors" => %{"automations" => [%{"id" => id, "name" => "Spring"}]}} =
               json_response(conn, 409)

      assert id == automation.id
    end
  end
end
