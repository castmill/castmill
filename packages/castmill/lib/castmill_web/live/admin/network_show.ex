defmodule CastmillWeb.Live.Admin.NetworkShow do
  use CastmillWeb, :live_view
  alias Castmill.Networks
  alias Castmill.Organizations
  alias Castmill.Widgets.Integrations

  import CastmillWeb.Live.Admin.Show
  import CastmillWeb.Live.Admin.Tabs
  import CastmillWeb.Live.Admin.IntegrationsTable

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:cols, [
        %{
          name: "ID",
          field: :id
        },
        %{
          name: "Email",
          field: :email
        },
        %{
          name: "Domain",
          field: :domain
        },
        %{
          name: "Created",
          field: :inserted_at
        }
      ])
      |> assign(:tabs, [
        %{
          name: "Organizations",
          icon: "hero-globe-alt-solid",
          href: "organizations",
          form: CastmillWeb.Live.Admin.OrganizationForm
        },
        %{
          name: "Invitations",
          icon: "hero-envelope-solid",
          href: "invitations",
          form: CastmillWeb.Live.Admin.NetworkInvitationForm
        },
        %{
          name: "Teams",
          icon: "hero-user-group-solid",
          href: "teams",
          form: nil
        },
        %{
          name: "Users",
          icon: "hero-users-solid",
          href: "users",
          form: nil
        },
        %{
          name: "Admins",
          icon: "hero-shield-check-solid",
          href: "admins",
          form: nil
        },
        %{
          name: "Devices",
          icon: "hero-computer-desktop-solid",
          href: "devices",
          form: nil
        },
        %{
          name: "Channels",
          icon: "hero-channel-days-solid",
          href: "channels",
          form: nil
        },
        %{
          name: "Playlists",
          icon: "hero-play-solid",
          href: "playlists",
          form: nil
        },
        %{
          name: "Medias",
          icon: "hero-photo-solid",
          href: "medias",
          form: nil
        },
        %{
          name: "Widgets",
          icon: "hero-cog-solid",
          href: "widgets",
          form: nil
        },
        %{
          name: "Integrations",
          icon: "hero-puzzle-piece-solid",
          href: "integrations",
          form: nil
        }
      ])
      |> assign(:selected_tab, nil)
      |> assign(:selected_integration, nil)

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div>
      <%= if @selected_tab == "integrations" do %>
        <.render_integrations_view
          resource={@resource}
          cols={@cols}
          tabs={@tabs}
          selected_tab={@selected_tab}
          base_url={@base_url}
          resource_cols={@resource_cols}
          rows={if Map.has_key?(assigns, :streams), do: @streams.rows, else: []}
          live_action={@live_action}
          page_title={@page_title}
        />
      <% else %>
        <.show_details
          form_module={CastmillWeb.Live.Admin.NetworkForm}
          id={@resource.id}
          type="Network"
          bucket="networks"
          title={@page_title}
          live_action={@live_action}
          resource={@resource}
          cols={@cols}
          resource_cols={@resource_cols}
          tabs={@tabs}
          selected_tab={@selected_tab}
          base_url={@base_url}
          rows={if Map.has_key?(assigns, :streams), do: @streams.rows, else: []}
          base_resource_url={
            if Map.has_key?(assigns, :base_resource_url), do: @base_resource_url, else: nil
          }
        />
      <% end %>
      <!-- Integration Configuration Modal -->
      <.modal
        :if={@live_action == :configure_integration && @selected_integration != nil}
        id="integration-modal"
        show
        on_cancel={JS.patch(~p"/admin/networks/#{@resource}/integrations")}
      >
        <.live_component
          module={CastmillWeb.Live.Admin.NetworkIntegrationForm}
          id={@selected_integration.id}
          integration={@selected_integration}
          network_id={@resource.id}
          patch={~p"/admin/networks/#{@resource}/integrations"}
        />
      </.modal>
    </div>
    """
  end

  defp render_integrations_view(assigns) do
    ~H"""
    <div>
      <.header>
        Network <%= @resource.name %>
        <:subtitle>Configure widget integrations for this network</:subtitle>
        <:actions>
          <.link patch={~p"/admin/networks/#{@resource}/show/edit"} phx-click={JS.push_focus()}>
            <.button>Edit Network</.button>
          </.link>
        </:actions>
      </.header>

      <.list>
        <:item :for={col <- @cols} title={col.name}><%= Map.get(@resource, col.field, "") %></:item>
      </.list>

      <div class="mt-8">
        <div class="text-lg font-semibold leading-8 text-blue-400">
          Resources
        </div>
        <.tabs tabs={@tabs} selected_tab={@selected_tab} base_url={@base_url}>
          <div class="p-2">
            <div class="mb-4">
              <p class="text-sm text-gray-600">
                Configure OAuth credentials and API keys for third-party widget integrations.
                These credentials will be available to all organizations in this network.
              </p>
            </div>
            <.integrations_table network_id={@resource.id} cols={@resource_cols} rows={@rows} />
          </div>
        </.tabs>
      </div>
      <.back navigate={~p"/admin/networks"}>Back to networks</.back>

      <.modal
        :if={@live_action == :edit}
        id="resource-modal"
        show
        on_cancel={JS.patch(~p"/admin/networks/#{@resource}")}
      >
        <.live_component
          module={CastmillWeb.Live.Admin.NetworkForm}
          id={@resource.id}
          title={@page_title}
          action={@live_action}
          resource={@resource}
          patch={~p"/admin/networks/#{@resource}"}
        />
      </.modal>
    </div>
    """
  end

  @impl true
  def handle_params(%{"id" => id, "integration_id" => integration_id}, uri, socket) do
    # First load the base network info
    {:noreply, socket} = handle_params(%{"id" => id}, uri, socket)

    # Load integration with widget info
    integration = Integrations.get_integration(integration_id)
    integration = if integration, do: Castmill.Repo.preload(integration, :widget), else: nil

    # Load integrations tab content
    {rows, cols} = resources_for_network(id, "integrations")

    {:noreply,
     socket
     |> assign(:selected_integration, integration)
     |> assign(:selected_tab, "integrations")
     |> assign(:base_resource_url, nil)
     |> maybe_stream(:rows, rows)
     |> assign(:resource_cols, cols)}
  end

  def handle_params(%{"id" => id, "resource" => resource}, uri, socket) do
    {:noreply, socket} = handle_params(%{"id" => id}, uri, socket)

    {rows, cols} = resources_for_network(id, resource)

    # Some resources (like invitations) don't have individual detail pages
    base_resource_url =
      case resource do
        "invitations" -> nil
        _ -> ~p"/admin/#{resource}"
      end

    {:noreply,
     socket
     |> assign(:selected_integration, nil)
     |> assign(:base_resource_url, base_resource_url)
     |> reset_stream(:rows, rows)
     |> assign(:selected_tab, resource)
     |> assign(:resource_cols, cols)}
  end

  def handle_params(%{"id" => id}, _, socket) do
    {:noreply,
     socket
     |> assign(:page_title, page_title(socket.assigns.live_action))
     |> assign(:selected_link, "networks")
     |> assign(:resource, Networks.get_network(id))
     |> assign(:resource_cols, [])
     |> assign(:base_url, ~p"/admin/networks/#{id}")}
  end

  # When a child resource is created we need to update the stream for the resources.
  @impl true
  def handle_info({CastmillWeb.Live.Admin.OrganizationForm, {:created, resource}}, socket) do
    {:noreply, stream_insert(socket, :rows, resource)}
  end

  # Handle network invitation form events
  def handle_info({CastmillWeb.Live.Admin.NetworkInvitationForm, {:invited, _email}}, socket) do
    # Refresh the invitations list
    {rows, _cols} = resources_for_network(socket.assigns.resource.id, "invitations")

    {:noreply,
     socket
     |> stream(:rows, rows, reset: true)}
  end

  # Handle integration form events
  def handle_info(
        {CastmillWeb.Live.Admin.NetworkIntegrationForm, {:saved, _integration_id}},
        socket
      ) do
    # Refresh the integrations list
    {rows, _cols} = resources_for_network(socket.assigns.resource.id, "integrations")

    {:noreply,
     socket
     |> assign(:selected_integration, nil)
     |> stream(:rows, rows, reset: true)}
  end

  def handle_info(
        {CastmillWeb.Live.Admin.NetworkIntegrationForm, {:deleted, _integration_id}},
        socket
      ) do
    # Refresh the integrations list
    {rows, _cols} = resources_for_network(socket.assigns.resource.id, "integrations")

    {:noreply,
     socket
     |> assign(:selected_integration, nil)
     |> stream(:rows, rows, reset: true)}
  end

  # def handle_info(_params, socket), do: {:noreply, socket}

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "organizations"}, socket) do
    organization = Organizations.get_organization!(id)
    {:ok, _} = Organizations.delete_organization(organization)

    {:noreply, stream_delete(socket, :rows, organization)}
  end

  def handle_event("delete", %{"id" => id, "resource" => "invitations"}, socket) do
    case Networks.delete_network_invitation(id) do
      {:ok, invitation} ->
        {:noreply, stream_delete(socket, :rows, invitation)}

      {:error, _} ->
        {:noreply, put_flash(socket, :error, "Failed to delete invitation")}
    end
  end

  def handle_event("promote_to_admin", %{"id" => user_id}, socket) do
    network_id = socket.assigns.resource.id

    case Networks.promote_to_network_admin(user_id, network_id) do
      {:ok, _} ->
        {:noreply,
         socket
         |> put_flash(:info, "User promoted to network admin")}

      {:error, :user_not_found} ->
        {:noreply, put_flash(socket, :error, "User not found")}

      {:error, :user_not_in_network} ->
        {:noreply, put_flash(socket, :error, "User does not belong to this network")}

      {:error, _} ->
        {:noreply, put_flash(socket, :error, "Failed to promote user")}
    end
  end

  def handle_event("demote_from_admin", %{"id" => user_id}, socket) do
    network_id = socket.assigns.resource.id

    case Networks.demote_from_network_admin(user_id, network_id) do
      {:ok, _} ->
        # Refresh the admins list
        {rows, _cols} = resources_for_network(network_id, "admins")

        {:noreply,
         socket
         |> stream(:rows, rows, reset: true)
         |> put_flash(:info, "User demoted from network admin")}

      {:error, :not_admin} ->
        {:noreply, put_flash(socket, :error, "User is not an admin")}

      {:error, _} ->
        {:noreply, put_flash(socket, :error, "Failed to demote user")}
    end
  end

  # TODO: This is a hack to avoid a bug in streams until the :reset option
  # is implemented in LiveView 0.19.0
  defp maybe_stream(socket, key, data) do
    with %{:assigns => %{:streams => %{^key => _data}}} <- socket do
      socket
    else
      _ -> stream(socket, key, data)
    end
  end

  # Reset stream with new data - handles both existing and new streams
  #
  # LIVEVIEW VERSION CONSTRAINT (0.18.x):
  # In LiveView 0.18.x, streams don't support `reset: true` on an existing stream.
  # We work around this by manually deleting all existing items and re-inserting new ones.
  #
  # This approach is inefficient for large datasets (O(n) deletions + O(n) insertions)
  # because each operation triggers DOM updates.
  #
  # TODO: When upgrading to LiveView 0.20+, simplify this to:
  #   stream(socket, key, data, reset: true)
  # which efficiently replaces all stream items in a single operation.
  # See: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#stream/4
  defp reset_stream(socket, key, data) do
    case socket.assigns do
      %{:streams => %{^key => existing_stream}} ->
        # Stream exists - get current items and delete them, then insert new ones
        # First delete all existing items
        socket_cleared =
          existing_stream
          |> Enum.reduce(socket, fn {_dom_id, item}, acc ->
            stream_delete(acc, key, item)
          end)

        # Then insert new items
        Enum.reduce(data, socket_cleared, fn item, acc ->
          stream_insert(acc, key, item, at: -1)
        end)

      _ ->
        # Stream doesn't exist yet, create it
        stream(socket, key, data)
    end
  end

  defp page_title(:show), do: "Show Network"
  defp page_title(:edit), do: "Edit Network"
  defp page_title(:new), do: "New Network"
  defp page_title(:configure_integration), do: "Configure Integration"

  defp resources_for_network(network_id, "organizations") do
    {Networks.list_organizations(network_id) || [],
     [
       %{
         name: "ID",
         field: :id
       },
       %{
         name: "Name",
         field: :name
       },
       %{
         name: "Created",
         field: :inserted_at
       }
     ]}
  end

  defp resources_for_network(network_id, "teams") do
    {Networks.list_teams(network_id) || [],
     [
       %{
         name: "ID",
         field: :id
       },
       %{
         name: "Name",
         field: :name
       },
       %{
         name: "Created",
         field: :inserted_at
       }
     ]}
  end

  defp resources_for_network(network_id, "users") do
    {Networks.list_users(network_id) || [],
     [
       %{
         name: "ID",
         field: :id
       },
       %{
         name: "Name",
         field: :name
       },
       %{
         name: "Email",
         field: :email
       },
       %{
         name: "Created",
         field: :inserted_at
       }
     ]}
  end

  defp resources_for_network(network_id, "admins") do
    {Networks.list_network_admins(network_id) || [],
     [
       %{
         name: "ID",
         field: :id
       },
       %{
         name: "Name",
         field: :name
       },
       %{
         name: "Email",
         field: :email
       },
       %{
         name: "Created",
         field: :inserted_at
       }
     ]}
  end

  defp resources_for_network(network_id, "devices") do
    {Networks.list_devices(network_id) || [],
     [
       %{
         name: "ID",
         field: :id
       },
       %{
         name: "Name",
         field: :name
       },
       %{
         name: "Created",
         field: :inserted_at
       }
     ]}
  end

  defp resources_for_network(network_id, "integrations") do
    # List all system widget integrations that require credentials
    integrations = Integrations.list_system_integrations_requiring_credentials()

    # Enrich with network credential status
    rows =
      Enum.map(integrations, fn integration ->
        has_credentials = Integrations.has_network_credentials?(network_id, integration.id)

        %{
          id: integration.id,
          name: integration.name,
          widget_name: integration.widget.name,
          description: integration.description,
          status: if(has_credentials, do: "Configured", else: "Not Configured"),
          is_configured: has_credentials
        }
      end)

    {rows,
     [
       %{
         name: "Integration",
         field: :name
       },
       %{
         name: "Widget",
         field: :widget_name
       },
       %{
         name: "Status",
         field: :status
       }
     ]}
  end

  defp resources_for_network(network_id, "invitations") do
    {Networks.list_network_invitations(network_id) || [],
     [
       %{
         name: "Email",
         field: :email
       },
       %{
         name: "Organization Name",
         field: :organization_name
       },
       %{
         name: "Status",
         field: :status
       },
       %{
         name: "Created",
         field: :inserted_at
       },
       %{
         name: "Expires",
         field: :expires_at
       }
     ]}
  end
end
