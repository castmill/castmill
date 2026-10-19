defmodule CastmillWeb.MCP.Tools do
  @moduledoc """
  Tools exposed by the Castmill MCP server.

  Tools do not access the data layer directly. Each tool is translated into a
  request against the existing dashboard API (`/dashboard/...`), which is then
  executed as the agent user by `CastmillWeb.MCP.Dispatcher`. This way agents
  go through exactly the same routing, validation and authorization code as
  regular users of the dashboard.

  Requests are always scoped to the agent's organization. Agent management
  endpoints are never reachable from the MCP server.
  """

  alias CastmillWeb.MCP.Dispatcher

  @list_types ["medias", "playlists", "channels", "devices", "teams", "layouts"]
  @show_types ["medias", "playlists", "channels", "layouts"]
  @create_types %{
    "playlists" => "playlist",
    "channels" => "channel",
    "teams" => "team",
    "layouts" => "layout"
  }
  @update_types ["medias", "playlists", "channels", "devices", "layouts"]
  @delete_types ["medias", "playlists", "channels", "devices", "teams", "layouts"]
  @device_commands [
    "restart_app",
    "restart_device",
    "refresh",
    "clear_cache",
    "update_app",
    "update_firmware"
  ]
  @http_methods ["GET", "POST", "PUT", "PATCH", "DELETE"]

  # Organization sub-paths that agents can never reach through `api_request`.
  @denied_org_segments ["agents", "agent-actions"]

  # Dashboard paths outside of the organization scope that agents may use.
  # Access to the actual device / widget config is still verified by the
  # corresponding controllers.
  @global_prefixes ["devices", "widget-configs"]

  @max_text_length 100_000

  @id_schema %{
    "oneOf" => [%{"type" => "integer"}, %{"type" => "string"}],
    "description" => "Resource identifier"
  }

  @doc """
  Returns the list of tools in the MCP `tools/list` format.
  """
  def list do
    Enum.map(definitions(), fn tool ->
      Map.take(tool, ["name", "title", "description", "inputSchema", "annotations"])
    end)
  end

  @doc """
  Returns the names of all the tools.
  """
  def names, do: Enum.map(definitions(), & &1["name"])

  @doc """
  Calls a tool.

  `ctx` must contain the authenticated `:agent` (with its user preloaded) and
  may contain the originating `:conn`.

  Returns `{:ok, result, log}` where `result` is an MCP `CallToolResult` map
  and `log` describes the dispatched request, or `{:error, :unknown_tool}`.
  """
  def call(name, args, ctx) when is_binary(name) do
    if name in names() do
      args = if is_map(args), do: args, else: %{}

      case build_request(name, args, ctx.agent) do
        {:ok, method, path, opts} ->
          response =
            Dispatcher.request(ctx.agent, method, path, Keyword.put(opts, :conn, ctx[:conn]))

          body = transform(name, response.status, response.body, ctx)

          {:ok, to_result(response.status, body),
           %{method: method, path: path, http_status: response.status}}

        {:error, message} ->
          {:ok, error_result(message), %{method: nil, path: nil, http_status: nil}}
      end
    else
      {:error, :unknown_tool}
    end
  end

  def call(_name, _args, _ctx), do: {:error, :unknown_tool}

  # ---------------------------------------------------------------------------
  # Request builders
  # ---------------------------------------------------------------------------

  @doc false
  def build_request(name, args, agent)

  def build_request("get_context", _args, agent) do
    {:ok, "GET", org_path(agent, "/permissions"), []}
  end

  def build_request("list_resources", args, agent) do
    with {:ok, type} <- enum_arg(args, "resource_type", @list_types) do
      query =
        args
        |> Map.take(["page", "page_size", "search", "key", "direction", "filters", "team_id"])
        |> Map.put_new("page", 1)
        |> Map.put_new("page_size", 20)

      {:ok, "GET", org_path(agent, "/#{type}"), [query: query]}
    end
  end

  def build_request("get_resource", args, agent) do
    with {:ok, type} <- enum_arg(args, "resource_type", @show_types),
         {:ok, id} <- id_arg(args, "id") do
      {:ok, "GET", org_path(agent, "/#{type}/#{id}"), []}
    end
  end

  def build_request("create_resource", args, agent) do
    with {:ok, type} <- enum_arg(args, "resource_type", Map.keys(@create_types)),
         {:ok, attributes} <- map_arg(args, "attributes") do
      {:ok, "POST", org_path(agent, "/#{type}"),
       [body: %{Map.fetch!(@create_types, type) => attributes}]}
    end
  end

  def build_request("update_resource", args, agent) do
    with {:ok, type} <- enum_arg(args, "resource_type", @update_types),
         {:ok, id} <- id_arg(args, "id"),
         {:ok, attributes} <- map_arg(args, "attributes") do
      {:ok, "PUT", org_path(agent, "/#{type}/#{id}"), [body: %{"update" => attributes}]}
    end
  end

  def build_request("delete_resource", args, agent) do
    with {:ok, type} <- enum_arg(args, "resource_type", @delete_types),
         {:ok, id} <- id_arg(args, "id") do
      {:ok, "DELETE", org_path(agent, "/#{type}/#{id}"), []}
    end
  end

  def build_request("list_widgets", args, agent) do
    query =
      args
      |> Map.take(["page", "page_size", "search"])
      |> Map.put_new("page", 1)
      |> Map.put_new("page_size", 50)

    {:ok, "GET", org_path(agent, "/widgets"), [query: query]}
  end

  def build_request("get_widget", args, agent) do
    with {:ok, id} <- id_arg(args, "widget_id") do
      {:ok, "GET", org_path(agent, "/widgets/#{id}"), []}
    end
  end

  def build_request("add_playlist_item", args, agent) do
    with {:ok, playlist_id} <- id_arg(args, "playlist_id"),
         {:ok, widget_id} <- id_arg(args, "widget_id"),
         {:ok, duration} <- integer_arg(args, "duration"),
         {:ok, prev_item_id} <- optional_id_arg(args, "prev_item_id") do
      body =
        %{
          "widget_id" => widget_id,
          "duration" => duration,
          "offset" => Map.get(args, "offset", 0),
          "options" => Map.get(args, "options") || %{}
        }
        |> maybe_put("prev_item_id", prev_item_id)

      {:ok, "POST", org_path(agent, "/playlists/#{playlist_id}/items"), [body: body]}
    end
  end

  def build_request("update_playlist_item", args, agent) do
    with {:ok, playlist_id} <- id_arg(args, "playlist_id"),
         {:ok, item_id} <- id_arg(args, "item_id"),
         {:ok, attributes} <- map_arg(args, "attributes") do
      {:ok, "PATCH", org_path(agent, "/playlists/#{playlist_id}/items/#{item_id}"),
       [body: %{"options" => attributes}]}
    end
  end

  def build_request("update_playlist_item_config", args, agent) do
    with {:ok, playlist_id} <- id_arg(args, "playlist_id"),
         {:ok, item_id} <- id_arg(args, "item_id") do
      config =
        %{}
        |> maybe_put("options", Map.get(args, "options"))
        |> maybe_put("data", Map.get(args, "data"))

      {:ok, "PATCH", org_path(agent, "/playlists/#{playlist_id}/items/#{item_id}/config"),
       [body: %{"config" => config}]}
    end
  end

  def build_request("move_playlist_item", args, agent) do
    with {:ok, playlist_id} <- id_arg(args, "playlist_id"),
         {:ok, item_id} <- id_arg(args, "item_id"),
         {:ok, target_id} <- optional_id_arg(args, "target_id") do
      {:ok, "PUT", org_path(agent, "/playlists/#{playlist_id}/items/#{item_id}"),
       [body: %{"target_id" => target_id}]}
    end
  end

  def build_request("remove_playlist_item", args, agent) do
    with {:ok, playlist_id} <- id_arg(args, "playlist_id"),
         {:ok, item_id} <- id_arg(args, "item_id") do
      {:ok, "DELETE", org_path(agent, "/playlists/#{playlist_id}/items/#{item_id}"), []}
    end
  end

  def build_request("list_channel_entries", args, agent) do
    with {:ok, channel_id} <- id_arg(args, "channel_id") do
      query =
        args
        |> Map.take(["start_date", "end_date"])
        |> Map.put_new("start_date", 0)
        |> Map.put_new("end_date", 253_402_300_799_000)

      {:ok, "GET", org_path(agent, "/channels/#{channel_id}/entries"), [query: query]}
    end
  end

  def build_request("add_channel_entry", args, agent) do
    with {:ok, channel_id} <- id_arg(args, "channel_id"),
         {:ok, playlist_id} <- id_arg(args, "playlist_id"),
         {:ok, start_ms} <- integer_arg(args, "start"),
         {:ok, end_ms} <- integer_arg(args, "end") do
      body =
        %{"playlist_id" => playlist_id, "start" => start_ms, "end" => end_ms}
        |> maybe_put("repeat_weekly_until", Map.get(args, "repeat_weekly_until"))

      {:ok, "POST", org_path(agent, "/channels/#{channel_id}/entries"), [body: body]}
    end
  end

  def build_request("delete_channel_entry", args, agent) do
    with {:ok, channel_id} <- id_arg(args, "channel_id"),
         {:ok, entry_id} <- id_arg(args, "entry_id") do
      {:ok, "DELETE", org_path(agent, "/channels/#{channel_id}/entries/#{entry_id}"), []}
    end
  end

  def build_request("list_device_channels", args, _agent) do
    with {:ok, device_id} <- id_arg(args, "device_id") do
      {:ok, "GET", "/dashboard/devices/#{device_id}/channels", []}
    end
  end

  def build_request("add_device_channel", args, _agent) do
    with {:ok, device_id} <- id_arg(args, "device_id"),
         {:ok, channel_id} <- id_arg(args, "channel_id") do
      {:ok, "POST", "/dashboard/devices/#{device_id}/channels",
       [body: %{"channel_id" => channel_id}]}
    end
  end

  def build_request("remove_device_channel", args, _agent) do
    with {:ok, device_id} <- id_arg(args, "device_id"),
         {:ok, channel_id} <- id_arg(args, "channel_id") do
      {:ok, "DELETE", "/dashboard/devices/#{device_id}/channels/#{channel_id}", []}
    end
  end

  def build_request("send_device_command", args, _agent) do
    with {:ok, device_id} <- id_arg(args, "device_id"),
         {:ok, command} <- enum_arg(args, "command", @device_commands) do
      {:ok, "POST", "/dashboard/devices/#{device_id}/commands", [body: %{"command" => command}]}
    end
  end

  def build_request("api_request", args, agent) do
    with {:ok, method} <- method_arg(args),
         {:ok, path} <- resolve_api_path(Map.get(args, "path"), agent),
         {:ok, query} <- optional_map_arg(args, "query"),
         {:ok, body} <- optional_map_arg(args, "body") do
      opts = [query: query]
      opts = if method == "GET", do: opts, else: Keyword.put(opts, :body, body)
      {:ok, method, path, opts}
    end
  end

  def build_request(_name, _args, _agent), do: {:error, "Unknown tool"}

  @doc """
  Resolves and validates the `path` argument of the `api_request` tool.

  Paths are relative to the agent organization (`/playlists/1` is resolved to
  `/dashboard/organizations/<org>/playlists/1`), except for the device and
  widget config endpoints (`/devices/...`, `/widget-configs/...`).
  """
  def resolve_api_path(path, agent) when is_binary(path) do
    org_id = agent.organization_id

    with {:ok, segments} <- split_path(path) do
      segments =
        case segments do
          ["dashboard" | rest] -> rest
          other -> other
        end

      case segments do
        ["organizations", ^org_id | rest] ->
          org_scoped_path(agent, rest)

        ["organizations" | _] ->
          {:error, "Agents can only access their own organization (#{org_id})."}

        [prefix | _] = rest when prefix in @global_prefixes ->
          {:ok, "/dashboard/" <> Enum.join(rest, "/")}

        rest ->
          org_scoped_path(agent, rest)
      end
    end
  end

  def resolve_api_path(_path, _agent), do: {:error, "The 'path' argument is required."}

  defp org_scoped_path(_agent, [segment | _]) when segment in @denied_org_segments do
    {:error, "Agents are not allowed to manage agents."}
  end

  defp org_scoped_path(agent, segments) do
    suffix = if segments == [], do: "", else: "/" <> Enum.join(segments, "/")
    {:ok, org_path(agent, suffix)}
  end

  defp split_path(path) do
    trimmed = String.trim(path)

    if String.starts_with?(trimmed, "/") do
      segments = String.split(trimmed, "/", trim: true)

      if Enum.all?(segments, &valid_segment?/1) do
        {:ok, segments}
      else
        {:error,
         "Invalid path. Use only letters, digits, '-' and '_' in path segments " <>
           "and pass query parameters with the 'query' argument."}
      end
    else
      {:error, "The path must start with '/'."}
    end
  end

  defp valid_segment?(segment), do: Regex.match?(~r/\A[A-Za-z0-9_-]+\z/, segment)

  # ---------------------------------------------------------------------------
  # Results
  # ---------------------------------------------------------------------------

  defp transform("get_context", status, body, ctx) when status in 200..299 and is_map(body) do
    agent = ctx.agent
    organization = Castmill.Organizations.get_organization(agent.organization_id)

    Map.merge(body, %{
      "agent" => %{
        "id" => agent.id,
        "name" => agent.name,
        "description" => agent.description
      },
      "organization" => %{
        "id" => agent.organization_id,
        "name" => organization && organization.name
      },
      "guide" => "castmill://docs/agent-guide"
    })
  end

  defp transform(_name, _status, body, _ctx), do: body

  defp to_result(status, body) when status in 200..299 do
    text =
      case body do
        nil -> Jason.encode!(%{"status" => status, "ok" => true})
        body -> encode_text(body)
      end

    result = %{"content" => [%{"type" => "text", "text" => text}], "isError" => false}

    if is_map(body) and byte_size(text) <= @max_text_length do
      Map.put(result, "structuredContent", body)
    else
      result
    end
  end

  defp to_result(status, body) do
    detail =
      case body do
        nil -> ""
        body -> " " <> encode_text(body)
      end

    error_result("Request failed with HTTP status #{status} (#{status_hint(status)}).#{detail}")
  end

  defp error_result(message) do
    %{"content" => [%{"type" => "text", "text" => message}], "isError" => true}
  end

  defp status_hint(400), do: "bad request, check the arguments"
  defp status_hint(401), do: "not authenticated"
  defp status_hint(403), do: "the agent role does not allow this action"
  defp status_hint(404), do: "not found"
  defp status_hint(409), do: "conflict"
  defp status_hint(413), do: "payload too large"
  defp status_hint(422), do: "validation failed"
  defp status_hint(status) when status >= 500, do: "server error"
  defp status_hint(_status), do: "error"

  defp encode_text(body) when is_binary(body), do: truncate(body)

  defp encode_text(body) do
    case Jason.encode(body) do
      {:ok, json} -> truncate(json)
      {:error, _} -> truncate(inspect(body))
    end
  end

  defp truncate(text) when byte_size(text) > @max_text_length do
    prefix =
      case :unicode.characters_to_binary(binary_part(text, 0, @max_text_length)) do
        {:incomplete, valid, _rest} -> valid
        {:error, valid, _rest} -> valid
        valid -> valid
      end

    prefix <> "\n[truncated, use pagination (page/page_size) or narrower queries]"
  end

  defp truncate(text), do: text

  # ---------------------------------------------------------------------------
  # Argument helpers
  # ---------------------------------------------------------------------------

  defp org_path(agent, suffix), do: "/dashboard/organizations/#{agent.organization_id}#{suffix}"

  defp enum_arg(args, key, allowed) do
    value = Map.get(args, key)

    if value in allowed do
      {:ok, value}
    else
      {:error, "Invalid '#{key}'. Allowed values: #{Enum.join(allowed, ", ")}."}
    end
  end

  defp id_arg(args, key) do
    case Map.get(args, key) do
      id when is_integer(id) and id >= 0 ->
        {:ok, Integer.to_string(id)}

      id when is_binary(id) and id != "" ->
        if valid_segment?(id), do: {:ok, id}, else: {:error, "Invalid '#{key}'."}

      nil ->
        {:error, "The '#{key}' argument is required."}

      _ ->
        {:error, "Invalid '#{key}'."}
    end
  end

  defp optional_id_arg(args, key) do
    case Map.get(args, key) do
      nil -> {:ok, nil}
      _ -> id_arg(args, key)
    end
  end

  defp integer_arg(args, key) do
    case Map.get(args, key) do
      value when is_integer(value) ->
        {:ok, value}

      value when is_binary(value) ->
        case Integer.parse(value) do
          {int, ""} -> {:ok, int}
          _ -> {:error, "The '#{key}' argument must be an integer."}
        end

      nil ->
        {:error, "The '#{key}' argument is required."}

      _ ->
        {:error, "The '#{key}' argument must be an integer."}
    end
  end

  defp map_arg(args, key) do
    case Map.get(args, key) do
      value when is_map(value) -> {:ok, value}
      nil -> {:error, "The '#{key}' argument is required."}
      _ -> {:error, "The '#{key}' argument must be an object."}
    end
  end

  defp optional_map_arg(args, key) do
    case Map.get(args, key) do
      nil -> {:ok, %{}}
      value when is_map(value) -> {:ok, value}
      _ -> {:error, "The '#{key}' argument must be an object."}
    end
  end

  defp method_arg(args) do
    case Map.get(args, "method", "GET") do
      method when is_binary(method) ->
        method = String.upcase(method)

        if method in @http_methods do
          {:ok, method}
        else
          invalid_method_error()
        end

      _ ->
        invalid_method_error()
    end
  end

  defp invalid_method_error do
    {:error, "Invalid 'method'. Allowed values: #{Enum.join(@http_methods, ", ")}."}
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  # ---------------------------------------------------------------------------
  # Definitions
  # ---------------------------------------------------------------------------

  defp read_only, do: %{"readOnlyHint" => true, "openWorldHint" => false}

  defp write(destructive) do
    %{"readOnlyHint" => false, "destructiveHint" => destructive, "openWorldHint" => false}
  end

  defp object(properties, required \\ []) do
    %{"type" => "object", "properties" => properties, "required" => required}
  end

  defp enum(values, description) do
    %{"type" => "string", "enum" => values, "description" => description}
  end

  defp pagination do
    %{
      "page" => %{"type" => "integer", "minimum" => 1, "description" => "Page number (1-based)"},
      "page_size" => %{
        "type" => "integer",
        "minimum" => 1,
        "maximum" => 100,
        "description" => "Items per page (max 100)"
      },
      "search" => %{"type" => "string", "description" => "Case-insensitive search by name"}
    }
  end

  @doc false
  def definitions do
    [
      %{
        "name" => "get_context",
        "title" => "Get agent context",
        "description" =>
          "Returns the agent identity, its organization, its role and the permission matrix " <>
            "(allowed actions per resource type). Call this first to know what you can do.",
        "inputSchema" => object(%{}),
        "annotations" => read_only()
      },
      %{
        "name" => "list_resources",
        "title" => "List resources",
        "description" =>
          "Lists resources of the organization (paginated). Returns {data: [...], count}. " <>
            "Devices include their online status.",
        "inputSchema" =>
          object(
            Map.merge(pagination(), %{
              "resource_type" => enum(@list_types, "Type of resource to list"),
              "key" => %{"type" => "string", "description" => "Field to sort by, e.g. name"},
              "direction" => enum(["ascending", "descending"], "Sort direction"),
              "filters" => %{
                "type" => "string",
                "description" => "Comma separated filters, e.g. 'online:true'"
              },
              "team_id" => %{"type" => "integer", "description" => "Only resources of a team"}
            }),
            ["resource_type"]
          ),
        "annotations" => read_only()
      },
      %{
        "name" => "get_resource",
        "title" => "Get resource",
        "description" =>
          "Gets a single media, playlist, channel or layout by id. Use list_resources with " <>
            "'search' to find devices and teams.",
        "inputSchema" =>
          object(
            %{"resource_type" => enum(@show_types, "Type of resource"), "id" => @id_schema},
            ["resource_type", "id"]
          ),
        "annotations" => read_only()
      },
      %{
        "name" => "create_resource",
        "title" => "Create resource",
        "description" =>
          "Creates a playlist, channel, team or layout from 'attributes', e.g. " <>
            "{\"name\": \"Lobby\"} for a playlist or {\"name\": \"Lobby\", \"timezone\": " <>
            "\"Europe/Stockholm\"} for a channel. Medias must be uploaded from the dashboard.",
        "inputSchema" =>
          object(
            %{
              "resource_type" => enum(Map.keys(@create_types), "Type of resource to create"),
              "attributes" => %{"type" => "object", "description" => "Resource attributes"}
            },
            ["resource_type", "attributes"]
          ),
        "annotations" => write(false)
      },
      %{
        "name" => "update_resource",
        "title" => "Update resource",
        "description" =>
          "Updates fields of a resource, e.g. {name} of a playlist or media, " <>
            "{name, description} of a device or {name, timezone, default_playlist_id} of a channel.",
        "inputSchema" =>
          object(
            %{
              "resource_type" => enum(@update_types, "Type of resource to update"),
              "id" => @id_schema,
              "attributes" => %{"type" => "object", "description" => "Fields to update"}
            },
            ["resource_type", "id", "attributes"]
          ),
        "annotations" => write(false)
      },
      %{
        "name" => "delete_resource",
        "title" => "Delete resource",
        "description" =>
          "Permanently deletes a resource. Deleting a device unregisters it. This cannot be undone.",
        "inputSchema" =>
          object(
            %{"resource_type" => enum(@delete_types, "Type of resource"), "id" => @id_schema},
            ["resource_type", "id"]
          ),
        "annotations" => write(true)
      },
      %{
        "name" => "list_widgets",
        "title" => "List widgets",
        "description" =>
          "Lists the widgets (image, video, text, web page, layouts, integrations, ...) that " <>
            "can be added to playlists.",
        "inputSchema" => object(pagination()),
        "annotations" => read_only()
      },
      %{
        "name" => "get_widget",
        "title" => "Get widget",
        "description" => "Gets a widget, including its options and data schemas.",
        "inputSchema" => object(%{"widget_id" => @id_schema}, ["widget_id"]),
        "annotations" => read_only()
      },
      %{
        "name" => "add_playlist_item",
        "title" => "Add playlist item",
        "description" =>
          "Adds a widget instance to a playlist. 'options' must follow the widget options " <>
            "schema (see get_widget). The item is inserted after 'prev_item_id', or at the " <>
            "beginning of the playlist when omitted.",
        "inputSchema" =>
          object(
            %{
              "playlist_id" => @id_schema,
              "widget_id" => @id_schema,
              "duration" => %{
                "type" => "integer",
                "minimum" => 0,
                "description" => "Duration in milliseconds"
              },
              "offset" => %{
                "type" => "integer",
                "description" => "Start offset in milliseconds (default 0)"
              },
              "options" => %{"type" => "object", "description" => "Widget options"},
              "prev_item_id" => @id_schema
            },
            ["playlist_id", "widget_id", "duration"]
          ),
        "annotations" => write(false)
      },
      %{
        "name" => "update_playlist_item",
        "title" => "Update playlist item",
        "description" =>
          "Updates playlist item attributes such as {duration, offset} or transitions.",
        "inputSchema" =>
          object(
            %{
              "playlist_id" => @id_schema,
              "item_id" => @id_schema,
              "attributes" => %{"type" => "object", "description" => "Item attributes"}
            },
            ["playlist_id", "item_id", "attributes"]
          ),
        "annotations" => write(false)
      },
      %{
        "name" => "update_playlist_item_config",
        "title" => "Update playlist item widget config",
        "description" => "Updates the widget options and/or data of a playlist item.",
        "inputSchema" =>
          object(
            %{
              "playlist_id" => @id_schema,
              "item_id" => @id_schema,
              "options" => %{"type" => "object", "description" => "Widget options"},
              "data" => %{"type" => "object", "description" => "Widget data"}
            },
            ["playlist_id", "item_id"]
          ),
        "annotations" => write(false)
      },
      %{
        "name" => "move_playlist_item",
        "title" => "Move playlist item",
        "description" =>
          "Moves an item after 'target_id'. Omit 'target_id' (or use null) to move it to the end.",
        "inputSchema" =>
          object(
            %{
              "playlist_id" => @id_schema,
              "item_id" => @id_schema,
              "target_id" => %{
                "oneOf" => [%{"type" => "integer"}, %{"type" => "string"}, %{"type" => "null"}]
              }
            },
            ["playlist_id", "item_id"]
          ),
        "annotations" => write(false)
      },
      %{
        "name" => "remove_playlist_item",
        "title" => "Remove playlist item",
        "description" => "Removes an item from a playlist.",
        "inputSchema" =>
          object(%{"playlist_id" => @id_schema, "item_id" => @id_schema}, [
            "playlist_id",
            "item_id"
          ]),
        "annotations" => write(true)
      },
      %{
        "name" => "list_channel_entries",
        "title" => "List channel schedule entries",
        "description" =>
          "Lists the scheduled playlist entries of a channel. Dates are Unix timestamps in " <>
            "milliseconds.",
        "inputSchema" =>
          object(
            %{
              "channel_id" => @id_schema,
              "start_date" => %{"type" => "integer", "description" => "From (ms)"},
              "end_date" => %{"type" => "integer", "description" => "To (ms)"}
            },
            ["channel_id"]
          ),
        "annotations" => read_only()
      },
      %{
        "name" => "add_channel_entry",
        "title" => "Schedule playlist in channel",
        "description" =>
          "Schedules a playlist in a channel between 'start' and 'end' (Unix timestamps in " <>
            "milliseconds, within the same week in the channel timezone). Use " <>
            "'repeat_weekly_until' (YYYY-MM-DD) to repeat it every week.",
        "inputSchema" =>
          object(
            %{
              "channel_id" => @id_schema,
              "playlist_id" => @id_schema,
              "start" => %{"type" => "integer"},
              "end" => %{"type" => "integer"},
              "repeat_weekly_until" => %{"type" => "string", "format" => "date"}
            },
            ["channel_id", "playlist_id", "start", "end"]
          ),
        "annotations" => write(false)
      },
      %{
        "name" => "delete_channel_entry",
        "title" => "Delete channel schedule entry",
        "description" => "Deletes a scheduled entry from a channel.",
        "inputSchema" =>
          object(%{"channel_id" => @id_schema, "entry_id" => @id_schema}, [
            "channel_id",
            "entry_id"
          ]),
        "annotations" => write(true)
      },
      %{
        "name" => "list_device_channels",
        "title" => "List device channels",
        "description" => "Lists the channels assigned to a device.",
        "inputSchema" => object(%{"device_id" => @id_schema}, ["device_id"]),
        "annotations" => read_only()
      },
      %{
        "name" => "add_device_channel",
        "title" => "Assign channel to device",
        "description" => "Assigns a channel to a device so that the device plays it.",
        "inputSchema" =>
          object(%{"device_id" => @id_schema, "channel_id" => @id_schema}, [
            "device_id",
            "channel_id"
          ]),
        "annotations" => write(false)
      },
      %{
        "name" => "remove_device_channel",
        "title" => "Remove channel from device",
        "description" => "Removes a channel from a device.",
        "inputSchema" =>
          object(%{"device_id" => @id_schema, "channel_id" => @id_schema}, [
            "device_id",
            "channel_id"
          ]),
        "annotations" => write(true)
      },
      %{
        "name" => "send_device_command",
        "title" => "Send device command",
        "description" =>
          "Sends a maintenance command to a device (e.g. refresh, restart_app). Commands " <>
            "affect what is shown on screen; use them only when needed.",
        "inputSchema" =>
          object(
            %{"device_id" => @id_schema, "command" => enum(@device_commands, "Command")},
            ["device_id", "command"]
          ),
        "annotations" => write(true)
      },
      %{
        "name" => "api_request",
        "title" => "Castmill API request",
        "description" =>
          "Calls any Castmill dashboard API endpoint with the agent permissions, for " <>
            "operations not covered by the other tools (tags, teams, usage, device events, " <>
            "telemetry, schedules, ...). 'path' is relative to the agent organization, e.g. " <>
            "'/tags', '/usage', '/teams/1/members'; device and widget config endpoints start " <>
            "with '/devices/' or '/widget-configs/'. See the castmill://docs/agent-guide " <>
            "resource for the endpoint catalog.",
        "inputSchema" =>
          object(
            %{
              "method" => enum(@http_methods, "HTTP method (default GET)"),
              "path" => %{"type" => "string", "description" => "API path, e.g. /tags"},
              "query" => %{"type" => "object", "description" => "Query string parameters"},
              "body" => %{"type" => "object", "description" => "JSON body"}
            },
            ["path"]
          ),
        "annotations" => %{"readOnlyHint" => false, "openWorldHint" => false}
      }
    ]
  end
end
