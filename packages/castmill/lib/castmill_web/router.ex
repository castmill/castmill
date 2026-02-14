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

        live(
          "/networks/:id/integrations/:integration_id/configure",
          Admin.NetworkShow,
          :configure_integration
        )

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

  # Public route for serving widget assets (icons, fonts, images, etc.)
  scope "/widget_assets", CastmillWeb do
    get("/:slug/*path", WidgetAssetsController, :show)
  end

  # This is most likely not used anymore as registrations go through the dashboard.
  scope "/registrations", CastmillWeb do
    pipe_through(:register)

    post("/", DeviceController, :start_registration)
  end

  # Public webhook endpoints for third-party integrations
  pipeline :webhooks do
    plug(:accepts, ["json"])
  end

  scope "/webhooks/widgets", CastmillWeb do
    pipe_through(:webhooks)

    post("/:integration_id/:widget_config_id", WidgetIntegrationController, :receive_webhook)
  end

  # Webhook endpoints for addons
  # Addons define their webhook handlers via the webhook_handlers/0 callback
  scope "/webhooks/addons", CastmillWeb do
    pipe_through(:webhooks)

    # Catch-all route for addon webhooks: /webhooks/addons/:addon_id/*path
    post("/:addon_id/*path", AddonWebhookController, :handle_webhook)
  end

  # OAuth routes for third-party widget integrations
  # These routes use session for authentication (authorize endpoint)
  # The callback endpoint validates signed state parameter instead
  pipeline :oauth do
    plug(:accepts, ["html", "json"])
    plug(:fetch_session)
    plug(:put_secure_browser_headers)
    plug(:fetch_current_user)
  end

  # Generic OAuth routes for widget integrations
  # These routes work with any OAuth provider based on credential_schema configuration
  scope "/auth/widget-integrations", CastmillWeb do
    pipe_through(:oauth)

    # Initiate OAuth flow - reads config from integration's credential_schema
    get("/:integration_id/authorize", WidgetOAuthController, :authorize)

    # Fixed callback URL for all integrations - integration_id is in state parameter
    # Use this URL when registering with OAuth providers (e.g., Spotify)
    get("/callback", WidgetOAuthController, :callback_unified)
  end

  scope "/devices", CastmillWeb do
    pipe_through([:device, :authenticate_device])

    get("/:device_id", DeviceController, :show)
    get("/:device_id/channels", DeviceController, :get_channels)
    get("/:device_id/playlists/:playlist_id", DeviceController, :get_playlist)

    put("/:device_id/channels/:channel_id", DeviceController, :add_channel)
    delete("/:device_id/channels/:channel_id", DeviceController, :remove_channel)

    # This route can be used by a device in order to post
    # its current status to the server. It can be called in
    # regular intervals or triggered by a user.
    post("/:device_id/info", DeviceController, :info)
  end

  # Allows starting a signup process for Passkeys
  pipeline :dashboard do
    plug(:put_secure_browser_headers)
    plug(:fetch_session)
    plug(:fetch_dashboard_user)
    plug(:accepts, ["json"])
  end

  # Pipeline for large file uploads with 5GB limit
  # Uses Plug.Parsers with increased body size limit for media uploads
  pipeline :large_upload do
    plug(:put_secure_browser_headers)
    plug(:fetch_session)
    plug(:fetch_dashboard_user)
    plug(:accepts, ["json"])
    plug(Plug.Parsers,
      parsers: [:multipart],
      pass: ["*/*"],
      length: 5_368_709_120
    )
  end

  scope "/signups", CastmillWeb do
    pipe_through(:dashboard)

    post("/", SignUpController, :create)
    post("/challenges", SignUpController, :create_challenge)
    post("/:id/users", SignUpController, :create_user)
  end

  scope "/sessions", CastmillWeb do
    pipe_through(:dashboard)

    get("/", SessionController, :get)
    post("/", SessionController, :login_user)
    delete("/", SessionController, :logout_user)
    get("/challenges", SessionController, :create_challenge)
  end

  scope "/credentials", CastmillWeb do
    pipe_through(:dashboard)

    post("/recover", CredentialRecoveryController, :request_recovery)
    get("/recover/verify", CredentialRecoveryController, :verify_token)
    get("/recover/challenge", CredentialRecoveryController, :create_recovery_challenge)
    post("/recover/credential", CredentialRecoveryController, :add_recovery_credential)
  end

  # Public invitation routes (no authentication required)
  scope "/dashboard", CastmillWeb do
    pipe_through(:dashboard)

    get("/organizations_invitations/:token/preview", OrganizationController, :preview_invitation)
    get("/network_invitations/:token/preview", NetworkInvitationController, :preview_invitation)
    get("/network/public-settings", NetworkSettingsController, :show)
  end

  # Addon API routes - supports both public and authenticated endpoints
  # Public routes (defined via public_api_routes/0) don't require authentication
  # Routes are mounted under /api/addons/:addon_id/*path
  scope "/api/addons", CastmillWeb do
    pipe_through(:dashboard)

    get("/:addon_id/*path", AddonApiController, :dispatch_get)
    post("/:addon_id/*path", AddonApiController, :dispatch_post)
    put("/:addon_id/*path", AddonApiController, :dispatch_put)
    delete("/:addon_id/*path", AddonApiController, :dispatch_delete)
  end

  scope "/dashboard", CastmillWeb do
    pipe_through([:dashboard, :authenticate_user])

    get("/addons", AddonsController, :index)
    get("/users/:user_id/organizations", OrganizationController, :list_users_organizations)

    # Network admin endpoints
    get("/network/admin-status", NetworkDashboardController, :check_admin_status)
    get("/network/settings", NetworkDashboardController, :show_settings)
    put("/network/settings", NetworkDashboardController, :update_settings)
    get("/network/stats", NetworkDashboardController, :show_stats)
    get("/network/organizations", NetworkDashboardController, :list_organizations)
    post("/network/organizations", NetworkDashboardController, :create_organization)
    delete("/network/organizations/:id", NetworkDashboardController, :delete_organization)
    get("/network/users", NetworkDashboardController, :list_users)
    get("/network/invitations", NetworkDashboardController, :list_invitations)
    delete("/network/invitations/:id", NetworkDashboardController, :delete_invitation)

    post(
      "/network/organizations/:organization_id/invitations",
      NetworkDashboardController,
      :invite_user_to_organization
    )

    # Network admin user management
    post("/network/users/:user_id/block", NetworkDashboardController, :block_user)
    delete("/network/users/:user_id/block", NetworkDashboardController, :unblock_user)
    delete("/network/users/:user_id", NetworkDashboardController, :delete_user)

    # Network admin organization management
    post(
      "/network/organizations/:organization_id/block",
      NetworkDashboardController,
      :block_organization
    )

    delete(
      "/network/organizations/:organization_id/block",
      NetworkDashboardController,
      :unblock_organization
    )

    # Search endpoint
    get("/organizations/:organization_id/search", SearchController, :search)

    # User profile management
    get("/users/:id", UserController, :show)
    put("/users/:id", UserController, :update)
    delete("/users/:id", UserController, :delete)

    # Onboarding progress
    get("/users/:user_id/onboarding-progress", OnboardingProgressController, :show)
    put("/users/:user_id/onboarding-progress", OnboardingProgressController, :update)

    post(
      "/users/:user_id/onboarding-progress/complete-step",
      OnboardingProgressController,
      :complete_step
    )

    post("/users/:user_id/onboarding-progress/dismiss", OnboardingProgressController, :dismiss)
    post("/users/:user_id/onboarding-progress/reset", OnboardingProgressController, :reset)

    # List all the widgets available for the organization
    get("/organizations/:organization_id/widgets", OrganizationController, :list_widgets)
    post("/organizations/:organization_id/widgets", OrganizationController, :create_widget)

    # Get a widget by ID
    get(
      "/organizations/:organization_id/widgets/:widget_id",
      OrganizationController,
      :get_widget
    )

    # Check if a widget's integration credentials are configured
    get(
      "/organizations/:organization_id/widgets/:widget_id/credentials-status",
      WidgetIntegrationController,
      :check_widget_credentials
    )

    # Widget Integration Management
    get(
      "/organizations/:organization_id/widgets/:widget_id/integrations",
      WidgetIntegrationController,
      :list_integrations
    )

    get(
      "/organizations/:organization_id/widget-integrations/:integration_id",
      WidgetIntegrationController,
      :get_integration
    )

    # Organization-scoped credentials
    post(
      "/organizations/:organization_id/widget-integrations/:integration_id/credentials",
      WidgetIntegrationController,
      :upsert_organization_credentials
    )

    put(
      "/organizations/:organization_id/widget-integrations/:integration_id/credentials",
      WidgetIntegrationController,
      :upsert_organization_credentials
    )

    delete(
      "/organizations/:organization_id/widget-integrations/:integration_id/credentials",
      WidgetIntegrationController,
      :delete_organization_credentials
    )

    # Test integration
    post(
      "/organizations/:organization_id/widget-integrations/:integration_id/test",
      WidgetIntegrationController,
      :test_integration
    )

    # Get permissions matrix for current user in organization
    get("/organizations/:organization_id/permissions", PermissionsController, :show)

    # Get widget usage before deletion
    get(
      "/organizations/:organization_id/widgets/:widget_id/usage",
      OrganizationController,
      :get_widget_usage
    )

    # Prefetch integration data for a widget (before widget_config exists)
    # This allows the UI to warm up the cache while showing the widget details modal
    post(
      "/organizations/:organization_id/widgets/:widget_id/prefetch-data",
      WidgetIntegrationController,
      :prefetch_widget_data
    )

    delete(
      "/organizations/:organization_id/widgets/:widget_id",
      OrganizationController,
      :delete_widget
    )

    patch(
      "/organizations/:organization_id/widgets/:widget_id",
      OrganizationController,
      :update_widget
    )

    # List all the users in the organization
    get("/organizations/:organization_id/members", OrganizationController, :list_members)

    delete(
      "/organizations/:organization_id/members/:user_id",
      OrganizationController,
      :remove_member
    )

    # Invite User to an organization
    post("/organizations/:organization_id/invitations", OrganizationController, :invite_member)
    get("/organizations/:organization_id/invitations", OrganizationController, :list_invitations)

    delete(
      "/organizations/:organization_id/invitations/:invitation_id",
      OrganizationController,
      :remove_invitation
    )

    get("/organizations_invitations/:token", OrganizationController, :show_invitation)
    post("/organizations_invitations/:token/accept", OrganizationController, :accept_invitation)
    post("/organizations_invitations/:token/reject", OrganizationController, :reject_invitation)

    # Network invitations
    get("/network_invitations/:token", NetworkInvitationController, :show_invitation)
    post("/network_invitations/:token/accept", NetworkInvitationController, :accept_invitation)
    post("/network_invitations/:token/reject", NetworkInvitationController, :reject_invitation)

    # Return Usage information for the organization
    get("/organizations/:organization_id/usage", OrganizationUsageController, :index)

    # View and accept invitations
    get("/invitations/:token", TeamController, :show_invitation, as: :team_invitation)
    post("/invitations/:token/accept", TeamController, :accept_invitation, as: :team_invitation)
    post("/invitations/:token/reject", TeamController, :reject_invitation, as: :team_invitation)

    resources "/organizations", OrganizationController, only: [:update] do
      post("/complete-onboarding", OrganizationController, :complete_onboarding)
      post("/devices", OrganizationController, :register_device)

      # Playlist specific routes
      post("/playlists/:playlist_id/items", PlaylistController, :add_item)
      patch("/playlists/:playlist_id/items/:item_id", PlaylistController, :update_item)

      patch(
        "/playlists/:playlist_id/items/:item_id/config",
        PlaylistController,
        :update_widget_config
      )

      put("/playlists/:playlist_id/items/:item_id", PlaylistController, :move_item)
      delete("/playlists/:playlist_id/items/:item_id", PlaylistController, :delete_item)

      # Get ancestor playlist IDs (for circular reference prevention in layout widgets)
      get("/playlists/:playlist_id/ancestors", PlaylistController, :get_ancestors)

      # Channel Entries
      get("/channels/:channel_id/entries", ResourceController, :list_channel_entries)
      post("/channels/:channel_id/entries", ResourceController, :add_channel_entry)
      patch("/channels/:channel_id/entries/:id", ResourceController, :update_channel_entry)
      delete("/channels/:channel_id/entries/:id", ResourceController, :delete_channel_entry)

      # Teams Specific routes
      put("/teams/:team_id", TeamController, :update_team)
      get("/teams/:team_id/members", TeamController, :list_members)
      delete("/teams/:team_id/members/:user_id", TeamController, :remove_member)

      # Invitations
      post("/teams/:team_id/invitations", TeamController, :invite_user)
      get("/teams/:team_id/invitations", TeamController, :list_invitations)
      delete("/teams/:team_id/invitations/:invitation_id", TeamController, :remove_invitation)

      # Team Resources
      get("/teams/:team_id/:resource_type", TeamController, :list_resources)
      put("/teams/:team_id/:resource_type/:resource_id", TeamController, :add_resource)
      delete("/teams/:team_id/:resource_type/:resource_id", TeamController, :remove_resource)

      # Fall back route for all other resources
      resources "/:resources", ResourceController, except: [:new, :edit] do
      end
    end

    # Routes for organization quotas
    resources("/organizations/:organization_id/quotas", OrganizationQuotaController,
      only: [:index, :show, :create, :update]
    )

    # Widget-scoped credentials (for widgets that require per-instance credentials)
    post(
      "/widget-configs/:widget_config_id/credentials",
      WidgetIntegrationController,
      :upsert_widget_credentials
    )

    put(
      "/widget-configs/:widget_config_id/credentials",
      WidgetIntegrationController,
      :upsert_widget_credentials
    )

    # Widget data access (for players)
    get("/widget-configs/:widget_config_id/data", WidgetIntegrationController, :get_widget_data)

    post(
      "/widget-configs/:widget_config_id/refresh",
      WidgetIntegrationController,
      :refresh_widget_data
    )

    post("/devices/:device_id/commands", DeviceController, :send_command)
    get("/devices/:device_id/events", DeviceController, :list_events)
    delete("/devices/:device_id/events", DeviceController, :delete_events)
    get("/devices/:device_id/cache", DeviceController, :get_cache)
    delete("/devices/:device_id/cache", DeviceController, :delete_cache)

    # Endpoint to get all channels of a device in the dashboard scope
    get("/devices/:device_id/channels", DeviceController, :get_channels)

    # Endpoint to add a channel to a device in the dashboard scope
    post("/devices/:device_id/channels", DeviceController, :add_channel)

    # Endpoint to remove a channel from a device in the dashboard scope
    delete("/devices/:device_id/channels/:channel_id", DeviceController, :remove_channel)

    # Endpoint to get a playlist for device preview in the dashboard scope
    get("/devices/:device_id/playlists/:playlist_id", DeviceController, :get_playlist)

    # Notification routes
    get("/notifications", NotificationController, :index)
    get("/notifications/unread_count", NotificationController, :unread_count)
    patch("/notifications/:id/read", NotificationController, :mark_read)
    post("/notifications/mark_all_read", NotificationController, :mark_all_read)

    # User credential and email management routes (session-authenticated)
    get("/users/:id/credentials", UserController, :list_credentials)
    post("/users/:id/credentials/challenge", UserController, :create_credential_challenge)
    post("/users/:id/credentials", UserController, :add_credential)
    delete("/users/:id/credentials/:credential_id", UserController, :delete_credential)
    put("/users/:id/credentials/:credential_id", UserController, :update_credential)
    post("/users/:id/send-email-verification", UserController, :send_email_verification)
    post("/verify-email", UserController, :verify_email)
  end

  # Large file upload routes - uses separate pipeline with 5GB limit
  # This prevents the large body limit from applying to all dashboard routes
  scope "/dashboard", CastmillWeb do
    pipe_through([:large_upload, :authenticate_user])

    # Media upload endpoint - requires large body size support
    post("/organizations/:organization_id/medias", UploadController, :create)
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

      get("/channels/:channel_id/entries", ResourceController, :list_channel_entries)
      post("/channels/:channel_id/entries", ResourceController, :add_channel_entry)
      patch("/channels/:channel_id/entries/:id", ResourceController, :update_channel_entry)
      delete("/channels/:channel_id/entries/:id", ResourceController, :delete_channel_entry)

      post("/playlists/:playlist_id/items", PlaylistController, :add_item)
      delete("/playlists/:playlist_id/items/:id", PlaylistController, :delete_item)

      # Get ancestor playlist IDs (for circular reference prevention in layout widgets)
      get("/playlists/:playlist_id/ancestors", PlaylistController, :get_ancestors)
    end

    resources("/users", UserController, except: [:new, :edit, :index])

    resources("/access_tokens", AccessTokenController, except: [:new, :edit])

    # Notification routes
    get("/notifications", NotificationController, :index)
    get("/notifications/unread_count", NotificationController, :unread_count)
    patch("/notifications/:id/read", NotificationController, :mark_as_read)
    post("/notifications/mark_all_read", NotificationController, :mark_all_read)

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
    # First, check if user was loaded by fetch_dashboard_user plug
    case conn.assigns[:current_user] do
      nil ->
        # If there's no user in assigns, try token authentication
        authenticate_with_token(conn, opts)

      user ->
        # If there is a user in assigns, use it
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

  defp authenticate_device(conn, _opts) do
    device_id = conn.params["device_id"]

    conn
    |> get_bearer_token()
    |> case do
      {:ok, token} ->
        Castmill.Devices.verify_device_token(device_id, token)
        |> case do
          {:ok, device} -> assign(conn, :current_actor, device)
          {:error, message} -> respond_with_error(conn, message)
        end

      {:error, message} ->
        respond_with_error(conn, message)
    end
  end

  defp get_bearer_token(conn) do
    auth_header = List.first(get_req_header(conn, "authorization"))
    auth_param = conn.params["auth"]

    case String.split(auth_header || auth_param || "", " ") do
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

  # Fetches the user from the session for dashboard API requests
  # Also checks if the user or their organization is blocked
  defp fetch_dashboard_user(conn, _opts) do
    case get_session(conn, :user_session_token) do
      nil ->
        conn

      token ->
        user = Castmill.Accounts.get_user_by_session_token(token)

        case CastmillWeb.SessionUtils.check_user_blocked_status(user) do
          {:ok, _user} ->
            assign(conn, :current_user, user)

          {:error, {:user_blocked, reason}} ->
            conn
            |> delete_session(:user)
            |> delete_session(:user_session_token)
            |> put_status(:forbidden)
            |> Phoenix.Controller.json(%{error: reason, code: "user_blocked"})
            |> halt()

          {:error, {:organization_blocked, reason}} ->
            conn
            |> delete_session(:user)
            |> delete_session(:user_session_token)
            |> put_status(:forbidden)
            |> Phoenix.Controller.json(%{error: reason, code: "organization_blocked"})
            |> halt()

          {:error, _} ->
            conn
        end
    end
  end
end
