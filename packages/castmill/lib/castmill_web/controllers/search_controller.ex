defmodule CastmillWeb.SearchController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  import Ecto.Query, warn: false

  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash
  alias Castmill.Repo

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

  Access control:
  - Admins see all resources in the organization
  - Non-admin users only see resources they have access to via team membership
  """
  def search(conn, params) do
    with {:ok, validated_params} <- Tarams.cast(params, @search_params_schema) do
      organization_id = validated_params.organization_id
      query = validated_params.query
      page = validated_params.page
      page_size = validated_params.page_size

      # Get the current user from the connection
      current_actor = conn.assigns[:current_actor] || conn.assigns[:current_user]
      actor_id = Map.get(current_actor, :id)

      # Search built-in resources
      built_in_results =
        search_built_in_resources(organization_id, actor_id, query, page, page_size)

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
  #
  # Access control:
  # - If user is admin: search all resources in the organization
  # - If user is not admin: only search resources accessible via team membership
  defp search_built_in_resources(organization_id, actor_id, query, page, page_size) do
    # Check if user is admin
    is_admin = Organizations.is_admin?(organization_id, actor_id)

    # Get user's team IDs if not admin
    team_ids =
      if is_admin do
        nil
      else
        get_user_team_ids(organization_id, actor_id)
      end

    resource_types = [
      %{type: "medias", module: Castmill.Resources.Media},
      %{type: "playlists", module: Castmill.Resources.Playlist},
      %{type: "channels", module: Castmill.Resources.Channel},
      %{type: "devices", module: Castmill.Devices.Device},
      %{type: "teams", module: Castmill.Teams.Team}
    ]

    Enum.flat_map(resource_types, fn %{type: type, module: _module} ->
      if is_admin do
        # Admin sees all resources in organization
        params = %{
          organization_id: organization_id,
          resources: type,
          search: query,
          page: page,
          page_size: page_size,
          filters: []
        }

        data = Organizations.list_resources(params)
        count = Organizations.count_resources(params)

        [
          %{
            resource_type: type,
            data: data,
            count: count,
            page: page,
            page_size: page_size,
            total_pages: ceil(count / page_size)
          }
        ]
      else
        # Non-admin sees resources from their teams
        search_resources_by_teams(organization_id, type, team_ids, query, page, page_size)
      end
    end)
    |> Enum.filter(fn result -> result.count > 0 end)
  end

  # Search resources across multiple teams for non-admin users
  defp search_resources_by_teams(organization_id, resource_type, team_ids, query, page, page_size)
       when is_list(team_ids) and length(team_ids) > 0 do
    # Search in each team and combine results
    # Note: For teams resource type, we just return the teams the user belongs to
    if resource_type == "teams" do
      params = %{
        organization_id: organization_id,
        resources: resource_type,
        search: query,
        page: page,
        page_size: page_size,
        filters: []
      }

      all_teams = Organizations.list_resources(params)
      # Filter to only teams the user belongs to
      filtered_teams = Enum.filter(all_teams, fn team -> team.id in team_ids end)
      count = length(filtered_teams)

      [
        %{
          resource_type: resource_type,
          data: filtered_teams,
          count: count,
          page: page,
          page_size: page_size,
          total_pages: ceil(count / max(page_size, 1))
        }
      ]
    else
      # For other resources, search within each team
      team_results =
        Enum.map(team_ids, fn team_id ->
          params = %{
            organization_id: organization_id,
            resources: resource_type,
            search: query,
            page: page,
            page_size: page_size,
            filters: [],
            team_id: team_id
          }

          {Organizations.list_resources(params), Organizations.count_resources(params)}
        end)

      # Combine and deduplicate results from all teams
      {all_data, _total_count} =
        team_results
        |> Enum.reduce({[], 0}, fn {data, count}, {acc_data, acc_count} ->
          # Merge data and deduplicate by id
          merged_data = (acc_data ++ data) |> Enum.uniq_by(& &1.id)
          {merged_data, acc_count + count}
        end)

      # Sort by name and apply pagination
      sorted_data =
        all_data
        |> Enum.sort_by(& &1.name)
        |> Enum.take(page_size)

      [
        %{
          resource_type: resource_type,
          data: sorted_data,
          count: length(all_data),
          page: page,
          page_size: page_size,
          total_pages: ceil(length(all_data) / max(page_size, 1))
        }
      ]
    end
  end

  defp search_resources_by_teams(
         _organization_id,
         resource_type,
         _team_ids,
         _query,
         page,
         page_size
       ) do
    # User has no teams, return empty results
    [
      %{
        resource_type: resource_type,
        data: [],
        count: 0,
        page: page,
        page_size: page_size,
        total_pages: 0
      }
    ]
  end

  # Get list of team IDs that a user belongs to in an organization
  defp get_user_team_ids(organization_id, user_id) do
    alias Castmill.Teams.TeamsUsers

    query =
      from tu in TeamsUsers,
        join: t in assoc(tu, :team),
        where: tu.user_id == ^user_id and t.organization_id == ^organization_id,
        select: tu.team_id

    Repo.all(query)
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
