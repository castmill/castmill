defmodule CastmillWeb.Plugs.AddonStatic do
  @moduledoc """
  A Plug that serves static files from external addon packages.

  External addons can define a `static_path/0` callback that returns the
  path to their static assets. This plug serves those files under
  /assets/addons/:addon_id/

  This allows external addon packages (like billing, analytics, etc.) to
  serve their own JS/CSS without copying files into the main castmill
  priv/static directory.
  """

  @behaviour Plug

  import Plug.Conn

  @impl true
  def init(opts), do: opts

  @impl true
  def call(%Plug.Conn{path_info: ["assets", "addons", addon_id | rest]} = conn, _opts) do
    # Get external addons from config
    external_addons = Application.get_env(:castmill, :external_addons, [])

    # Find the addon module matching the addon_id
    case find_addon_with_static(external_addons, addon_id) do
      {:ok, static_dir} ->
        serve_static_file(conn, static_dir, rest)

      :not_found ->
        conn
    end
  end

  def call(conn, _opts), do: conn

  defp find_addon_with_static(external_addons, addon_id) do
    Enum.find_value(external_addons, :not_found, fn
      {addon_module, _opts} ->
        check_addon_static(addon_module, addon_id)

      addon_module when is_atom(addon_module) ->
        check_addon_static(addon_module, addon_id)
    end)
  end

  defp check_addon_static(addon_module, addon_id) do
    # Get component_info to check the addon's ID
    component_infos =
      if function_exported?(addon_module, :component_info, 0) do
        case addon_module.component_info() do
          infos when is_list(infos) -> infos
          info when is_map(info) -> [info]
          nil -> []
        end
      else
        []
      end

    # Check if any component has matching ID and the addon has static_path
    matching_component = Enum.find(component_infos, fn info -> info.id == addon_id end)

    if matching_component && function_exported?(addon_module, :static_path, 0) do
      case addon_module.static_path() do
        {:priv, app, path} ->
          priv_dir = :code.priv_dir(app) |> to_string()
          {:ok, Path.join(priv_dir, path)}

        path when is_binary(path) ->
          {:ok, path}

        nil ->
          nil
      end
    else
      nil
    end
  end

  defp serve_static_file(conn, static_dir, path_parts) do
    file_path = Path.join([static_dir | path_parts])

    # Security: ensure the resolved path is within the static directory
    case Path.expand(file_path) do
      expanded when is_binary(expanded) ->
        if String.starts_with?(expanded, Path.expand(static_dir)) and File.regular?(expanded) do
          content_type = MIME.from_path(file_path)

          conn
          |> put_resp_content_type(content_type)
          |> send_file(200, expanded)
          |> halt()
        else
          conn
        end
    end
  end
end
