defmodule CastmillWeb.OrganizationController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Networks
  alias Castmill.Organizations
  alias Castmill.Organizations.Organization
  alias Castmill.Plug.AuthorizeDash
  alias Castmill.Accounts

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, :list_users_organizations, %{"user_id" => user_id}) do
    {:ok, actor_id == user_id}
  end

  # Not really needed other than to explictily show that we don't allow access to this action
  # unless you are the root user.
  def check_access(_actor_id, :list_networks_organizations, _params) do
    {:ok, false}
  end

  def check_access(actor_id, :register_device, %{"organization_id" => organization_id}) do
    if Organizations.has_access(organization_id, actor_id, "devices", "register") do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  def check_access(_actor_id, :list_widgets, %{"organization_id" => _organization_id}) do
    # Normally all users can list widgets, but will not get the same ones.
    {:ok, true}
  end

  def check_access(actor_id, :create_widget, %{"organization_id" => organization_id}) do
    # Only admins can create widgets for now
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :delete_widget, %{"organization_id" => organization_id}) do
    # Only admins can delete widgets for now
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :update_widget, %{"organization_id" => organization_id}) do
    # Only admins can update widgets for now
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :list_members, %{"organization_id" => organization_id}) do
    {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :regular])}
  end

  def check_access(actor_id, :invite_member, %{"organization_id" => organization_id}) do
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :list_invitations, %{"organization_id" => organization_id}) do
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, :update, %{"id" => organization_id}) do
    {:ok, Organizations.is_admin?(organization_id, actor_id)}
  end

  def check_access(actor_id, action, %{"token" => token})
      when action in [:show_invitation, :accept_invitation] do
    validInvitation?(actor_id, token)
  end

  # Default implementation for other actions not explicitly handled above
  def check_access(_actor_id, _action, _params) do
    # Default to false or implement your own logic based on other conditions
    {:ok, false}
  end

  plug(AuthorizeDash)

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
    search: :string
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
    with {:ok, {device, _token}} <-
           Castmill.Devices.register_device(organization_id, pincode, %{name: name}, %{
             add_default_channel: true
           }) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/devices/#{device.id}")
      |> json(device)
    end
  end

  # List all the widgets available an organization
  def list_widgets(conn, %{"organization_id" => _organization_id}) do
    # Note: for now we return all widgets, but we should only return the widgets that are available
    # for the organization (some widgets are available to all organizations though).
    widgets = Castmill.Widgets.list_widgets()

    conn
    |> put_status(:ok)
    |> json(widgets)
  end

  def create_widget(conn, %{"organization_id" => _organization_id, "widget" => widget_file}) do
    with {:ok, content} <- File.read(widget_file.path),
         {:ok, widget_data} <- Jason.decode(content),
         {:ok, widget} <- Castmill.Widgets.create_widget(widget_data) do
      conn
      |> put_status(:created)
      |> json(widget)
    else
      {:error, :enoent} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Failed to read uploaded file"})

      {:error, %Jason.DecodeError{}} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid JSON format"})

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

  def delete_widget(conn, %{"organization_id" => _organization_id, "widget_id" => widget_id}) do
    with widget when not is_nil(widget) <- Castmill.Widgets.get_widget(widget_id),
         {:ok, _} <- Castmill.Widgets.delete_widget(widget) do
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

  def update_widget(conn, %{"organization_id" => _organization_id, "widget_id" => widget_id} = params) do
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

  def show_invitation(conn, %{"token" => token}) do
    conn
    |> put_status(:ok)
    |> json(Organizations.get_invitation(token))
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
end
