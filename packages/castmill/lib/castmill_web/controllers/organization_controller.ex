defmodule CastmillWeb.OrganizationController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Networks
  alias Castmill.Organizations
  alias Castmill.Organizations.Organization
  alias Castmill.Organizations.OrganizationsInvitation
  alias Castmill.Plug.AuthorizeDash
  alias Castmill.Accounts
  alias Castmill.Authorization.ResourceAccess

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour

  # ============================================================================
  # Generic Resource Access Control
  # ============================================================================

  # Generic check for listing resources of any type.
  # Expects params: %{"organization_id" => org_id, "resource_type" => resource_type}
  # Resource types: "playlists", "medias", "channels", "devices", "teams", "widgets"
  def check_access(actor_id, :list_resources, %{
        "organization_id" => organization_id,
        "resource_type" => resource_type
      }) do
    resource_atom = String.to_existing_atom(resource_type)
    ResourceAccess.check_resource_access(actor_id, organization_id, resource_atom, :list)
  end

  # Generic check for showing/viewing a single resource.
  def check_access(actor_id, :show_resource, %{
        "organization_id" => organization_id,
        "resource_type" => resource_type
      }) do
    resource_atom = String.to_existing_atom(resource_type)
    ResourceAccess.check_resource_access(actor_id, organization_id, resource_atom, :show)
  end

  # Generic check for creating resources.
  def check_access(actor_id, :create_resource, %{
        "organization_id" => organization_id,
        "resource_type" => resource_type
      }) do
    resource_atom = String.to_existing_atom(resource_type)
    ResourceAccess.check_resource_access(actor_id, organization_id, resource_atom, :create)
  end

  # Generic check for updating resources.
  def check_access(actor_id, :update_resource, %{
        "organization_id" => organization_id,
        "resource_type" => resource_type
      }) do
    resource_atom = String.to_existing_atom(resource_type)
    ResourceAccess.check_resource_access(actor_id, organization_id, resource_atom, :update)
  end

  # Generic check for deleting resources.
  def check_access(actor_id, :delete_resource, %{
        "organization_id" => organization_id,
        "resource_type" => resource_type
      }) do
    resource_atom = String.to_existing_atom(resource_type)
    ResourceAccess.check_resource_access(actor_id, organization_id, resource_atom, :delete)
  end

  # ============================================================================
  # Specific Access Control (Legacy - consider migrating to generic methods)
  # ============================================================================

  def check_access(actor_id, :list_users_organizations, %{"user_id" => user_id}) do
    {:ok, actor_id == user_id}
  end

  # Not really needed other than to explictily show that we don't allow access to this action
  # unless you are the root user.
  def check_access(_actor_id, :list_networks_organizations, _params) do
    {:ok, false}
  end

  def check_access(actor_id, :register_device, %{"organization_id" => organization_id}) do
    if Organizations.has_access(organization_id, actor_id, "devices", :create) do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  def check_access(_actor_id, :list_widgets, %{"organization_id" => _organization_id}) do
    # Normally all users can list widgets, but will not get the same ones.
    {:ok, true}
  end

  def check_access(_actor_id, :get_widget, %{"organization_id" => _organization_id}) do
    # Any authenticated user can view widget details
    {:ok, true}
  end

  def check_access(actor_id, :create_widget, %{"organization_id" => organization_id}) do
    if Organizations.has_access(organization_id, actor_id, "widgets", :create) do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  def check_access(actor_id, :delete_widget, %{"organization_id" => organization_id}) do
    if Organizations.has_access(organization_id, actor_id, "widgets", :delete) do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  def check_access(actor_id, :get_widget_usage, %{"organization_id" => organization_id}) do
    if Organizations.has_access(organization_id, actor_id, "widgets", :delete) do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  def check_access(actor_id, :update_widget, %{"organization_id" => organization_id}) do
    # Only admins can update widgets for now
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :list_members, %{"organization_id" => organization_id}) do
    {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :manager, :member])}
  end

  def check_access(actor_id, :invite_member, %{"organization_id" => organization_id}) do
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :list_invitations, %{"organization_id" => organization_id}) do
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :remove_invitation, %{"organization_id" => organization_id}) do
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :update, %{"id" => organization_id}) do
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :remove_member, %{
        "organization_id" => organization_id,
        "user_id" => user_id
      }) do
    # Allow users to remove themselves OR admins to remove others
    if actor_id == user_id do
      {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :manager, :member])}
    else
      {:ok, Organizations.is_admin?(organization_id, actor_id)}
    end
  end

  def check_access(actor_id, action, %{"token" => token})
      when action in [:show_invitation, :accept_invitation] do
    validInvitation?(actor_id, token)
  end

  def check_access(_actor_id, :reject_invitation, %{"token" => _token}) do
    # Anyone with a valid token can reject an invitation (no auth required)
    {:ok, true}
  end

  # Default implementation for other actions not explicitly handled above
  def check_access(_actor_id, _action, _params) do
    # Default to false or implement your own logic based on other conditions
    {:ok, false}
  end

  plug(AuthorizeDash when action not in [:preview_invitation])

  defp validInvitation?(user_id, token) do
    user = Accounts.get_user(user_id)

    if user == nil do
      {:ok, false}
    else
      case Organizations.get_invitation(token) do
        nil ->
          {:ok, false}

        invitation ->
          if invitation.email == user.email do
            {:ok, true}
          else
            {:ok, false}
          end
      end
    end
  end

  @index_params_schema %{
    organization_id: [type: :string, required: true],
    page: [type: :integer, number: [min: 1]],
    page_size: [type: :integer, number: [min: 1, max: 100]],
    search: :string,
    key: :string,
    direction: :string
  }

  # TODO: We also need a Quota plug to check if the user has enough quota to create resources in
  # the organization. This is not implemented yet.

  def list_users_organizations(conn, %{"user_id" => user_id}) do
    organizations = Organizations.list_user_organizations(user_id)
    render(conn, :index, organizations: organizations)
  end

  def list_networks_organizations(conn, %{"network_id" => network_id}) do
    organizations = Networks.list_organizations(network_id)
    render(conn, :index, organizations: organizations)
  end

  def index(conn, _params) do
    organizations = Organizations.list_organizations()
    render(conn, :index, organizations: organizations)
  end

  def create(conn, %{"organization" => organization_params, "network_id" => network_id}) do
    create_attrs = Map.merge(organization_params, %{"network_id" => network_id})

    with {:ok, %Organization{} = organization} <- Organizations.create_organization(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/organizations/#{organization}")
      |> render(:show, organization: organization)
    end
  end

  def show(conn, %{"id" => id}) do
    organization = Organizations.get_organization!(id)
    render(conn, :show, organization: organization)
  end

  def update(conn, %{"id" => id} = params) do
    organization = Organizations.get_organization!(id)

    with {:ok, %Organization{} = organization} <-
           Organizations.update_organization(organization, params) do
      render(conn, :show, organization: organization)
    end
  end

  def delete(conn, %{"id" => id}) do
    organization = Organizations.get_organization!(id)

    with {:ok, %Organization{}} <- Organizations.delete_organization(organization) do
      send_resp(conn, :no_content, "")
    end
  end

  # Devices (Maybe this should be in a separate controller)
  @doc """
    Creates a device and adds it to an organization.
  """
  def register_device(conn, %{
        "name" => name,
        "pincode" => pincode,
        "organization_id" => organization_id
      }) do
    case Castmill.Devices.register_device(organization_id, pincode, %{name: name}, %{
           add_default_channel: true
         }) do
      {:ok, {device, _token}} ->
        # Send notification to organization members about new device
        Castmill.Notifications.Events.notify_device_registration(
          device.name,
          device.id,
          organization_id
        )

        conn
        |> put_status(:created)
        |> put_resp_header("location", ~p"/devices/#{device.id}")
        |> json(device)

      {:error, :quota_exceeded} ->
        conn
        |> put_status(:forbidden)
        |> json(%{errors: %{quota: ["Device quota exceeded"]}})

      {:error, _} = error ->
        {:error, error}
    end
  end

  # List all the widgets available an organization
  def list_widgets(conn, %{"organization_id" => _organization_id} = params) do
    # Note: for now we return all widgets, but we should only return the widgets that are available
    # for the organization (some widgets are available to all organizations though).

    # Extract pagination, search, and sorting parameters
    query_params = %{
      page: String.to_integer(params["page"] || "1"),
      page_size: String.to_integer(params["page_size"] || "10"),
      search: params["search"],
      key: params["key"] || "name",
      direction: params["direction"] || "ascending"
    }

    widgets = Castmill.Widgets.list_widgets(query_params)
    count = Castmill.Widgets.count_widgets(query_params)

    response = %{
      data: widgets,
      count: count
    }

    conn
    |> put_status(:ok)
    |> json(response)
  end

  # Get a widget by its ID
  def get_widget(conn, %{"organization_id" => _organization_id, "widget_id" => widget_id}) do
    case Castmill.Widgets.get_widget(widget_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{errors: %{detail: "Widget not found"}})

      widget ->
        conn
        |> put_status(:ok)
        |> json(%{data: widget})
    end
  end

  def create_widget(conn, %{"organization_id" => _organization_id, "widget" => widget_file}) do
    alias Castmill.Widgets.PackageProcessor
    alias Castmill.Widgets.AssetStorage

    with {:ok, widget_data, assets} <- PackageProcessor.process_upload(widget_file),
         # Get the slug from widget data (or generate one from name)
         widget_slug <- widget_data["slug"] || slugify(widget_data["name"]),
         # Store assets permanently
         {:ok, stored_assets} <- AssetStorage.store_assets(widget_slug, assets),
         # Resolve icon path to full URL
         widget_data <- resolve_widget_icon(widget_data, widget_slug, stored_assets),
         # Extract and resolve fonts from widget assets
         widget_data <- resolve_widget_fonts(widget_data, widget_slug, stored_assets),
         # Store integration definition in meta for later use
         widget_data <- store_integration_in_meta(widget_data),
         {:ok, widget} <- Castmill.Widgets.create_widget(widget_data) do
      # Clean up temporary asset files
      PackageProcessor.cleanup_assets(assets)

      conn
      |> put_status(:created)
      |> json(widget)
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        # Convert changeset errors to a serializable format
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
            Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
              opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
            end)
          end)

        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: errors})

      {:error, reason} when is_binary(reason) ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: reason})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: inspect(reason)})
    end
  end

  defp slugify(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.trim("-")
  end

  defp slugify(_), do: "widget-#{:rand.uniform(100_000)}"

  defp resolve_widget_icon(widget_data, widget_slug, stored_assets) do
    case widget_data["icon"] do
      nil ->
        widget_data

      icon when is_binary(icon) ->
        resolved_icon =
          Castmill.Widgets.AssetStorage.resolve_icon(icon, widget_slug, stored_assets)

        Map.put(widget_data, "icon", resolved_icon)

      _ ->
        widget_data
    end
  end

  defp resolve_widget_fonts(widget_data, widget_slug, stored_assets) do
    fonts = Castmill.Widgets.AssetStorage.extract_fonts(widget_data, widget_slug, stored_assets)

    if Enum.empty?(fonts) do
      widget_data
    else
      Map.put(widget_data, "fonts", fonts)
    end
  end

  # Stores the integration definition from widget.json into the meta field
  # so it can be used later when the widget is added to a playlist
  defp store_integration_in_meta(widget_data) do
    integration = Map.get(widget_data, "integration")

    if is_map(integration) do
      # Merge integration into meta (create meta if it doesn't exist)
      current_meta = Map.get(widget_data, "meta") || %{}
      updated_meta = Map.put(current_meta, "integration", integration)
      Map.put(widget_data, "meta", updated_meta)
    else
      widget_data
    end
  end

  @doc """
  Gets the usage information for a widget, showing all playlists where it's being used.
  """
  def get_widget_usage(conn, %{"organization_id" => _organization_id, "widget_id" => widget_id}) do
    case Castmill.Widgets.get_widget(widget_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Widget not found"})

      _widget ->
        usage = Castmill.Widgets.get_widget_usage(widget_id)

        conn
        |> put_status(:ok)
        |> json(%{data: usage, count: length(usage)})
    end
  end

  def delete_widget(conn, %{"organization_id" => _organization_id, "widget_id" => widget_id}) do
    with widget when not is_nil(widget) <- Castmill.Widgets.get_widget(widget_id),
         {:ok, _} <- Castmill.Widgets.delete_widget_with_cascade(widget) do
      # Also delete the widget's assets
      Castmill.Widgets.AssetStorage.delete_assets(widget.slug)
      send_resp(conn, :no_content, "")
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Widget not found"})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: to_string(reason)})
    end
  end

  def update_widget(
        conn,
        %{"organization_id" => _organization_id, "widget_id" => widget_id} = params
      ) do
    with widget when not is_nil(widget) <- Castmill.Widgets.get_widget(widget_id),
         {:ok, updated_widget} <- Castmill.Widgets.update_widget(widget, params) do
      conn
      |> put_status(:ok)
      |> json(updated_widget)
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Widget not found"})

      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: changeset})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: to_string(reason)})
    end
  end

  def list_members(conn, params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      response = %{
        data: Organizations.list_users(params),
        count: Organizations.count_users(params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def invite_member(conn, %{
        "organization_id" => organization_id,
        "email" => email,
        "role" => role
      }) do
    case Organizations.invite_user(organization_id, email, role) do
      {:ok, _} ->
        conn
        |> put_status(:created)
        |> json(%{})

      {:error, %Ecto.Changeset{} = changeset} ->
        # Return errors only
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} ->
            # Optionally translate or localize your error messages here
            # For now, just return the raw msg
            msg
          end)

        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: errors})

      {:error, msg} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: msg})
    end
  end

  def list_invitations(conn, params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      response = %{
        data: Organizations.list_invitations(params),
        count: Organizations.count_invitations(params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def remove_member(conn, %{
        "organization_id" => organization_id,
        "user_id" => user_id
      }) do
    case Organizations.remove_user(organization_id, user_id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, :last_admin} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "cannot_remove_last_organization_admin"})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "member_not_found"})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def show_invitation(conn, %{"token" => token}) do
    conn
    |> put_status(:ok)
    |> json(Organizations.get_invitation(token))
  end

  # Public endpoint to preview invitation and check if user exists (no auth required)
  def preview_invitation(conn, %{"token" => token}) do
    case Organizations.get_invitation(token) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Invalid or expired invitation"})

      invitation ->
        # Check if user with this email exists
        user_exists = Accounts.get_user_by_email(invitation.email) != nil

        conn
        |> put_status(:ok)
        |> json(%{
          email: invitation.email,
          organization_name: invitation.organization.name,
          organization_id: invitation.organization_id,
          status: invitation.status,
          expires_at: invitation.expires_at,
          user_exists: user_exists,
          expired: OrganizationsInvitation.expired?(invitation)
        })
    end
  end

  def accept_invitation(conn, %{"token" => token}) do
    current_user = conn.assigns[:current_user]

    case Organizations.accept_invitation(token, current_user.id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, %Ecto.Changeset{} = changeset} ->
        # Return errors only
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} ->
            # Optionally translate or localize your error messages here
            # For now, just return the raw msg
            msg
          end)

        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: errors})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def reject_invitation(conn, %{"token" => token}) do
    case Organizations.reject_invitation(token) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, message} when is_binary(message) ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: message})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def remove_invitation(conn, %{
        "organization_id" => organization_id,
        "invitation_id" => invitation_id
      }) do
    case Organizations.remove_invitation_from_organization(organization_id, invitation_id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end
end
