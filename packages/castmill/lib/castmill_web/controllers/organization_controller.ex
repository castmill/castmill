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

  # Members list/show the widgets available to their organization (see list_widgets/2).
  def check_access(actor_id, :list_widgets, %{"organization_id" => organization_id}) do
    {:ok, Organizations.has_access(organization_id, actor_id, "widgets", :list)}
  end

  def check_access(actor_id, :get_widget, %{"organization_id" => organization_id}) do
    {:ok, Organizations.has_access(organization_id, actor_id, "widgets", :show)}
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

  def check_access(actor_id, :complete_onboarding, %{"organization_id" => organization_id}) do
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
    network_id = conn.assigns[:network_id]
    organizations = Organizations.list_user_organizations(user_id, network_id)
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

  def complete_onboarding(conn, %{"organization_id" => id, "name" => name}) do
    with {:ok, %Organization{} = organization} <-
           Organizations.complete_onboarding(id, name) do
      render(conn, :show, organization: organization)
    else
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Organization not found"})

      {:error, %Ecto.Changeset{} = changeset} ->
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
            Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
              opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
            end)
          end)

        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: errors})
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

      {:error, :invalid_pincode} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{pincode: ["Invalid pincode"]}})

      {:error, :pincode_expired} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{pincode: ["Pincode has expired"]}})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_view(CastmillWeb.ChangesetJSON)
        |> render("error.json", changeset: changeset)
    end
  end

  # Lists the widgets available to the organization: its own, its network's and system
  # widgets (restricted ones only when enabled for it).
  def list_widgets(conn, %{"organization_id" => organization_id} = params) do
    # Extract pagination, search, and sorting parameters
    query_params = %{
      page: String.to_integer(params["page"] || "1"),
      page_size: String.to_integer(params["page_size"] || "10"),
      search: params["search"],
      key: params["key"] || "name",
      direction: params["direction"] || "ascending"
    }

    widgets = Castmill.Widgets.list_available_widgets(organization_id, query_params)
    count = Castmill.Widgets.count_available_widgets(organization_id, query_params)

    response = %{
      data: widgets,
      count: count
    }

    conn
    |> put_status(:ok)
    |> json(response)
  end

  # Get a widget by its ID
  def get_widget(conn, %{"organization_id" => organization_id, "widget_id" => widget_id}) do
    case Castmill.Widgets.get_available_widget(organization_id, widget_id) do
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

  def create_widget(conn, %{"organization_id" => organization_id, "widget" => widget_file}) do
    alias Castmill.Widgets.PackageProcessor

    case PackageProcessor.process_upload(widget_file) do
      {:ok, widget_data, assets} ->
        # Extracted assets are temporary: remove them whether the upload succeeds or not.
        try do
          create_widget_from_package(conn, organization_id, widget_data, assets)
        after
          PackageProcessor.cleanup_assets(assets)
        end

      error ->
        render_create_widget_error(conn, error)
    end
  end

  defp create_widget_from_package(conn, organization_id, widget_data, assets) do
    # Get the slug from widget data (or generate one from name)
    widget_slug = widget_data["slug"] || slugify(widget_data["name"])
    # Store integration definition in meta for later use
    widget_data = widget_data |> Map.put("slug", widget_slug) |> store_integration_in_meta()

    # Early, friendly check; the insert below is what actually reserves the slug.
    with :ok <- ensure_slug_available(widget_slug),
         {:ok, widget} <-
           create_widget_with_assets(organization_id, widget_data, widget_slug, assets) do
      conn
      |> put_status(:created)
      |> json(with_template_warnings(Castmill.Widgets.put_access(widget, organization_id)))
    else
      error -> render_create_widget_error(conn, error)
    end
  end

  defp render_create_widget_error(conn, error) do
    case error do
      {:error, :slug_taken} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{slug: ["has already been taken"]}})

      {:error, :invalid_slug} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{slug: ["has invalid format"]}})

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

  defp ensure_slug_available(slug) do
    cond do
      not Castmill.Widgets.AssetStorage.valid_slug?(slug) -> {:error, :invalid_slug}
      Castmill.Widgets.get_widget_by_slug(slug) -> {:error, :slug_taken}
      true -> :ok
    end
  end

  # Inserting the widget first reserves its slug (unique index): a concurrent upload of
  # the same slug waits on it and fails before touching storage. So only this upload
  # writes the slug's assets directory, and only it removes it again on failure.
  defp create_widget_with_assets(organization_id, widget_data, widget_slug, assets) do
    alias Castmill.Widgets.AssetStorage

    Castmill.Repo.transaction(fn ->
      case Castmill.Widgets.create_organization_widget(organization_id, widget_data) do
        {:ok, widget} ->
          case store_widget_assets(widget, widget_data, widget_slug, assets) do
            {:ok, widget} ->
              widget

            {:error, reason} ->
              AssetStorage.delete_assets(widget_slug)
              Castmill.Repo.rollback(reason)
          end

        {:error, reason} ->
          Castmill.Repo.rollback(reason)
      end
    end)
  end

  defp store_widget_assets(widget, widget_data, widget_slug, assets) do
    alias Castmill.Widgets.PackageProcessor

    with {:ok, stored_assets} <-
           Castmill.Widgets.AssetStorage.store_assets(widget_slug, assets),
         {:ok, referenced} <-
           PackageProcessor.resolve_asset_references(widget_data, fn path ->
             get_in(stored_assets, [:files, path, :url])
           end) do
      resolved =
        referenced
        |> resolve_widget_icon(widget_slug, stored_assets)
        |> resolve_widget_fonts(widget_slug, stored_assets)

      widget
      |> Ecto.Changeset.change(
        icon: resolved["icon"],
        fonts: resolved["fonts"] || widget.fonts,
        template: resolved["template"]
      )
      |> Castmill.Repo.update()
    end
  end

  # Likely template mistakes that are not errors, e.g. a format text missing its
  # {"fmt": …} wrapper, are returned to the uploader as "template_warnings".
  defp with_template_warnings(widget) do
    case Castmill.Widgets.TemplateBindings.check(widget.template) do
      {_errors, []} ->
        widget

      {_errors, warnings} ->
        widget
        |> Jason.encode!()
        |> Jason.decode!()
        |> Map.put(
          "template_warnings",
          Enum.map(warnings, &Castmill.Widgets.TemplateBindings.describe/1)
        )
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
  def get_widget_usage(conn, %{"organization_id" => organization_id, "widget_id" => widget_id}) do
    case Castmill.Widgets.get_available_widget(organization_id, widget_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Widget not found"})

      widget ->
        # Only this organization's playlists.
        usage = Castmill.Widgets.get_widget_usage(widget.id, organization_id)

        conn
        |> put_status(:ok)
        |> json(%{data: usage, count: length(usage)})
    end
  end

  # Organizations can only delete widgets they own; system and network widgets are
  # managed elsewhere. Other widgets are reported as not found.
  def delete_widget(conn, %{"organization_id" => organization_id, "widget_id" => widget_id}) do
    with widget when not is_nil(widget) <-
           Castmill.Widgets.get_organization_widget(organization_id, widget_id),
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

  # Organizations can only update their own widgets, and only name/description.
  def update_widget(
        conn,
        %{"organization_id" => organization_id, "widget_id" => widget_id} = params
      ) do
    with widget when not is_nil(widget) <-
           Castmill.Widgets.get_organization_widget(organization_id, widget_id),
         {:ok, updated_widget} <- Castmill.Widgets.update_organization_widget(widget, params) do
      conn
      |> put_status(:ok)
      |> json(Castmill.Widgets.put_access(updated_widget, organization_id))
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Widget not found"})

      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_view(CastmillWeb.ChangesetJSON)
        |> render("error.json", changeset: changeset)

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
