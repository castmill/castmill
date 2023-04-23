defmodule CastmillWeb.Router do
  use CastmillWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, {CastmillWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug :authenticate_user
  end

  scope "/", CastmillWeb do
    pipe_through :browser

    get "/", PageController, :home
  end

  # Other scopes may use custom stacks.
  scope "/api", CastmillWeb do
    pipe_through [:api, :authenticate_user]

    resources "/networks", NetworkController, except: [:new, :edit] do
      pipe_through :load_network

      resources "/organizations", OrganizationController, except: [:new, :edit]
      resources "/users", UserController, except: [:new, :edit]
    end

    resources "/organizations", OrganizationController, except: [:new, :edit] do
      pipe_through :load_organization

      resources "/users", UserController, except: [:new, :edit] do
      end

      resources "/teams", UserController, except: [:new, :edit] do
      end

      resources "/:resources", ResourceController, except: [:new, :edit] do
      end
    end

    resources "/users", UserController, except: [:new, :edit, :index]
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
      pipe_through :browser

      live_dashboard "/dashboard", metrics: CastmillWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end

  defp authenticate_user(conn, _opts) do
    conn
    |> get_bearer_token()
    |> Castmill.Accounts.get_user_by_access_token(Utils.RemoteIp.get(conn))
    |> case do
      {:ok, user} ->
        conn
        |> assign(:current_user, user)
        |> assign(:network, user.network)
      {:error, message} ->
         conn
         |> put_status(:unauthorized)
         |> Phoenix.Controller.json(%{message: message})
         |> halt
    end
  end

  defp get_bearer_token(conn) do
    auth_header = List.first(get_req_header(conn, "authorization"))
    if auth_header do
      [_, token] = String.split(auth_header, " ")
      token
    end
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
    case Castmill.Organizations.get_organization!(conn.params["organization_id"]) do
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
