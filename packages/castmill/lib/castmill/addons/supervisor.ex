defmodule Castmill.Addons.Supervisor do
  @moduledoc """
  Supervises all Castmill addons.

  Loads both internal addons (configured in config.exs under `:castmill, :addons`)
  and external addons (configured in runtime.exs under `:castmill, :external_addons`).

  ## Internal Addons

  Internal addons are bundled with Castmill and configured at compile time:

      config :castmill, :addons, [
        Castmill.Addons.Onboarding,
        Castmill.Addons.Content,
        ...
      ]

  ## External Addons

  External addons are loaded from separate packages at runtime:

      config :castmill, :external_addons, [
        {MyApp.BillingAddon, [stripe_key: "sk_..."]},
        {MyApp.AnalyticsAddon, []}
      ]

  External addons must implement `Castmill.Addons.AddonBehaviour`.
  """

  use Supervisor
  require Logger

  def start_link(_opts) do
    Supervisor.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(_state) do
    internal_addons = Application.get_env(:castmill, :addons, [])
    external_addons = Application.get_env(:castmill, :external_addons, [])

    Logger.info("Starting Addons Supervisor")
    Logger.info("  Internal addons: #{inspect(internal_addons)}")
    Logger.info("  External addons: #{inspect(Enum.map(external_addons, &elem(&1, 0)))}")

    # Build child specs for internal addons (simple module names)
    internal_children =
      Enum.map(internal_addons, fn addon_module ->
        {addon_module, []}
      end)

    # External addons are already in {module, opts} format
    external_children = external_addons

    children = internal_children ++ external_children

    opts = [strategy: :one_for_one, name: Castmill.Addons.Supervisor]
    Supervisor.init(children, opts)
  end

  @doc """
  Returns all loaded addons (both internal and external).
  """
  def list_addons do
    internal = Application.get_env(:castmill, :addons, [])

    external =
      Application.get_env(:castmill, :external_addons, [])
      |> Enum.map(&elem(&1, 0))

    internal ++ external
  end

  @doc """
  Returns component info for all addons that provide UI components.
  """
  def list_component_infos do
    list_addons()
    |> Enum.map(fn addon ->
      if function_exported?(addon, :component_info, 0) do
        addon.component_info()
      else
        nil
      end
    end)
    |> Enum.filter(&(&1 != nil))
  end

  @doc """
  Returns all API routes defined by addons.
  """
  def list_api_routes do
    list_addons()
    |> Enum.flat_map(fn addon ->
      if function_exported?(addon, :api_routes, 0) do
        addon_id = get_addon_id(addon)

        addon.api_routes()
        |> Enum.map(fn {method, path, controller, action} ->
          {method, "/api/addons/#{addon_id}#{path}", controller, action}
        end)
      else
        []
      end
    end)
  end

  @doc """
  Returns all webhook handlers defined by addons.
  """
  def list_webhook_handlers do
    list_addons()
    |> Enum.flat_map(fn addon ->
      if function_exported?(addon, :webhook_handlers, 0) do
        addon_id = get_addon_id(addon)

        addon.webhook_handlers()
        |> Enum.map(fn handler ->
          Map.put(handler, :addon_id, addon_id)
        end)
      else
        []
      end
    end)
  end

  @doc """
  Finds a webhook handler by addon_id and path.
  """
  def find_webhook_handler(addon_id, path) do
    list_webhook_handlers()
    |> Enum.find(fn handler ->
      handler.addon_id == addon_id && handler.path == path
    end)
  end

  # Extract addon ID from component_info or module name
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
