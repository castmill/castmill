defmodule CastmillWeb.Router do
  use CastmillWeb, :router

  import CastmillWeb.Admin.UserAuth

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:fetch_live_flash)
    plug(:put_root_layout, {CastmillWeb.Layouts, :root})
    plug(:put_layout, {CastmillWeb.Layouts, :app})
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
    plug(:fetch_current_user)
  end

  pipeline :device do
    plug(:accepts, ["html", "json"])
    plug(:fetch_session)
    plug(:put_root_layout, {CastmillWeb.Layouts, :device})
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
  end

  pipeline :api do
    plug(:accepts, ["json"])
    plug(:authenticate_with_token)
  end

  scope "/", CastmillWeb do
    pipe_through([:browser, :redirect_if_user_is_authenticated])

    live_session :redirect_if_user_is_authenticated,
      layout: {CastmillWeb.Layouts, :login},
      on_mount: [{CastmillWeb.Admin.UserAuth, :redirect_if_user_is_authenticated}] do
      live("/admin/login", Live.Admin.Login, :new)
      live("/admin/reset_password", Live.Admin.ForgotPassword, :new)
      live("/admin/reset_password/:token", UserResetPasswordLive, :edit)

      # TODO: Implement password reset.
      # live "/admin/reset_password/:token", UserResetPasswordLive, :edit
    end

    post("/admin/login", AdminSessionController, :create)
  end

  scope "/", CastmillWeb do
    pipe_through(:browser)

    # Routes for the Admin Tool
    scope "/admin", Live do
      pipe_through([:require_authenticated_user])

      live_session :admin,
        layout: {CastmillWeb.Layouts, :admin},
        on_mount: [{CastmillWeb.Admin.UserAuth, :ensure_authenticated}] do
        live("/", Admin, :index)

        # Networks
        live("/:resource", Admin.Resources, :index)

        # Note: Only networks can be created at the root level.
        live("/:resource/new", Admin.Resources, :new)

        # Generic edit for all resources
        live("/:resource/:id/edit", Admin.Resources, :edit)

        # Networks
        live("/networks/:id", Admin.NetworkShow, :show)
        live("/networks/:id/:resource", Admin.NetworkShow, :show)
        live("/networks/:id/show/edit", Admin.NetworkShow, :edit)
        live("/networks/:id/:resource/new", Admin.NetworkShow, :new)

        # Organizations
        live("/organizations/:id/", Admin.OrganizationShow, :show)
        live("/organizations/:id/:resource", Admin.OrganizationShow, :show)
        live("/organizations/:id/show/edit", Admin.OrganizationShow, :edit)
        live("/organizations/:id/:resource/new", Admin.OrganizationShow, :new)

        # Fallback route for all other resources
        live("/:resource/:id", Admin.Resources, :show)
        live("/:resource/:id/:tab/new", Admin.Resources, :new)
      end
    end

    delete("/admin/logout", AdminSessionController, :delete)
  end

  scope "/", CastmillWeb do
    pipe_through(:device)

    # Route for starting the Device
    get("/", DeviceController, :home)
  end

  pipeline :register do
    plug(:accepts, ["json"])
  end

  scope "/registrations", CastmillWeb do
    pipe_through(:register)

    post("/", DeviceController, :start_registration)
  end

  scope "/devices", CastmillWeb do
    pipe_through(:device)

    get("/:id", DeviceController, :show)
    get("/:id/calendars", DeviceController, :get_calendars)
    get("/:id/playlists/:playlist_id", DeviceController, :get_playlist)

    put("/:id/calendars/:calendar_id", DeviceController, :add_calendar)
    delete("/:id/calendars/:calendar_id", DeviceController, :remove_calendar)

    # This route can be used by a device in order to post
    # its current status to the server. It can be called in
    # regular intervals or triggered by a user.
    post("/:id/info", DeviceController, :info)

    # post "/", DeviceController, :create
    # get "/", DeviceController, :index
    # get "/:id", DeviceController, :show
    # put "/:id", DeviceController, :update
    # delete "/:id", DeviceController, :delete
  end

  # Allows starting a signup process for Passkeys
  pipeline :dashboard do
    plug(:fetch_session)
    plug(:accepts, ["json"])
    plug(CORSPlug, origin: CastmillWeb.Envs.get_dashboard_uri(), credentials: true)
    plug(:put_secure_browser_headers)
  end

  scope "/signups", CastmillWeb do
    pipe_through(:dashboard)

    post("/", SignUpController, :create)
    post("/:id/users", SignUpController, :create_user)
  end

  scope "/sessions", CastmillWeb do
    pipe_through(:dashboard)

    get("/", SessionController, :get)
    post("/", SessionController, :login_user)
    delete("/", SessionController, :logout_user)
    get("/challenges", SessionController, :create_challenge)
  end

  scope "/dashboard", CastmillWeb do
    pipe_through([:dashboard, :authenticate_user])
    get("/addons", AddonsController, :index)
    get("/users/:user_id/organizations", OrganizationController, :list_users_organizations)

    get("/organizations/:organization_id/devices", OrganizationController, :list_devices)
    post("/organizations/:organization_id/devices", OrganizationController, :register_device)

    get(
      "/organizations/:organization_id/devices/:device_id",
      OrganizationController,
      :show_device
    )

    put(
      "/organizations/:organization_id/devices/:device_id",
      OrganizationController,
      :update_device
    )

    delete(
      "/organizations/:organization_id/devices/:device_id",
      OrganizationController,
      :delete_device
    )
  end

  # Other scopes may use custom stacks.
  scope "/api", CastmillWeb do
    pipe_through([:api])

    resources "/networks", NetworkController, except: [:new, :edit] do
      pipe_through(:load_network)

      resources("/organizations", OrganizationController, except: [:new, :edit])
      resources("/users", UserController, except: [:new, :edit])
    end

    resources "/organizations", OrganizationController, except: [:new, :edit] do
      pipe_through(:load_organization)

      resources "/users", UserController, except: [:new, :edit] do
      end

      resources "/teams", UserController, except: [:new, :edit] do
      end

      post("/devices/", DeviceController, :create)

      resources "/:resources", ResourceController, except: [:new, :edit] do
      end

      resources "/medias/:media_id/files", FileController, except: [:new, :edit] do
      end

      post("/calendars/:calendar_id/entries", ResourceController, :add_calendar_entry)
      put("/calendars/:calendar_id/entries/:id", ResourceController, :update_calendar_entry)
      delete("/calendars/:calendar_id/entries/:id", ResourceController, :delete_calendar_entry)

      post("/playlists/:playlist_id/items", PlaylistController, :add_item)
      delete("/playlists/:playlist_id/items/:id", PlaylistController, :delete_item)
    end

    resources("/users", UserController, except: [:new, :edit, :index])
    resources("/access_tokens", AccessTokenController, except: [:new, :edit])

    # These routes are here to avoid some warnings, but not sure they are needed.
    get("/medias/:media_id/files/:id", FileController, :show)
    get("/playlists/:playlist_id/items/:id", PlaylistController, :show_item)
  end

  # Proxy routes for development medias
  scope "/", CastmillWeb do
    pipe_through(:browser)

    # Other routes
    get("/proxy", ProxyController, :index)
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:castmill, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through(:browser)

      live_dashboard("/dashboard", metrics: CastmillWeb.Telemetry)
      forward("/mailbox", Plug.Swoosh.MailboxPreview)
    end
  end

  defp authenticate_user(conn, opts) do
    # First, attempt to retrieve the user from the session
    case get_session(conn, :user) do
      nil ->
        # If there's no user in the session, proceed with token authentication
        authenticate_with_token(conn, opts)

      user ->
        IO.puts("User found in session")
        # If there is a user in the session, use it directly
        assign_user(conn, user)
    end
  end

  defp authenticate_with_token(conn, _opts) do
    conn
    |> get_bearer_token()
    |> case do
      {:ok, token} ->
        Castmill.Accounts.get_user_by_access_token(token, Utils.RemoteIp.get(conn))
        |> case do
          {:ok, user} -> assign_user(conn, user)
          {:error, message} -> respond_with_error(conn, message)
        end

      {:error, message} ->
        respond_with_error(conn, message)
    end
  end

  defp get_bearer_token(conn) do
    auth_header = List.first(get_req_header(conn, "authorization"))

    case String.split(auth_header || "", " ") do
      ["Bearer", token] -> {:ok, token}
      [] -> {:error, "No token provided"}
      _ -> {:error, "Invalid token format"}
    end
  end

  defp assign_user(conn, user) do
    conn
    |> assign(:current_user, user)
    |> assign(:network, user.network)
  end

  defp respond_with_error(conn, message) do
    conn
    |> put_status(:unauthorized)
    |> Phoenix.Controller.json(%{error: message})
    |> halt()
  end

  defp load_network(conn, _params) do
    case Castmill.Networks.get_network(conn.params["network_id"]) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Network not found"})
        |> halt

      network ->
        conn
        |> assign(:network, network)
    end
  end

  defp load_organization(conn, _params) do
    case Castmill.Organizations.get_organization(conn.params["organization_id"]) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Organization not found"})
        |> halt

      network ->
        conn
        |> assign(:network, network)
    end
  end
end
