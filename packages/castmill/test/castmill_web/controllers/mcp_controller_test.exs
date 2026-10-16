defmodule CastmillWeb.MCPControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures
  import Castmill.ChannelsFixtures

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
      content = result["structuredContent"]
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
      assert result["structuredContent"]["data"]["name"] == "Agent playlist"

      playlist_id = result["structuredContent"]["data"]["id"]
      assert Castmill.Resources.get_playlist(playlist_id).organization_id == organization.id

      result =
        call_tool(secret, "list_resources", %{"resource_type" => "playlists", "search" => "Agent"})

      refute result["isError"]
      assert result["structuredContent"]["count"] == 1

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
      assert hd(result["content"])["text"] =~ "403"

      assert %{data: [action]} = Agents.list_actions(organization.id, %{"agent_id" => guest.id})
      assert action.status == "error"
      assert action.http_status == 403

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
      Castmill.Quotas.add_quota_to_organization(other.id, :playlists, 10)
      foreign_playlist = playlist_fixture(%{organization_id: other.id})
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
      Castmill.Quotas.add_quota_to_organization(other.id, :playlists, 10)
      foreign_playlist = playlist_fixture(%{organization_id: other.id})
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
      assert Castmill.Resources.get_playlist_basic(foreign_playlist.id).organization_id == other.id
      assert organization.id != other.id
    end

    test "listing channel entries without date bounds uses defaults", %{
      organization: organization
    } do
      channel = channel_fixture(%{organization_id: organization.id})

      {:ok, _guest, guest_secret} =
        Agents.create_agent(organization.id, %{"name" => "Guest", "role" => "guest"})

      result =
        call_tool(guest_secret, "list_channel_entries", %{"channel_id" => channel.id})

      refute result["isError"]
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
end
