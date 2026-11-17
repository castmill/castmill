defmodule CastmillWeb.Live.Admin.NetworkShow do
  use CastmillWeb, :live_view
  alias Castmill.Accounts
  alias Castmill.Networks
  alias Castmill.Organizations
  alias Castmill.Widgets.Integrations
  alias CastmillWeb.Live.Admin.TabSearch
  require Logger

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
      |> assign(:setup_link, nil)

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
          actions={tab_actions(@selected_tab)}
        >
          <:tab_hint :if={@selected_tab == "users"}>
            To add an administrator, use the
            <.link href={~p"/admin/networks/#{@resource.id}/admins"} class="underline">
              Admins
            </.link>
            tab: they are emailed a link to create a passkey and sign in. To give a new person
            their own organization, invite them on the
            <.link href={~p"/admin/networks/#{@resource.id}/invitations"} class="underline">
              Invitations
            </.link>
            tab.
          </:tab_hint>
          <:resource_content :if={@selected_tab == "admins"}>
            <form id="network-admin-form" phx-submit="add_network_admin" class="py-4">
              <p class="mb-2 text-sm text-gray-300">
                Add a person by email, with or without a Castmill account. They become an admin of
                this network and are emailed a link to create a passkey for <%= Networks.dashboard_url(
                  @resource
                ) %> and sign in. If the email does not arrive, use Show setup link and send them
                the link yourself.
              </p>
              <label for="network-admin-email" class="block text-sm font-semibold">Email</label>
              <input
                id="network-admin-email"
                name="email"
                type="email"
                required
                class="mt-2 rounded-md text-gray-900"
              />
              <.button>Add admin</.button>
            </form>
            <div
              :if={@setup_link}
              id="admin-setup-link"
              class="mb-4 rounded-md border border-gray-600 p-3"
            >
              <p class="mb-2 text-sm text-gray-300">
                Setup link for <%= @setup_link.email %>. Send it only to them: anyone with it can
                create a passkey for this account. It works once and expires in 7 days.
              </p>
              <div class="flex items-center gap-2">
                <input
                  id="admin-setup-link-url"
                  aria-label={"Setup link for #{@setup_link.email}"}
                  type="text"
                  readonly
                  value={@setup_link.url}
                  class="flex-1 rounded-md text-gray-900"
                />
                <.button
                  type="button"
                  phx-click={JS.dispatch("castmill:copy", to: "#admin-setup-link-url")}
                >
                  Copy
                </.button>
              </div>
            </div>
            <.table id="network-admins" rows={@streams.rows} row_item={fn {_dom_id, user} -> user end}>
              <:col :let={user} label="Name"><%= user.name %></:col>
              <:col :let={user} label="Email"><%= user.email %></:col>
              <:action :let={user}>
                <.link phx-click={JS.push("send_admin_setup_link", value: %{id: user.id})}>
                  Send setup link
                </.link>
              </:action>
              <:action :let={user}>
                <.link phx-click={JS.push("show_admin_setup_link", value: %{id: user.id})}>
                  Show setup link
                </.link>
              </:action>
              <:action :let={user}>
                <.link
                  phx-click={JS.push("demote_from_admin", value: %{id: user.id})}
                  data-confirm={"Remove #{user.email} as a network admin? They will remain a network member."}
                >
                  Remove admin
                </.link>
              </:action>
            </.table>
          </:resource_content>
        </.show_details>
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
     |> reset_stream(:rows, rows)}
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
     |> reset_stream(:rows, rows)}
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
     |> reset_stream(:rows, rows)}
  end

  # Ignore other messages (e.g. from mailers) instead of crashing the page.
  def handle_info(_message, socket), do: {:noreply, socket}

  defp find_or_create_user(email) do
    case Accounts.get_user_by_email(email) do
      nil -> Accounts.create_user(%{email: email, name: String.slice(email, 0, 50)})
      user -> {:ok, user}
    end
  end

  defp make_network_admin(user, network_id) do
    case Networks.promote_to_network_admin(user.id, network_id) do
      {:error, :user_not_in_network} -> Networks.add_user_to_network(user.id, network_id, :admin)
      other -> other
    end
  end

  defp admin_added_message(user, network) do
    "#{user.email} is now a network admin. " <> setup_link_message(user, network)
  end

  # Passkeys belong to a domain, so admins need one for this network's domain.
  defp setup_link_message(user, network) do
    case Accounts.deliver_network_admin_setup_instructions(user, network) do
      {:ok, _email} ->
        "A link to create a passkey for #{network.domain} was emailed to #{user.email}."

      {:error, reason} ->
        Logger.error("[NetworkShow] Could not email the admin setup link: #{inspect(reason)}")

        "The setup link could not be emailed to #{user.email}; use Send setup link to retry, " <>
          "or Show setup link to send it yourself."
    end
  end

  @impl true
  def handle_event("search", %{"search" => search}, %{assigns: %{selected_tab: tab}} = socket)
      when is_binary(tab) do
    rows = search_rows(socket.assigns.resource.id, tab, TabSearch.normalize(search))
    {:noreply, reset_stream(socket, :rows, rows)}
  end

  def handle_event("search", _params, socket), do: {:noreply, socket}

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

  def handle_event(
        "add_network_admin",
        %{"email" => email},
        %{assigns: %{selected_tab: "admins"}} = socket
      )
      when is_binary(email) do
    network = socket.assigns.resource
    email = String.trim(email)

    with {:ok, user} <- find_or_create_user(email),
         {:ok, _membership} <- make_network_admin(user, network.id) do
      {:noreply,
       socket
       |> stream_insert(:rows, user)
       |> put_flash(:info, admin_added_message(user, network))}
    else
      {:error, %Ecto.Changeset{}} ->
        {:noreply, put_flash(socket, :error, "Enter a valid email address")}

      {:error, _reason} ->
        {:noreply, put_flash(socket, :error, "Failed to add network admin")}
    end
  end

  def handle_event("send_admin_setup_link", %{"id" => user_id}, socket) do
    network = socket.assigns.resource

    case Accounts.get_user(user_id) do
      %Accounts.User{} = user ->
        {:noreply, put_flash(socket, :info, setup_link_message(user, network))}

      nil ->
        {:noreply, put_flash(socket, :error, "User not found")}
    end
  end

  def handle_event("show_admin_setup_link", %{"id" => user_id}, socket) do
    network = socket.assigns.resource

    with {:ok, user_id} <- Ecto.UUID.cast(user_id),
         %Accounts.User{} = user <- Accounts.get_user(user_id) do
      if Networks.is_network_admin?(user.id, network.id) do
        url = Accounts.network_admin_setup_url(user, network)
        {:noreply, assign(socket, :setup_link, %{email: user.email, url: url})}
      else
        {:noreply, put_flash(socket, :error, "#{user.email} is not an admin of this network")}
      end
    else
      _ -> {:noreply, put_flash(socket, :error, "User not found")}
    end
  end

  def handle_event("add_network_admin", _params, socket) do
    {:noreply, put_flash(socket, :error, "Enter an email address")}
  end

  def handle_event(
        "demote_from_admin",
        %{"id" => user_id},
        %{assigns: %{selected_tab: "admins"}} = socket
      ) do
    network_id = socket.assigns.resource.id

    case Ecto.UUID.cast(user_id) do
      {:ok, user_id} ->
        demote_admin(socket, user_id, network_id)

      :error ->
        {:noreply, put_flash(socket, :error, "Invalid user ID")}
    end
  end

  def handle_event("demote_from_admin", _params, socket) do
    {:noreply, put_flash(socket, :error, "Cannot remove network admin")}
  end

  defp demote_admin(socket, user_id, network_id) do
    case Networks.demote_from_network_admin(user_id, network_id) do
      {:ok, _} ->
        {:noreply,
         socket
         |> stream_delete(:rows, %{id: user_id})
         |> put_flash(:info, "User removed as network admin")}

      {:error, :user_not_found} ->
        {:noreply, put_flash(socket, :error, "User not found")}

      {:error, :user_not_in_network} ->
        {:noreply, put_flash(socket, :error, "User does not belong to this network")}

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
      _ -> socket |> stream(key, data) |> assign(:shown_rows, data)
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
      %{:streams => %{^key => _stream}} ->
        # Streams keep no items after rendering (LiveView 0.18), so delete the
        # shown rows that are gone, then insert (or update in place) the new ones.
        new_ids = MapSet.new(data, & &1.id)

        socket =
          socket.assigns
          |> Map.get(:shown_rows, [])
          |> Enum.reject(&MapSet.member?(new_ids, &1.id))
          |> Enum.reduce(socket, &stream_delete(&2, key, &1))

        data
        |> Enum.reduce(socket, &stream_insert(&2, key, &1, at: -1))
        |> assign(:shown_rows, data)

      _ ->
        # Stream doesn't exist yet, create it
        socket |> stream(key, data) |> assign(:shown_rows, data)
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
    # List all system widget integrations. Credential-free integrations (e.g.
    # Open-Meteo) are still shown, but flagged as needing no configuration.
    integrations = Integrations.list_system_integrations()

    # Enrich with network credential status
    rows =
      Enum.map(integrations, fn integration ->
        requires_config = Integrations.requires_network_credentials?(integration)
        optional = get_in(integration.credential_schema, ["auth_type"]) == "optional"
        has_credentials = Integrations.has_network_credentials?(network_id, integration.id)

        status =
          cond do
            (requires_config or optional) and has_credentials -> "Configured"
            requires_config -> "Not Configured"
            optional -> "Optional"
            true -> "No configuration required"
          end

        %{
          id: integration.id,
          name: integration.name,
          widget_name: integration.widget.name,
          description: integration.description,
          status: status,
          is_configured: not requires_config or has_credentials
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

  defp resources_for_network(network_id, "widgets") do
    widgets = Castmill.Widgets.list_network_widgets(network_id)

    rows =
      Enum.map(widgets, fn widget ->
        %{
          id: widget.id,
          name: widget.name,
          slug: widget.slug,
          description: widget.description,
          scope: Castmill.Widgets.scope(widget),
          restricted: if(widget.restricted, do: "Yes", else: "No")
        }
      end)

    {rows,
     [
       %{name: "ID", field: :id},
       %{name: "Name", field: :name},
       %{name: "Slug", field: :slug},
       %{name: "Description", field: :description},
       %{name: "Scope", field: :scope},
       %{name: "Restricted", field: :restricted}
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

  # Fallback for tabs that are present in the UI but not yet backed by a
  # network-scoped listing (e.g. Channels, Playlists, Medias). Returns an empty
  # result set so the admin page renders gracefully instead of crashing.
  defp resources_for_network(_network_id, _tab) do
    {[], [%{name: "Name", field: :name}]}
  end

  # The users tab lists only the first page of users, so search them in the
  # database; other tabs are filtered in memory.
  defp search_rows(network_id, "users", search) when search != "" do
    {users, _total} = Networks.list_users(network_id, search: search, page_size: 100)
    users
  end

  defp search_rows(network_id, tab, search) do
    {rows, _cols} = resources_for_network(network_id, tab)
    TabSearch.filter(rows, search)
  end

  # Row actions this page handles (see the "delete" handle_event clauses).
  defp tab_actions("organizations"), do: [:edit, :delete]
  defp tab_actions("invitations"), do: [:delete]
  defp tab_actions("users"), do: [:edit]
  defp tab_actions(_tab), do: []
end
