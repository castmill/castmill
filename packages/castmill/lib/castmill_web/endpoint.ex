defmodule CastmillWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :castmill

  # Enable CORS. Only allow requests from the domains listed in the network domains
  plug(CORSPlug, origin: &CastmillWeb.Endpoint.getAllowedOrigins/0, credentials: true)

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  @session_options [
    store: :cookie,
    key: "_castmill_key",
    signing_salt: "bqbGIetq",
    same_site: "Lax"
  ]

  socket("/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options], check_origin: false]
  )

  # Socket used for real time communication with devices
  socket("/socket", CastmillWeb.DeviceSocket,
    websocket: [
      connect_info: [:peer_data, :trace_context_headers, :x_headers, :uri, check_origin: false]
    ]
  )

  # Socket used for real time communication with the user's browser (mostly observing devices)
  # This socket must use the same authentication as the user's browser (dashboard endpoints)
  socket("/user_socket", CastmillWeb.UserSocket,
    websocket: [
      connect_info: [
        :peer_data,
        :trace_context_headers,
        :x_headers,
        :uri,
        session: @session_options,
        # TODO: We may want to restrict the origins to the network domains
        check_origin: false
      ]
    ]
  )

  # Serve at "/" the static files from "priv/static" directory.
  #
  # You should set gzip to true if you are running phx.digest
  # when deploying your static files in production.
  plug(Plug.Static,
    at: "/",
    from: :castmill,
    gzip: false,
    only: CastmillWeb.static_paths()
  )

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    socket("/phoenix/live_reload/socket", Phoenix.LiveReloader.Socket)
    plug(Phoenix.LiveReloader)
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
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)
  plug(CastmillWeb.Router)

  # TODO: we must cache the allowed origins at least for a few minutes or this
  # will be a huge performance bottleneck. The cache must use ETS to be shared.
  def getAllowedOrigins() do
    ["https://localhost" | Castmill.Networks.list_network_domains()]
  end

end
