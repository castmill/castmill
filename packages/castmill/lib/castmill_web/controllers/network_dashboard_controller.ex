defmodule CastmillWeb.NetworkDashboardController do
  @moduledoc """
  Controller for network admin operations in the dashboard.

  Provides endpoints for:
  - Checking if the current user is a network admin
  - Viewing and updating network settings
  - Getting network statistics
  - Listing network organizations and users

  All endpoints require the user to be authenticated and be a network admin.
  """
  use CastmillWeb, :controller

  alias Castmill.Networks
  alias Castmill.Organizations.Organization
  alias Castmill.Accounts.User
  alias Castmill.Repo
  alias Castmill.Widgets.NetworkAccess
  alias Castmill.Widgets.Integrations.OrganizationSettings

  action_fallback(CastmillWeb.FallbackController)

  @doc """
  Check if the current user is a network admin.
  Returns admin status and network_id if they are an admin.
  """
  def check_admin_status(conn, _params) do
    user = conn.assigns[:current_user]
    network_id = conn.assigns[:network_id]

    {:ok, status} = get_user_network_admin_status(user, network_id)

    conn
    |> put_status(:ok)
    |> json(status)
  end

  @doc """
  Get the current network's settings.
  Only accessible to network admins.
  """
  def show_settings(conn, _params) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         network when not is_nil(network) <- Networks.get_network(network_id) do
      conn
      |> put_status(:ok)
      |> json(network_to_json(network))
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Network not found"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to access this resource"})
    end
  end

  @doc """
  Update the current network's settings.
  Only accessible to network admins.
  """
  def update_settings(conn, %{"network" => network_params}) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         network when not is_nil(network) <- Networks.get_network(network_id),
         {:ok, updated_network} <-
           Networks.update_network(network, sanitize_params(network_params)) do
      conn
      |> put_status(:ok)
      |> json(network_to_json(updated_network))
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Network not found"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to update network settings"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_changeset_errors(changeset)})
    end
  end

  @doc """
  Get network statistics (counts of organizations, users, devices, teams).
  Only accessible to network admins.
  """
  def show_stats(conn, _params) do
    with {:ok, network_id} <- get_admin_network_id(conn) do
      stats = get_network_stats(network_id)

      conn
      |> put_status(:ok)
      |> json(stats)
    else
      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to access this resource"})
    end
  end

  @doc """
  List the widgets the network admin curates (system and network widgets) with their
  access summary. Supports `page`, `page_size`, `search`, `kind` and `access`.
  """
  def list_widgets(conn, params) do
    with {:ok, network_id} <- get_admin_network_id(conn) do
      result = NetworkAccess.list_widgets(network_id, widget_list_params(params))

      conn
      |> put_status(:ok)
      |> json(%{
        data: Enum.map(result.entries, &widget_access_to_json/1),
        summary: result.summary,
        organizations_count: result.organizations_count,
        pagination: pagination_json(result)
      })
    else
      {:error, :not_admin} -> not_admin(conn)
    end
  end

  @doc """
  List the organizations eligible to use a curated widget and whether each can use it.
  Supports `page`, `page_size`, `search` and `status` (`enabled` or `disabled`).
  """
  def list_widget_organizations(conn, %{"widget_id" => widget_id} = params) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, result} <-
           NetworkAccess.list_organizations(network_id, widget_id, widget_list_params(params)) do
      conn
      |> put_status(:ok)
      |> json(%{
        data: result.entries,
        counts: result.counts,
        pagination: pagination_json(result)
      })
    else
      error -> widget_access_error(conn, error)
    end
  end

  @doc """
  Set a curated widget's access mode: `all`, `except`, `selected` or `hidden`.
  """
  def update_widget_access(conn, %{"widget_id" => widget_id} = params) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, widget} <- NetworkAccess.set_access(network_id, widget_id, params["access"]) do
      conn |> put_status(:ok) |> json(widget_access_to_json(widget))
    else
      error -> widget_access_error(conn, error)
    end
  end

  @doc """
  Enable or disable organizations for a curated widget, either by id
  (`enable`/`disable` lists) or every organization matching `search` (`all_matching`
  with `enabled`).
  """
  def update_widget_organizations(conn, %{"widget_id" => widget_id} = params) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, changes} <- organization_changes(params),
         {:ok, widget} <- NetworkAccess.update_organizations(network_id, widget_id, changes) do
      conn |> put_status(:ok) |> json(widget_access_to_json(widget))
    else
      error -> widget_access_error(conn, error)
    end
  end

  defp organization_changes(%{"all_matching" => true, "enabled" => enabled} = params)
       when is_boolean(enabled) do
    {:ok, %{search: params["search"], enabled: enabled}}
  end

  defp organization_changes(params) do
    enable = Map.get(params, "enable", [])
    disable = Map.get(params, "disable", [])

    if is_list(enable) and is_list(disable) do
      {:ok, %{enable: enable, disable: disable}}
    else
      {:error, :invalid_organization_id}
    end
  end

  defp widget_list_params(params) do
    %{
      page: params["page"],
      page_size: params["page_size"],
      search: params["search"],
      kind: params["kind"],
      access: params["access"],
      status: params["status"]
    }
  end

  defp pagination_json(result) do
    %{
      page: result.page,
      page_size: result.page_size,
      total_count: result.total,
      total_pages: ceil(result.total / result.page_size)
    }
  end

  defp widget_access_to_json(summary) do
    widget = summary.widget

    %{
      id: widget.id,
      name: widget.name,
      description: widget.description,
      slug: widget.slug,
      icon: widget.icon,
      small_icon: widget.small_icon,
      translations: widget.translations,
      kind: summary.kind,
      access: summary.access,
      listed_count: summary.listed_count,
      enabled_count: summary.enabled_count,
      eligible_count: summary.eligible_count,
      organizations_count: summary.organizations_count,
      in_use_count: summary.in_use_count,
      core: summary.core,
      platform_restricted: summary.platform_restricted
    }
  end

  defp widget_access_error(conn, {:error, :not_admin}), do: not_admin(conn)

  defp widget_access_error(conn, {:error, :not_found}) do
    conn |> put_status(:not_found) |> json(%{error: "Widget not found"})
  end

  defp widget_access_error(conn, {:error, {:in_use, organization_ids}}) do
    conn
    |> put_status(:conflict)
    |> json(%{
      error: "Organizations still use this widget in their playlists",
      code: "in_use",
      organizations: NetworkAccess.organization_names(organization_ids)
    })
  end

  defp widget_access_error(conn, {:error, :core_widget}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "Core widgets are always available", code: "core_widget"})
  end

  defp widget_access_error(conn, {:error, {:invalid_widget, changeset}}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{errors: format_changeset_errors(changeset)})
  end

  defp widget_access_error(conn, {:error, reason}) do
    message =
      case reason do
        :invalid_access -> "access must be one of: all, except, selected, hidden"
        :organization_not_in_network -> "All organizations must belong to your network"
        :conflicting_changes -> "An organization cannot be enabled and disabled at once"
        _ -> "One or more organization IDs are invalid"
      end

    conn |> put_status(:unprocessable_entity) |> json(%{error: message})
  end

  defp not_admin(conn) do
    conn
    |> put_status(:forbidden)
    |> json(%{error: "You must be a network admin to access this resource"})
  end

  @doc """
  Create a new organization in the network.
  Only accessible to network admins.
  """
  def create_organization(conn, %{"organization" => org_params}) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, organization} <- create_organization_for_network(network_id, org_params) do
      conn
      |> put_status(:created)
      |> json(organization_to_json(organization))
    else
      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to create organizations"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_changeset_errors(changeset)})
    end
  end

  @doc """
  List all organizations in the network.
  Supports pagination and search.
  Only accessible to network admins.

  Query parameters:
  - page: Page number (default: 1)
  - page_size: Items per page (default: 10, max: 100)
  - search: Search term for organization name
  """
  def list_organizations(conn, params) do
    with {:ok, network_id} <- get_admin_network_id(conn) do
      page = parse_int(params["page"], 1)
      page_size = min(parse_int(params["page_size"], 10), 100)
      search = params["search"]

      {organizations, total_count} =
        Networks.list_organizations_paginated(
          network_id,
          page: page,
          page_size: page_size,
          search: search
        )

      conn
      |> put_status(:ok)
      |> json(%{
        data: Enum.map(organizations, &organization_to_json/1),
        pagination: %{
          page: page,
          page_size: page_size,
          total_count: total_count,
          total_pages: ceil(total_count / page_size)
        }
      })
    else
      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to access this resource"})
    end
  end

  @doc """
  Delete an organization from the network.
  Only accessible to network admins.
  """
  def delete_organization(conn, %{"id" => org_id}) do
    alias Castmill.Organizations

    with {:ok, network_id} <- get_admin_network_id(conn),
         organization when not is_nil(organization) <- Organizations.get_organization(org_id),
         true <- organization.network_id == network_id,
         {:ok, _} <- Organizations.delete_organization(organization) do
      conn
      |> put_status(:ok)
      |> json(%{success: true, message: "Organization deleted successfully"})
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Organization not found"})

      false ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Organization does not belong to your network"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to delete organizations"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to delete organization", reason: inspect(reason)})
    end
  end

  @doc """
  List users in the network with pagination and optional search.

  Only accessible to network admins.

  ## Query parameters

    * `page` - Optional page number (defaults to 1).
    * `page_size` - Optional page size (defaults to 50, maximum 100).
    * `search` - Optional search term to filter users.

  ## Response

  Returns a JSON object with:

    * `data` - List of users serialized via `user_to_json/1`.
    * `pagination` - Pagination metadata with `page`, `page_size`,
      `total_count`, and `total_pages`.
  """
  def list_users(conn, params) do
    with {:ok, network_id} <- get_admin_network_id(conn) do
      page = parse_int(params["page"], 1)
      page_size = min(parse_int(params["page_size"], 50), 100)
      search = params["search"]

      {users, total_count} =
        Networks.list_users(network_id,
          page: page,
          page_size: page_size,
          search: search
        )

      conn
      |> put_status(:ok)
      |> json(%{
        data: Enum.map(users, &user_to_json/1),
        pagination: %{
          page: page,
          page_size: page_size,
          total_count: total_count,
          total_pages: ceil(total_count / page_size)
        }
      })
    else
      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to access this resource"})
    end
  end

  @doc """
  List all pending organization invitations across the network.
  Only accessible to network admins.
  """
  def list_invitations(conn, _params) do
    alias Castmill.Organizations

    with {:ok, network_id} <- get_admin_network_id(conn) do
      invitations = Organizations.list_invitations_for_network(network_id)

      conn
      |> put_status(:ok)
      |> json(Enum.map(invitations, &invitation_to_json/1))
    else
      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to access this resource"})
    end
  end

  @doc """
  Delete an organization invitation (from the network admin view).
  Only accessible to network admins.
  """
  def delete_invitation(conn, %{"id" => id}) do
    alias Castmill.Organizations

    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, _invitation} <- Organizations.delete_invitation_for_network(id, network_id) do
      conn
      |> put_status(:ok)
      |> json(%{success: true, message: "Invitation deleted successfully"})
    else
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Invitation not found"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to delete invitations"})
    end
  end

  @doc """
  Invite a user to an organization in the network.
  Only accessible to network admins.
  """
  def invite_user_to_organization(conn, %{
        "organization_id" => org_id,
        "email" => email,
        "role" => role
      }) do
    alias Castmill.Organizations

    with {:ok, network_id} <- get_admin_network_id(conn),
         organization when not is_nil(organization) <- Organizations.get_organization(org_id),
         true <- organization.network_id == network_id,
         {:ok, token} <- Organizations.invite_user(org_id, email, role) do
      conn
      |> put_status(:created)
      |> json(%{success: true, message: "Invitation sent successfully", token: token})
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Organization not found"})

      false ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Organization does not belong to your network"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to invite users"})

      {:error, :already_member} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "User is already a member of this organization"})

      {:error, :already_invited} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "User has already been invited to this organization"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to send invitation", reason: inspect(reason)})
    end
  end

  @doc """
  Block a user in the network.
  Only accessible to network admins.
  Network admins cannot be blocked.
  """
  def block_user(conn, %{"user_id" => user_id} = params) do
    user = conn.assigns[:current_user]
    alias Castmill.Accounts

    reason = params["reason"]

    with {:ok, network_id} <- get_admin_network_id(conn),
         target_user when not is_nil(target_user) <- Accounts.get_user(user_id),
         true <- Networks.is_network_member?(target_user.id, network_id),
         false <- target_user.id == user.id,
         false <- Networks.is_network_admin?(target_user.id, network_id),
         {:ok, updated_user} <- block_user_in_db(target_user, reason) do
      conn
      |> put_status(:ok)
      |> json(%{
        success: true,
        message: "User blocked successfully",
        user: user_to_json_with_blocked(updated_user)
      })
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "User not found"})

      false ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Cannot block yourself or user from another network"})

      true ->
        # This catches both "target_user.id == user.id" and "is_network_admin?" returning true
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Cannot block network administrators"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to block users"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_changeset_errors(changeset)})
    end
  end

  @doc """
  Unblock a user in the network.
  Only accessible to network admins.
  """
  def unblock_user(conn, %{"user_id" => user_id}) do
    alias Castmill.Accounts

    with {:ok, network_id} <- get_admin_network_id(conn),
         target_user when not is_nil(target_user) <- Accounts.get_user(user_id),
         true <- Networks.is_network_member?(target_user.id, network_id),
         {:ok, updated_user} <- unblock_user_in_db(target_user) do
      conn
      |> put_status(:ok)
      |> json(%{
        success: true,
        message: "User unblocked successfully",
        user: user_to_json_with_blocked(updated_user)
      })
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "User not found"})

      false ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "User does not belong to your network"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to unblock users"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_changeset_errors(changeset)})
    end
  end

  @doc """
  Delete a user from the network.
  Only accessible to network admins.
  Network admins cannot be deleted.
  """
  def delete_user(conn, %{"user_id" => user_id}) do
    user = conn.assigns[:current_user]
    alias Castmill.Accounts

    with {:ok, network_id} <- get_admin_network_id(conn),
         target_user when not is_nil(target_user) <- Accounts.get_user(user_id),
         true <- Networks.is_network_member?(target_user.id, network_id),
         false <- target_user.id == user.id,
         false <- Networks.is_network_admin?(target_user.id, network_id),
         {:ok, _} <- Accounts.delete_user(target_user.id) do
      conn
      |> put_status(:ok)
      |> json(%{success: true, message: "User deleted successfully"})
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "User not found"})

      false ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Cannot delete yourself or user from another network"})

      true ->
        # This catches both self-deletion attempts and network admin deletion attempts
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Cannot delete network administrators"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to delete users"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to delete user", reason: inspect(reason)})
    end
  end

  @doc """
  Block an organization in the network.
  Only accessible to network admins.
  """
  def block_organization(conn, %{"organization_id" => org_id} = params) do
    alias Castmill.Organizations

    reason = params["reason"]

    with {:ok, network_id} <- get_admin_network_id(conn),
         organization when not is_nil(organization) <- Organizations.get_organization(org_id),
         true <- organization.network_id == network_id,
         {:ok, updated_org} <- block_organization_in_db(organization, reason) do
      conn
      |> put_status(:ok)
      |> json(%{
        success: true,
        message: "Organization blocked successfully",
        organization: organization_to_json_with_blocked(updated_org)
      })
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Organization not found"})

      false ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Organization does not belong to your network"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to block organizations"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_changeset_errors(changeset)})
    end
  end

  @doc """
  Unblock an organization in the network.
  Only accessible to network admins.
  """
  def unblock_organization(conn, %{"organization_id" => org_id}) do
    alias Castmill.Organizations

    with {:ok, network_id} <- get_admin_network_id(conn),
         organization when not is_nil(organization) <- Organizations.get_organization(org_id),
         true <- organization.network_id == network_id,
         {:ok, updated_org} <- unblock_organization_in_db(organization) do
      conn
      |> put_status(:ok)
      |> json(%{
        success: true,
        message: "Organization unblocked successfully",
        organization: organization_to_json_with_blocked(updated_org)
      })
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Organization not found"})

      false ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Organization does not belong to your network"})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You must be a network admin to unblock organizations"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_changeset_errors(changeset)})
    end
  end

  # ============================================================================
  # Private Functions
  # ============================================================================

  defp get_user_network_admin_status(_user, nil) do
    {:ok, %{is_admin: false, network_id: nil}}
  end

  defp get_user_network_admin_status(user, _network_id) when is_nil(user) do
    {:ok, %{is_admin: false, network_id: nil}}
  end

  defp get_user_network_admin_status(user, network_id) do
    # Check if user is admin of the current network (resolved from Origin)
    if Networks.is_network_admin?(user.id, network_id) do
      {:ok,
       %{
         is_admin: true,
         network_id: network_id,
         access: "admin"
       }}
    else
      {:ok, %{is_admin: false, network_id: nil}}
    end
  end

  @doc """
  Lists the integration settings that apply to an organization of the network
  (declared by the network's widgets) with their current values.
  """
  def list_organization_integration_settings(conn, %{"organization_id" => org_id}) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, organization} <- network_organization(network_id, org_id) do
      json(conn, %{
        data: OrganizationSettings.list_for_organization(network_id, organization.id)
      })
    end
    |> integration_settings_error(conn)
  end

  @doc "Sets an organization's integration settings for one settings key."
  def update_organization_integration_settings(
        conn,
        %{"organization_id" => org_id, "key" => key} = params
      ) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, organization} <- network_organization(network_id, org_id),
         {:ok, settings} <-
           OrganizationSettings.put(
             network_id,
             organization.id,
             key,
             params["settings"],
             conn.assigns[:current_user].id
           ) do
      json(conn, %{data: %{key: key, settings: settings}})
    end
    |> integration_settings_error(conn)
  end

  @doc "Removes an organization's integration settings for one settings key."
  def delete_organization_integration_settings(
        conn,
        %{"organization_id" => org_id, "key" => key}
      ) do
    with {:ok, network_id} <- get_admin_network_id(conn),
         {:ok, organization} <- network_organization(network_id, org_id) do
      :ok = OrganizationSettings.delete(organization.id, key)
      send_resp(conn, :no_content, "")
    end
    |> integration_settings_error(conn)
  end

  defp network_organization(network_id, org_id) do
    with {:ok, uuid} <- Ecto.UUID.cast(org_id),
         %Organization{network_id: ^network_id} = organization <-
           Castmill.Organizations.get_organization(uuid) do
      {:ok, organization}
    else
      _ -> {:error, :organization_not_found}
    end
  end

  defp integration_settings_error(%Plug.Conn{} = conn, _conn), do: conn

  defp integration_settings_error({:error, :not_admin}, conn),
    do: conn |> put_status(:forbidden) |> json(%{error: "You must be a network admin"})

  defp integration_settings_error({:error, :organization_not_found}, conn),
    do: conn |> put_status(:not_found) |> json(%{error: "Organization not found"})

  defp integration_settings_error({:error, :unknown_key}, conn),
    do: conn |> put_status(:not_found) |> json(%{error: "Unknown integration settings"})

  defp integration_settings_error({:error, {:invalid, errors}}, conn),
    do: conn |> put_status(:unprocessable_entity) |> json(%{errors: errors})

  defp get_admin_network_id(conn) do
    user = conn.assigns[:current_user]
    network_id = conn.assigns[:network_id]

    cond do
      is_nil(user) -> {:error, :not_admin}
      is_nil(network_id) -> {:error, :not_admin}
      Networks.is_network_admin?(user.id, network_id) -> {:ok, network_id}
      true -> {:error, :not_admin}
    end
  end

  defp create_organization_for_network(network_id, params) do
    alias Castmill.Organizations

    org_attrs = Map.merge(params, %{"network_id" => network_id})

    # Create the organization without assigning the network admin as org admin
    # The network admin can later invite users to manage the organization
    Organizations.create_organization(org_attrs)
  end

  defp get_network_stats(network_id) do
    organizations = Networks.list_organizations(network_id)
    {_users, users_count} = Networks.list_users(network_id, [])
    devices = Networks.list_devices(network_id)
    teams = Networks.list_teams(network_id)
    total_storage = Networks.get_total_storage(network_id)

    %{
      organizations_count: length(organizations),
      users_count: users_count,
      devices_count: length(devices),
      teams_count: length(teams),
      total_storage_bytes: total_storage
    }
  end

  defp network_to_json(network) do
    %{
      id: network.id,
      name: network.name,
      domain: network.domain,
      email: network.email,
      logo: network.logo,
      copyright: network.copyright,
      default_locale: network.default_locale,
      privacy_policy_url: network.privacy_policy_url,
      invitation_only: network.invitation_only,
      invitation_only_org_admins: network.invitation_only_org_admins,
      meta: network.meta,
      default_plan_id: network.default_plan_id,
      inserted_at: network.inserted_at,
      updated_at: network.updated_at
    }
  end

  defp organization_to_json(org) do
    %{
      id: org.id,
      name: org.name,
      inserted_at: org.inserted_at,
      updated_at: org.updated_at
    }
  end

  defp organization_to_json_with_blocked(org) do
    %{
      id: org.id,
      name: org.name,
      blocked_at: org.blocked_at,
      blocked_reason: org.blocked_reason,
      inserted_at: org.inserted_at,
      updated_at: org.updated_at
    }
  end

  defp user_to_json(user) do
    %{
      id: user.id,
      name: user.name,
      email: user.email,
      blocked_at: user.blocked_at,
      blocked_reason: user.blocked_reason,
      inserted_at: user.inserted_at
    }
  end

  defp user_to_json_with_blocked(user) do
    %{
      id: user.id,
      name: user.name,
      email: user.email,
      blocked_at: user.blocked_at,
      blocked_reason: user.blocked_reason,
      inserted_at: user.inserted_at
    }
  end

  defp invitation_to_json(invitation) do
    organization_name =
      if Ecto.assoc_loaded?(invitation.organization) && invitation.organization do
        invitation.organization.name
      else
        nil
      end

    %{
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organization_id: invitation.organization_id,
      organization_name: organization_name,
      status: invitation.status,
      inserted_at: invitation.inserted_at,
      expires_at: invitation.expires_at
    }
  end

  # Block/unblock helpers
  defp block_user_in_db(user, reason) do
    user
    |> User.block_changeset(%{blocked_at: DateTime.utc_now(), blocked_reason: reason})
    |> Repo.update()
  end

  defp unblock_user_in_db(user) do
    user
    |> User.block_changeset(%{blocked_at: nil, blocked_reason: nil})
    |> Repo.update()
  end

  defp block_organization_in_db(org, reason) do
    org
    |> Organization.block_changeset(%{blocked_at: DateTime.utc_now(), blocked_reason: reason})
    |> Repo.update()
  end

  defp unblock_organization_in_db(org) do
    org
    |> Organization.block_changeset(%{blocked_at: nil, blocked_reason: nil})
    |> Repo.update()
  end

  defp sanitize_params(params) do
    # Only allow specific fields to be updated
    allowed_keys = [
      "name",
      "email",
      "logo",
      "copyright",
      "invitation_only",
      "invitation_only_org_admins",
      "meta"
    ]

    params
    |> Map.take(allowed_keys)
    |> Enum.into(%{}, fn {k, v} -> {String.to_existing_atom(k), v} end)
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end

  defp parse_int(nil, default), do: default

  defp parse_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> max(int, 1)
      :error -> default
    end
  end

  defp parse_int(value, _default) when is_integer(value), do: max(value, 1)
  defp parse_int(_, default), do: default
end
