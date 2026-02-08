defmodule CastmillWeb.AddonApiController do
  @moduledoc """
  Controller for routing API requests to addon-defined controllers.

  Addons can define API routes via the `api_routes/0` callback. These routes
  are mounted under `/api/addons/:addon_id/` and dispatched to the addon's
  controller.

  Addons can also define public (unauthenticated) routes via `public_api_routes/0`.

  ## How it works

  1. Addon defines routes in `api_routes/0` or `public_api_routes/0`:
     ```elixir
     def api_routes do
       [
         {:get, "/status", MyController, :status},
         {:post, "/checkout", MyController, :checkout}
       ]
     end

     def public_api_routes do
       [
         {:get, "/plans", MyController, :list_plans}
       ]
     end
     ```

  2. Requests to `/api/addons/:addon_id/status` are routed here

  3. This controller checks if the route is public first, then authenticated
  """

  use CastmillWeb, :controller
  require Logger

  @doc """
  Dispatch a GET request to an addon's API endpoint.
  Checks public routes first, then authenticated routes.
  """
  def dispatch_get(conn, params) do
    dispatch(conn, params, :get)
  end

  @doc """
  Dispatch a POST request to an addon's API endpoint.
  """
  def dispatch_post(conn, params) do
    dispatch(conn, params, :post)
  end

  @doc """
  Dispatch a PUT request to an addon's API endpoint.
  """
  def dispatch_put(conn, params) do
    dispatch(conn, params, :put)
  end

  @doc """
  Dispatch a DELETE request to an addon's API endpoint.
  """
  def dispatch_delete(conn, params) do
    dispatch(conn, params, :delete)
  end

  defp dispatch(conn, %{"addon_id" => addon_id, "path" => path_parts} = params, method) do
    path = "/" <> Enum.join(path_parts, "/")
    controller_params = Map.drop(params, ["addon_id", "path"])
    controller_params = Map.merge(controller_params, conn.query_params)

    # First check if this is a public route (no auth required)
    case find_public_route(addon_id, method, path) do
      {_method, _path, controller, action} ->
        # Public route found - dispatch without auth check
        apply(controller, action, [conn, controller_params])

      nil ->
        # Not a public route - check authentication and then look for private route
        dispatch_authenticated(conn, addon_id, method, path, controller_params)
    end
  end

  defp dispatch(conn, _params, _method) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Invalid addon route"})
  end

  # Dispatch for authenticated routes - requires valid user
  defp dispatch_authenticated(conn, addon_id, method, path, controller_params) do
    # Check if user is authenticated
    case conn.assigns[:current_user] || conn.assigns[:user] do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Authentication required"})

      _user ->
        # User is authenticated - find and dispatch to the private route
        case find_route(addon_id, method, path) do
          nil ->
            Logger.warning("No addon route found: #{method} #{addon_id}#{path}")

            conn
            |> put_status(:not_found)
            |> json(%{error: "Route not found"})

          {_method, _path, controller, action} ->
            apply(controller, action, [conn, controller_params])
        end
    end
  end

  defp find_public_route(addon_id, method, path) do
    # Get all addons
    addons = Castmill.Addons.Supervisor.list_addons()

    # Find the addon by ID
    addon =
      Enum.find(addons, fn addon_module ->
        get_addon_id(addon_module) == addon_id
      end)

    if addon && function_exported?(addon, :public_api_routes, 0) do
      # Find matching public route
      addon.public_api_routes()
      |> Enum.find(fn {route_method, route_path, _controller, _action} ->
        route_method == method && match_path?(route_path, path)
      end)
    else
      nil
    end
  end

  defp find_route(addon_id, method, path) do
    # Get all addons
    addons = Castmill.Addons.Supervisor.list_addons()

    # Find the addon by ID
    addon =
      Enum.find(addons, fn addon_module ->
        get_addon_id(addon_module) == addon_id
      end)

    if addon && function_exported?(addon, :api_routes, 0) do
      # Find matching route
      addon.api_routes()
      |> Enum.find(fn {route_method, route_path, _controller, _action} ->
        route_method == method && match_path?(route_path, path)
      end)
    else
      nil
    end
  end

  # Simple path matching (could be extended to support path parameters)
  defp match_path?(route_path, request_path) do
    route_path == request_path
  end

  defp get_addon_id(addon_module) do
    if function_exported?(addon_module, :component_info, 0) do
      case addon_module.component_info() do
        %{id: id} when is_binary(id) -> id
        _ -> module_to_addon_id(addon_module)
      end
    else
      module_to_addon_id(addon_module)
    end
  end

  defp module_to_addon_id(module) do
    module
    |> Module.split()
    |> List.last()
    |> Macro.underscore()
  end
end
