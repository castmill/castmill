defmodule CastmillWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :castmill

  # Enable CORS. Only allow requests from the domains listed in the network domains
  plug(CORSPlug, origin: &CastmillWeb.Endpoint.getAllowedOrigins/1, credentials: true)

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  #
  # SameSite=None with Secure is required in production so that cross-origin
  # requests from custom domains (e.g. signage.acmecorp.com → api.castmill.dev)
  # include the session cookie. In development and test we fall back to
  # SameSite=Lax over plain HTTP to avoid browsers dropping the cookie.
  @session_options [
    store: :cookie,
    key: "_castmill_key",
    signing_salt: "bqbGIetq",
    same_site: Application.compile_env(:castmill, :session_same_site, "Lax"),
    secure: Application.compile_env(:castmill, :session_secure, false)
  ]

  socket("/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options], check_origin: false]
  )

  # Socket used for real time communication with devices
  socket("/socket", CastmillWeb.DeviceSocket,
    websocket: [
      check_origin: false,
      connect_info: [:peer_data, :trace_context_headers, :x_headers, :uri]
    ]
  )

  # Socket used for real time communication with the user's browser (mostly observing devices)
  # This socket must use the same authentication as the user's browser (dashboard endpoints)
  socket("/user_socket", CastmillWeb.UserSocket,
    websocket: [
      # TODO: We may want to restrict the origins to the network domains
      # Example: origin: &CastmillWeb.Endpoint.getAllowedOrigins/0,
      check_origin: false,
      connect_info: [
        :peer_data,
        :trace_context_headers,
        :x_headers,
        :uri,
        session: @session_options
      ]
    ]
  )

  # Serve at "/" the static files from "priv/static" directory.
  #
  # You should set gzip to true if you are running phx.digest
  # when deploying your static files in production.
  plug(:serve_legacy_app_shell_file)

  plug(Plug.Static,
    at: "/",
    from: :castmill,
    gzip: false,
    only: CastmillWeb.static_paths()
  )

  defp serve_legacy_app_shell_file(conn, _opts) do
    case {conn.method, conn.request_path} do
      {"GET", "/legacy/sw.js"} ->
        send_legacy_app_shell_file(conn, "sw.js", true)

      {"GET", "/legacy/index.html"} ->
        send_legacy_app_shell_file(conn, "index.html", false)

      _ ->
        conn
    end
  end

  defp send_legacy_app_shell_file(conn, file_name, service_worker?) do
    path = Application.app_dir(:castmill, "priv/static/legacy/#{file_name}")

    if File.exists?(path) do
      conn =
        conn
        |> Plug.Conn.put_resp_content_type(MIME.from_path(path))
        |> Plug.Conn.put_resp_header("cache-control", "no-cache")

      conn =
        if service_worker? do
          Plug.Conn.put_resp_header(conn, "service-worker-allowed", "/legacy")
        else
          conn
        end

      conn
      |> Plug.Conn.send_file(200, path)
      |> Plug.Conn.halt()
    else
      conn
    end
  end

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    if Code.ensure_loaded?(Phoenix.LiveReloader) do
      socket("/phoenix/live_reload/socket", Phoenix.LiveReloader.Socket)
      plug(Phoenix.LiveReloader)
    end

    plug(Phoenix.CodeReloader)
    plug(Phoenix.Ecto.CheckRepoStatus, otp_app: :castmill)
  end

  plug(Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"
  )

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :json],
    pass: ["*/*"],
    # Cache the raw body for webhook signature verification (e.g., Stripe)
    body_reader: {CastmillWeb.Plugs.CacheBodyReader, :read_body, []},
    # Default limit for JSON and urlencoded bodies
    # Multipart parsing is handled in router pipelines for better control
    length: 8_000_000,
    json_decoder: Phoenix.json_library()
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)

  # Serve static files from external addon packages
  plug(CastmillWeb.Plugs.AddonStatic)

  plug(CastmillWeb.Router)

  # The endpoints used exclusively by the player apps
  @player_endpoints [
    "/registrations",
    "/legacy/log"
  ]

  def getAllowedOrigins(conn) do
    # If the request is for a player endpoint, we allow all origins.
    if Enum.member?(@player_endpoints, conn.request_path) do
      ["*"]
    else
      # Domains are stored without protocol, but CORS needs full origins.
      # Return both http:// and https:// variants for each domain.
      local_player_origins = Application.get_env(:castmill, :local_player_origins, [])

      network_origins =
        Castmill.Networks.list_network_domains()
        |> Enum.flat_map(fn domain ->
          ["http://" <> domain, "https://" <> domain]
        end)

      Enum.uniq(local_player_origins ++ network_origins)
    end
  end
end
