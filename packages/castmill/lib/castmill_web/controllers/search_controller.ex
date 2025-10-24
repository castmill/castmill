defmodule CastmillWeb.SearchController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, :search, %{"organization_id" => organization_id}) do
    {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :member, :guest])}
  end

  def check_access(_actor_id, _action, _params) do
    {:ok, false}
  end

  plug(AuthorizeDash)

  @search_params_schema %{
    organization_id: [type: :string, required: true],
    query: [type: :string, required: true],
    page: [type: :integer, number: [min: 1], default: 1],
    page_size: [type: :integer, number: [min: 1, max: 100], default: 20]
  }

  @doc """
  Search across all resources and addons in the organization.
  Returns results grouped by resource type with pagination.
  """
  def search(conn, params) do
    with {:ok, validated_params} <- Tarams.cast(params, @search_params_schema) do
      organization_id = validated_params.organization_id
      query = validated_params.query
      page = validated_params.page
      page_size = validated_params.page_size

      # Search built-in resources
      built_in_results = search_built_in_resources(organization_id, query, page, page_size)

      # Search addon resources
      addon_results = search_addon_resources(organization_id, query, page, page_size)

      # Combine results
      all_results = built_in_results ++ addon_results

      conn
      |> put_status(:ok)
      |> json(%{
        query: query,
        page: page,
        page_size: page_size,
        results: all_results
      })
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  # Search built-in resources (medias, playlists, channels, devices, teams)
  defp search_built_in_resources(organization_id, query, page, page_size) do
    resource_types = [
      %{type: "medias", module: Castmill.Resources.Media},
      %{type: "playlists", module: Castmill.Resources.Playlist},
      %{type: "channels", module: Castmill.Resources.Channel},
      %{type: "devices", module: Castmill.Devices.Device},
      %{type: "teams", module: Castmill.Teams.Team}
    ]

    Enum.map(resource_types, fn %{type: type, module: module} ->
      params = %{
        organization_id: organization_id,
        resources: type,
        search: query,
        page: page,
        page_size: page_size,
        filters: []
      }

      data =
        if type == "teams" do
          Organizations.list_teams(params)
        else
          Organizations.list_resources(params)
        end

      count =
        if type == "teams" do
          Organizations.count_teams(params)
        else
          Organizations.count_resources(params)
        end

      %{
        resource_type: type,
        data: data,
        count: count,
        page: page,
        page_size: page_size,
        total_pages: ceil(count / page_size)
      }
    end)
    |> Enum.filter(fn result -> result.count > 0 end)
  end

  # Search addon resources
  defp search_addon_resources(organization_id, query, page, page_size) do
    # Get all addon modules from configuration
    addons = Application.get_env(:castmill, :addons, [])

    Enum.flat_map(addons, fn addon_module ->
      # Check if addon implements search callback
      if function_exported?(addon_module, :search, 3) do
        opts = %{page: page, page_size: page_size}

        case apply(addon_module, :search, [organization_id, query, opts]) do
          {:ok, results} when is_list(results) ->
            results

          _ ->
            []
        end
      else
        []
      end
    end)
  end
end
