defmodule CastmillWeb.MCPControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures
  import Castmill.ChannelsFixtures
  import Castmill.DevicesFixtures
  import Castmill.TeamsFixtures

  alias Castmill.Agents
  alias Castmill.Organizations

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    Castmill.Quotas.add_quota_to_organization(organization.id, :playlists, 10)

    {:ok, agent, secret} =
      Agents.create_agent(organization.id, %{"name" => "Test agent", "role" => "editor"})

    %{organization: organization, agent: agent, secret: secret, network: network}
  end

  defp mcp(secret, payload) do
    build_conn()
    |> put_req_header("content-type", "application/json")
    |> put_req_header("accept", "application/json, text/event-stream")
    |> put_req_header("authorization", "Bearer " <> secret)
    |> post("/mcp", Jason.encode!(payload))
  end

  defp rpc(secret, method, params \\ %{}, id \\ 1) do
    mcp(secret, %{"jsonrpc" => "2.0", "id" => id, "method" => method, "params" => params})
  end

  defp call_tool(secret, name, arguments) do
    conn = rpc(secret, "tools/call", %{"name" => name, "arguments" => arguments})
    %{"result" => result} = json_response(conn, 200)
    result
  end

  defp decode(result) do
    refute Map.has_key?(result, "structuredContent")
    result |> Map.fetch!("content") |> hd() |> Map.fetch!("text") |> Jason.decode!()
  end

  # Inserted without a quota check: `quotas_organizations` is keyed by
  # `resource` only, so a second organization cannot get a playlists quota.
  defp foreign_playlist_fixture(organization) do
    %Castmill.Resources.Playlist{}
    |> Castmill.Resources.Playlist.changeset(%{
      name: "Foreign playlist",
      organization_id: organization.id
    })
    |> Castmill.Repo.insert!()
  end

  defp tool_names(secret) do
    %{"result" => %{"tools" => tools}} = secret |> rpc("tools/list") |> json_response(200)
    Map.new(tools, &{&1["name"], &1})
  end

  describe "authentication" do
    test "rejects missing or invalid credentials" do
      conn =
        build_conn()
        |> put_req_header("content-type", "application/json")
        |> post("/mcp", Jason.encode!(%{"jsonrpc" => "2.0", "id" => 1, "method" => "ping"}))

      assert json_response(conn, 401)["error"]
      assert [challenge] = get_resp_header(conn, "www-authenticate")
      assert challenge =~ "castmill-mcp"

      assert rpc("cmagt_invalid", "ping").status == 401
    end

    test "rejects dashboard session tokens", %{agent: agent} do
      token =
        Phoenix.Token.sign(
          CastmillWeb.Endpoint,
          CastmillWeb.Secrets.get_dashboard_user_token_salt(),
          agent.user_id
        )

      assert rpc(token, "ping").status == 401
    end

    test "rejects revoked credentials", %{agent: agent, secret: secret} do
      {:ok, _} = Agents.revoke_credentials(agent)
      assert rpc(secret, "ping").status == 401
    end

    test "agent credentials cannot be used on the dashboard API", %{
      organization: organization,
      secret: secret
    } do
      conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer " <> secret)
        |> get("/dashboard/organizations/#{organization.id}/playlists")

      assert conn.status == 401
    end

    test "returns 403 when the organization is blocked", %{
      organization: organization,
      secret: secret
    } do
      {:ok, _} = Organizations.block_organization(organization, "Testing")
      conn = rpc(secret, "ping")
      assert conn.status == 403
    end

    test "GET is not allowed" do
      conn = get(build_conn(), "/mcp")
      assert conn.status == 405
      assert get_resp_header(conn, "allow") == ["POST"]
    end
  end

  describe "protocol" do
    test "initialize negotiates the protocol version", %{secret: secret} do
      resp =
        secret
        |> rpc("initialize", %{
          "protocolVersion" => "2025-03-26",
          "capabilities" => %{},
          "clientInfo" => %{"name" => "test", "version" => "1"}
        })
        |> json_response(200)

      assert resp["id"] == 1
      assert resp["result"]["protocolVersion"] == "2025-03-26"
      assert resp["result"]["serverInfo"]["name"] == "castmill"
      assert resp["result"]["capabilities"]["tools"]
      assert resp["result"]["instructions"] =~ "get_context"

      resp =
        secret |> rpc("initialize", %{"protocolVersion" => "1999-01-01"}) |> json_response(200)

      assert resp["result"]["protocolVersion"] == "2025-06-18"
    end

    test "ping, notifications and unknown methods", %{secret: secret} do
      assert %{"result" => %{}} = secret |> rpc("ping") |> json_response(200)

      conn = mcp(secret, %{"jsonrpc" => "2.0", "method" => "notifications/initialized"})
      assert conn.status == 202
      assert conn.resp_body == ""

      assert %{"error" => %{"code" => -32601}} =
               secret |> rpc("does/not/exist") |> json_response(200)

      assert %{"error" => %{"code" => -32600}} =
               secret |> mcp(%{"foo" => "bar"}) |> json_response(200)
    end

    test "batches", %{secret: secret} do
      resp =
        secret
        |> mcp([
          %{"jsonrpc" => "2.0", "id" => 1, "method" => "ping"},
          %{"jsonrpc" => "2.0", "method" => "notifications/initialized"},
          %{"jsonrpc" => "2.0", "id" => "two", "method" => "tools/list"}
        ])
        |> json_response(200)

      assert [%{"id" => 1}, %{"id" => "two", "result" => %{"tools" => tools}}] = resp
      names = Enum.map(tools, & &1["name"])
      assert "get_context" in names
      assert "api_request" in names

      for tool <- tools do
        assert tool["description"]
        assert tool["inputSchema"]["type"] == "object"
      end
    end

    test "resources expose the agent guide", %{secret: secret} do
      %{"result" => %{"resources" => [resource]}} =
        secret |> rpc("resources/list") |> json_response(200)

      %{"result" => %{"contents" => [content]}} =
        secret |> rpc("resources/read", %{"uri" => resource["uri"]}) |> json_response(200)

      assert content["text"] =~ "Castmill agent guide"

      assert %{"error" => _} =
               secret
               |> rpc("resources/read", %{"uri" => "castmill://nope"})
               |> json_response(200)
    end

    test "unknown tools return an invalid params error", %{secret: secret} do
      assert %{"error" => %{"code" => -32602}} =
               secret
               |> rpc("tools/call", %{"name" => "nope", "arguments" => %{}})
               |> json_response(200)
    end
  end

  describe "tools" do
    test "get_context returns the agent organization and permissions", %{
      secret: secret,
      organization: organization,
      agent: agent
    } do
      result = call_tool(secret, "get_context", %{})

      refute result["isError"]
      content = decode(result)
      assert content["agent"]["id"] == agent.id
      assert content["organization"]["id"] == organization.id
      assert content["role"] == "editor"
    end

    test "creates and lists playlists through the dashboard API", %{
      secret: secret,
      organization: organization,
      agent: agent
    } do
      result =
        call_tool(secret, "create_resource", %{
          "resource_type" => "playlists",
          "attributes" => %{"name" => "Agent playlist"}
        })

      refute result["isError"]
      assert decode(result)["data"]["name"] == "Agent playlist"

      playlist_id = decode(result)["data"]["id"]
      assert Castmill.Resources.get_playlist(playlist_id).organization_id == organization.id

      result =
        call_tool(secret, "list_resources", %{"resource_type" => "playlists", "search" => "Agent"})

      refute result["isError"]
      assert %{"count" => 1, "data" => [listed]} = decode(result)
      refute Map.has_key?(listed, "items")
      assert listed["item_count"] == 0

      %{data: actions} = Agents.list_actions(organization.id, %{"agent_id" => agent.id})
      assert Enum.map(actions, & &1.tool) == ["list_resources", "create_resource"]
      assert Enum.all?(actions, &(&1.status == "success"))

      [list_action, create_action] = actions
      assert create_action.method == "POST"
      assert create_action.http_status == 201
      assert create_action.arguments["resource_type"] == "playlists"
      assert list_action.path == "/dashboard/organizations/#{organization.id}/playlists"
    end

    test "role permissions are enforced and failures are logged", %{
      organization: organization
    } do
      {:ok, guest, guest_secret} =
        Agents.create_agent(organization.id, %{"name" => "Guest agent", "role" => "guest"})

      result =
        call_tool(guest_secret, "create_resource", %{
          "resource_type" => "playlists",
          "attributes" => %{"name" => "Nope"}
        })

      assert result["isError"]
      text = hd(result["content"])["text"]
      assert text =~ "role 'guest' does not allow the 'create' action on 'playlists'"
      assert text =~ "Allowed resource types for this tool: none"

      assert %{data: [action]} = Agents.list_actions(organization.id, %{"agent_id" => guest.id})
      assert action.status == "error"
      assert action.http_status == nil

      refute call_tool(guest_secret, "list_resources", %{"resource_type" => "playlists"})[
               "isError"
             ]
    end

    test "playlist item changes require update access to an owned playlist", %{
      organization: organization
    } do
      playlist = playlist_fixture(%{organization_id: organization.id})

      {:ok, _guest, guest_secret} =
        Agents.create_agent(organization.id, %{"name" => "Guest", "role" => "guest"})

      denied =
        call_tool(guest_secret, "add_playlist_item", %{
          "playlist_id" => playlist.id,
          "widget_id" => 1,
          "duration" => 10
        })

      assert denied["isError"]
      assert hd(denied["content"])["text"] =~ "403"

      other = organization_fixture()
      foreign_playlist = foreign_playlist_fixture(other)

      {:ok, _admin, admin_secret} =
        Agents.create_agent(organization.id, %{"name" => "Admin agent", "role" => "admin"})

      denied =
        call_tool(admin_secret, "add_playlist_item", %{
          "playlist_id" => foreign_playlist.id,
          "widget_id" => 1,
          "duration" => 10
        })

      assert denied["isError"]
      assert hd(denied["content"])["text"] =~ "403"

      denied =
        call_tool(admin_secret, "api_request", %{
          "method" => "POST",
          "path" => "/playlists/#{foreign_playlist.id}/items",
          "body" => %{}
        })

      assert denied["isError"]
      assert hd(denied["content"])["text"] =~ "403"
    end

    test "resource IDs must belong to the organization in the dashboard URL", %{
      organization: organization
    } do
      other = organization_fixture()
      foreign_playlist = foreign_playlist_fixture(other)

      {:ok, _admin, admin_secret} =
        Agents.create_agent(organization.id, %{"name" => "Admin agent", "role" => "admin"})

      result =
        call_tool(admin_secret, "get_resource", %{
          "resource_type" => "playlists",
          "id" => foreign_playlist.id
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"

      result =
        call_tool(admin_secret, "api_request", %{
          "method" => "PUT",
          "path" => "/playlists/#{foreign_playlist.id}",
          "body" => %{"update" => %{"name" => "Changed"}}
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"

      assert Castmill.Resources.get_playlist_basic(foreign_playlist.id).organization_id ==
               other.id

      assert organization.id != other.id
    end

    test "listing channel entries without date bounds uses defaults", %{
      organization: organization
    } do
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})

      {:ok, _guest, guest_secret} =
        Agents.create_agent(organization.id, %{"name" => "Guest", "role" => "guest"})

      playlist = playlist_fixture(%{organization_id: organization.id})

      entry =
        channel_entry_fixture(channel.id, %{
          playlist_id: playlist.id,
          start: ~U[2020-01-01 00:00:00Z],
          end: ~U[2020-01-01 05:00:00Z]
        })

      result =
        call_tool(guest_secret, "list_channel_entries", %{"channel_id" => channel.id})

      refute result["isError"]
      assert [%{"id" => entry_id}] = Jason.decode!(hd(result["content"])["text"])
      assert entry_id == entry.id
    end

    test "devices and teams of other organizations cannot be deleted", %{
      organization: organization
    } do
      other = organization_fixture()
      Castmill.Quotas.add_quota_to_organization(other.id, :devices, 10)
      Castmill.Quotas.add_quota_to_organization(other.id, :teams, 10)
      foreign_device = device_fixture(%{organization_id: other.id})
      foreign_team = team_fixture(%{organization_id: other.id})

      {:ok, _admin, admin_secret} =
        Agents.create_agent(organization.id, %{"name" => "Admin agent", "role" => "admin"})

      result =
        call_tool(admin_secret, "delete_resource", %{
          "resource_type" => "devices",
          "id" => foreign_device.id
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"
      assert Castmill.Devices.get_device(foreign_device.id)

      result =
        call_tool(admin_secret, "api_request", %{
          "method" => "DELETE",
          "path" => "/teams/#{foreign_team.id}"
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"
      assert Castmill.Teams.get_team(foreign_team.id)
    end

    test "channel entries cannot reference foreign playlists or entries", %{
      organization: organization
    } do
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      playlist = playlist_fixture(%{organization_id: organization.id})

      entry =
        channel_entry_fixture(channel.id, %{
          playlist_id: playlist.id,
          start: ~U[2020-01-01 00:00:00Z],
          end: ~U[2020-01-01 05:00:00Z]
        })

      other = organization_fixture()
      foreign_playlist = foreign_playlist_fixture(other)
      foreign_channel = channel_fixture(%{organization_id: other.id, timezone: "UTC"})

      foreign_entry =
        channel_entry_fixture(foreign_channel.id, %{
          playlist_id: foreign_playlist.id,
          start: ~U[2020-01-01 00:00:00Z],
          end: ~U[2020-01-01 05:00:00Z]
        })

      {:ok, _admin, admin_secret} =
        Agents.create_agent(organization.id, %{"name" => "Admin agent", "role" => "admin"})

      result =
        call_tool(admin_secret, "add_channel_entry", %{
          "channel_id" => channel.id,
          "playlist_id" => foreign_playlist.id,
          "start" => DateTime.to_unix(~U[2020-01-02 00:00:00Z], :millisecond),
          "end" => DateTime.to_unix(~U[2020-01-02 05:00:00Z], :millisecond)
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"

      result =
        call_tool(admin_secret, "api_request", %{
          "method" => "PATCH",
          "path" => "/channels/#{channel.id}/entries/#{entry.id}",
          "body" => %{"playlist_id" => foreign_playlist.id}
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"
      assert Castmill.Resources.get_channel_entry(entry.id).playlist_id == playlist.id

      result =
        call_tool(admin_secret, "delete_channel_entry", %{
          "channel_id" => channel.id,
          "entry_id" => foreign_entry.id
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"

      result =
        call_tool(admin_secret, "api_request", %{
          "method" => "PATCH",
          "path" => "/channels/#{channel.id}/entries/#{foreign_entry.id}",
          "body" => %{"repeat_weekly_until" => nil}
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"
      assert Castmill.Resources.get_channel_entry(foreign_entry.id)

      refute call_tool(admin_secret, "delete_channel_entry", %{
               "channel_id" => channel.id,
               "entry_id" => entry.id
             })["isError"]

      refute Castmill.Resources.get_channel_entry(entry.id)
    end

    test "foreign channels cannot be assigned to devices", %{organization: organization} do
      Castmill.Quotas.add_quota_to_organization(organization.id, :devices, 10)
      device = device_fixture(%{organization_id: organization.id})
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})

      foreign_channel =
        channel_fixture(%{organization_id: organization_fixture().id, timezone: "UTC"})

      {:ok, _admin, admin_secret} =
        Agents.create_agent(organization.id, %{"name" => "Admin agent", "role" => "admin"})

      result =
        call_tool(admin_secret, "add_device_channel", %{
          "device_id" => device.id,
          "channel_id" => foreign_channel.id
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"

      result =
        call_tool(admin_secret, "api_request", %{
          "method" => "POST",
          "path" => "/devices/#{device.id}/channels",
          "body" => %{"channel_id" => foreign_channel.id}
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "403"
      assert Castmill.Devices.list_channels(device.id) == []

      refute call_tool(admin_secret, "add_device_channel", %{
               "device_id" => device.id,
               "channel_id" => channel.id
             })["isError"]
    end

    test "api_request keeps DELETE bodies and rejects non-string methods", %{
      secret: secret,
      agent: agent
    } do
      assert {:ok, "DELETE", _path, opts} =
               CastmillWeb.MCP.Tools.build_request(
                 "api_request",
                 %{"method" => "DELETE", "path" => "/playlists/1", "body" => %{"a" => 1}},
                 agent
               )

      assert opts[:body] == %{"a" => 1}

      assert {:ok, "GET", _path, opts} =
               CastmillWeb.MCP.Tools.build_request(
                 "api_request",
                 %{"method" => "get", "path" => "/playlists", "body" => %{"a" => 1}},
                 agent
               )

      refute Keyword.has_key?(opts, :body)

      result = call_tool(secret, "api_request", %{"method" => %{}, "path" => "/playlists"})
      assert result["isError"]
      assert hd(result["content"])["text"] =~ "Invalid 'method'"

      result = call_tool(secret, "api_request", %{"method" => 1, "path" => "/playlists"})
      assert result["isError"]
    end

    test "secrets in arguments are never stored in the activity log", %{
      secret: secret,
      agent: agent,
      organization: organization
    } do
      call_tool(secret, "api_request", %{
        "method" => "PUT",
        "path" => "/widget-integrations/1/credentials",
        "body" => %{"credentials" => %{"api_key" => "very-secret"}, "note" => "kept"}
      })

      assert %{data: [action]} = Agents.list_actions(organization.id, %{"agent_id" => agent.id})
      assert action.arguments["body"]["credentials"] == "[REDACTED]"
      assert action.arguments["body"]["note"] == "kept"
      refute Jason.encode!(action.arguments) =~ "very-secret"
      refute (action.error || "") =~ "very-secret"
    end

    test "malformed query parameters are tool errors", %{secret: secret} do
      result =
        call_tool(secret, "api_request", %{
          "method" => "GET",
          "path" => "/playlists",
          "query" => %{"ids" => [%{"a" => [1, %{"b" => [[]]}]}]}
        })

      assert is_map(result)

      result =
        call_tool(secret, "list_resources", %{"resource_type" => "playlists", "search" => [%{}]})

      assert is_map(result)
    end

    test "argument validation errors are tool errors", %{secret: secret} do
      result = call_tool(secret, "create_resource", %{"resource_type" => "users"})
      assert result["isError"]

      result = call_tool(secret, "get_resource", %{"resource_type" => "playlists"})
      assert result["isError"]
    end

    test "api_request is restricted to the agent organization", %{
      secret: secret,
      organization: organization
    } do
      other = organization_fixture()

      result =
        call_tool(secret, "api_request", %{
          "method" => "GET",
          "path" => "/organizations/#{other.id}/playlists"
        })

      assert result["isError"]
      assert hd(result["content"])["text"] =~ "own organization"

      result = call_tool(secret, "api_request", %{"method" => "GET", "path" => "/agents"})
      assert result["isError"]

      result =
        call_tool(secret, "api_request", %{
          "method" => "GET",
          "path" => "/organizations/#{organization.id}/agent-actions"
        })

      assert result["isError"]

      result = call_tool(secret, "api_request", %{"method" => "GET", "path" => "/../users"})
      assert result["isError"]

      result =
        call_tool(secret, "api_request", %{"method" => "GET", "path" => "/tags?x=1"})

      assert result["isError"]

      result = call_tool(secret, "api_request", %{"method" => "GET", "path" => "/playlists"})
      refute result["isError"]
    end
  end

  describe "role-aware tools" do
    test "tools/list only advertises resource types allowed by the role", %{
      secret: secret,
      organization: organization
    } do
      tools = tool_names(secret)

      assert tools["create_resource"]["inputSchema"]["properties"]["resource_type"]["enum"] ==
               ["layouts", "playlists"]

      update_types =
        tools["update_resource"]["inputSchema"]["properties"]["resource_type"]["enum"]

      assert "channels" in update_types

      {:ok, _guest, guest_secret} =
        Agents.create_agent(organization.id, %{"name" => "Guest", "role" => "guest"})

      guest_tools = tool_names(guest_secret)
      assert Map.has_key?(guest_tools, "list_resources")
      refute Map.has_key?(guest_tools, "create_resource")
      refute Map.has_key?(guest_tools, "update_resource")
      refute Map.has_key?(guest_tools, "delete_resource")

      {:ok, _admin, admin_secret} =
        Agents.create_agent(organization.id, %{"name" => "Admin", "role" => "admin"})

      assert tool_names(admin_secret)["create_resource"]["inputSchema"]["properties"][
               "resource_type"
             ]["enum"] == ["channels", "layouts", "playlists", "teams"]
    end

    test "role changes apply to the next request", %{
      secret: secret,
      agent: agent,
      organization: organization
    } do
      {:ok, _} = Organizations.set_user_role(organization.id, agent.user_id, :admin)

      assert "channels" in tool_names(secret)["create_resource"]["inputSchema"]["properties"][
               "resource_type"
             ]["enum"]
    end

    test "disallowed resource types name the allowed ones without dispatching", %{
      secret: secret,
      organization: organization,
      agent: agent
    } do
      result =
        call_tool(secret, "create_resource", %{
          "resource_type" => "channels",
          "attributes" => %{"name" => "Lobby", "timezone" => "Europe/Stockholm"}
        })

      assert result["isError"]
      text = hd(result["content"])["text"]
      assert text =~ "role 'editor' does not allow the 'create' action on 'channels'"
      assert text =~ "Allowed resource types for this tool: layouts, playlists"

      assert %{data: [action]} = Agents.list_actions(organization.id, %{"agent_id" => agent.id})
      assert action.method == nil
    end

    test "layouts are available to roles that the matrix allows", %{secret: secret} do
      result = call_tool(secret, "list_resources", %{"resource_type" => "layouts"})

      refute result["isError"]
      assert %{"count" => count, "data" => layouts} = decode(result)
      assert is_integer(count) and is_list(layouts)
    end

    test "403 errors do not blame the role for missing ids", %{secret: secret} do
      result = call_tool(secret, "get_resource", %{"resource_type" => "playlists", "id" => 0})

      assert result["isError"]
      text = hd(result["content"])["text"]
      assert text =~ "403"
      assert text =~ "does not exist in this organization"
    end
  end

  describe "result shaping" do
    test "channel lists omit associations that are not loaded", %{
      secret: secret,
      organization: organization
    } do
      channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"})

      result = call_tool(secret, "list_resources", %{"resource_type" => "channels"})

      assert %{"data" => [channel]} = decode(result)
      assert channel["name"] == "Hangar 42"

      for key <- ["entries", "organization_name", "network_name"] do
        refute Map.has_key?(channel, key)
      end
    end

    test "list_widgets returns a summary and get_widget the full widget", %{secret: secret} do
      widget =
        widget_fixture(%{
          name: "Agent widget",
          description: "For agents",
          options_schema: %{"title" => "string"}
        })

      result = call_tool(secret, "list_widgets", %{"search" => "Agent widget"})

      assert %{"data" => [summary]} = decode(result)
      assert summary["id"] == widget.id
      assert summary["description"] == "For agents"

      assert Map.keys(summary) |> Enum.sort() ==
               Enum.sort(["id", "slug", "name", "description", "aspect_ratio"])

      full = decode(call_tool(secret, "get_widget", %{"widget_id" => widget.id}))
      assert full["data"]["options_schema"] == %{"title" => "string"}
      assert Map.has_key?(full["data"], "template")
    end

    test "editing and moving playlist items keeps the playlist consistent", %{
      secret: secret,
      organization: organization
    } do
      playlist = playlist_fixture(%{organization_id: organization.id})

      widget =
        widget_fixture(%{
          options_schema: %{"title" => %{"type" => "string"}},
          data_schema: %{"foo" => %{"type" => "number"}}
        })

      add = fn ->
        call_tool(secret, "add_playlist_item", %{
          "playlist_id" => playlist.id,
          "widget_id" => widget.id,
          "duration" => 1000,
          "options" => %{"title" => "Hello"}
        })
        |> decode()
        |> get_in(["data", "id"])
      end

      item_ids = fn ->
        call_tool(secret, "get_resource", %{"resource_type" => "playlists", "id" => playlist.id})
        |> decode()
        |> get_in(["data", "items"])
        |> Enum.map(& &1["id"])
      end

      first = add.()

      updated =
        call_tool(secret, "update_playlist_item", %{
          "playlist_id" => playlist.id,
          "item_id" => first,
          "attributes" => %{"duration" => 2000}
        })
        |> decode()

      assert updated["data"]["duration"] == 2000
      assert is_binary(updated["data"]["widget_config_id"])

      refute call_tool(secret, "update_playlist_item_config", %{
               "playlist_id" => playlist.id,
               "item_id" => first,
               "data" => %{"foo" => 1}
             })["isError"]

      config = Castmill.Widgets.get_widget_config(playlist.id, first)
      assert config.options == %{"title" => "Hello"}
      assert config.data == %{"foo" => 1}

      # Moving the only item to the beginning must not unlink it.
      refute call_tool(secret, "move_playlist_item", %{
               "playlist_id" => playlist.id,
               "item_id" => first
             })["isError"]

      assert item_ids.() == [first]

      second = add.()
      assert item_ids.() == [second, first]

      # Without a target the item goes to the beginning.
      refute call_tool(secret, "move_playlist_item", %{
               "playlist_id" => playlist.id,
               "item_id" => first
             })["isError"]

      assert item_ids.() == [first, second]

      refute call_tool(secret, "move_playlist_item", %{
               "playlist_id" => playlist.id,
               "item_id" => first,
               "target_id" => second
             })["isError"]

      assert item_ids.() == [second, first]

      listed =
        call_tool(secret, "list_resources", %{"resource_type" => "playlists"})
        |> decode()
        |> Map.fetch!("data")
        |> Enum.find(&(&1["id"] == playlist.id))

      assert listed["item_count"] == 2
    end

    test "playlist items embed a compact widget", %{
      secret: secret,
      organization: organization
    } do
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = widget_fixture(%{name: "Compact widget"})

      added =
        call_tool(secret, "add_playlist_item", %{
          "playlist_id" => playlist.id,
          "widget_id" => widget.id,
          "duration" => 1000
        })

      refute added["isError"]

      result =
        call_tool(secret, "get_resource", %{"resource_type" => "playlists", "id" => playlist.id})

      assert %{"data" => %{"items" => [item]}} = decode(result)
      assert item["widget"] == %{"id" => widget.id, "slug" => widget.slug, "name" => widget.name}
      assert Map.has_key?(item, "config")
    end
  end
end
