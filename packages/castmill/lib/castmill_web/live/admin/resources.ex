defmodule CastmillWeb.Live.Admin.Resources do
  use CastmillWeb, :live_view
  alias Castmill.Networks
  alias Castmill.Organizations
  alias Castmill.Teams
  alias Castmill.Accounts
  alias Castmill.Devices
  alias Castmill.Resources

  import CastmillWeb.Live.Admin.Table
  import CastmillWeb.Live.Admin.Search
  import CastmillWeb.Live.Admin.Pagination

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:search, "")
      |> assign(:page, 1)
      |> assign(:page_size, 10)
      |> assign(:total_pages, 1)
      |> assign(:total_items, 0)
      |> assign(:sort, "name")
      |> assign(:sort_dir, "asc")
      |> assign(:loading, false)
      |> assign(:form_module, CastmillWeb.Live.Admin.NetworkForm)

    {:ok, socket}
  end

  def handle_params(%{"resource" => "networks"} = params, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
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
    ]

    {:noreply,
     socket
     |> maybe_stream(:rows, Networks.list_networks())
     |> apply_action(socket.assigns.live_action, params)
     |> assign(:cols, columns)
     |> assign(:selected_link, "networks")
     |> assign(:resource_name, "Network")
     |> assign(:form_module, CastmillWeb.Live.Admin.NetworkForm)}
  end

  def handle_params(%{"resource" => "organizations"} = params, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
      },
      %{
        name: "Network Id",
        field: :network_id
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    {:noreply,
     socket
     |> apply_action(socket.assigns.live_action, params)
     |> assign(:cols, columns)
     |> maybe_stream(:rows, Organizations.list_organizations())
     |> assign(:selected_link, "organizations")
     |> assign(:resource_name, "Organization")
     |> assign(:page_title, "Organizations")
     |> assign(:form_module, CastmillWeb.Live.Admin.OrganizationForm)}
  end

  def handle_params(%{"resource" => "teams"}, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
      },
      %{
        name: "Organization ID",
        field: :organization_id
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> stream(:rows, Teams.list_teams())
     |> assign(:selected_link, "teams")
     |> assign(:resource_name, "Team")
     |> assign(:page_title, "Teams")}
  end

  def handle_params(%{"resource" => "users"}, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
      },
      %{
        name: "Email",
        field: :email
      },
      %{
        name: "Network ID",
        field: :network_id
      },
      %{
        name: "Organization ID",
        field: :organization_id
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> stream(:rows, Accounts.list_users())
     |> assign(:selected_link, "users")
     |> assign(:resource_name, "User")
     |> assign(:page_title, "Users")}
  end

  def handle_params(%{"resource" => "devices"}, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
      },
      %{
        name: "Organization ID",
        field: :organization_id
      },
      %{
        name: "Last IP",
        field: :last_ip
      },
      %{
        name: "Last Online ID",
        field: :last_online
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> stream(:rows, Devices.list_devices())
     |> assign(:selected_link, "devices")
     |> assign(:resource_name, "Device")
     |> assign(:page_title, "Devices")}
  end

  def handle_params(%{"resource" => "calendars"}, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
      },
      %{
        name: "Organization ID",
        field: :organization_id
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> stream(:rows, Resources.list_resource(Castmill.Resources.Calendar))
     |> assign(:selected_link, "calendars")
     |> assign(:resource_name, "Calendar")
     |> assign(:page_title, "Calendars")}
  end

  def handle_params(%{"resource" => "playlists"}, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
      },
      %{
        name: "Organization ID",
        field: :organization_id
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> stream(:rows, Resources.list_resource(Castmill.Resources.Playlist))
     |> assign(:selected_link, "playlists")
     |> assign(:resource_name, "Playlist")
     |> assign(:page_title, "Playlists")}
  end

  def handle_params(%{"resource" => "medias"}, _url, socket) do
    columns = [
      %{
        name: "Name",
        field: :name
      },
      %{
        name: "Organization ID",
        field: :organization_id
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> stream(:rows, Resources.list_resource(Castmill.Resources.Media))
     |> assign(:selected_link, "medias")
     |> assign(:resource_name, "Media")
     |> assign(:page_title, "Medias")}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
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

  @impl true
  def render(assigns) do
    ~H"""
    <div class="grow">
      <div :if={@loading} class="loading">
        Loading...
      </div>

      <.header>
        <%= @page_title %>
        <:actions>
          <!-- Cannot use patch due to bug in streams -->
          <.link :if={@selected_link == "networks"} href={~p"/admin/#{@selected_link}/new"}>
            <.button>New <%= @resource_name %></.button>
          </.link>
        </:actions>
      </.header>

      <div class="mt-8 mb-4">
        <.search
          placeholder="Search organizations"
          phx-debounce="500"
          phx-target="search"
          phx-value=""
        />
      </div>
      <.admin_table
        rows={@streams.rows}
        cols={@cols}
        resource={@selected_link}
        base_url={~p"/admin/#{@selected_link}"}
      />

      <.pagination />
    </div>
    <.modal
      :if={@live_action in [:new, :edit]}
      id={"#{@selected_link}-modal"}
      show
      on_cancel={JS.patch(~p"/admin/#{@selected_link}")}
    >
      <.live_component
        module={@form_module}
        id={@resource.id || :new}
        title={@page_title}
        action={@live_action}
        resource={@resource}
        patch={~p"/admin/#{@selected_link}"}
      />
    </.modal>
    """
  end

  # Example on how to handle messages, for example we want to update
  # a device online status everytime a device gets online or offline.
  @impl true
  def handle_info(:device_status, socket) do
    {:noreply, socket}
  end

  def handle_info({:run_search, _search}, socket) do
    networks = Castmill.Networks.list_networks()

    {:noreply, assign(socket, rows: networks, loading: false)}
  end

  @impl true
  def handle_info({CastmillWeb.Live.Admin.NetworkForm, {:saved, row}}, socket) do
    {:noreply, stream_insert(socket, :rows, row)}
  end

  @impl true
  def handle_info({CastmillWeb.Live.Admin.OrganizationForm, {:saved, row}}, socket) do
    {:noreply, stream_insert(socket, :rows, row)}
  end

  def handle_event("search", %{"search" => search}, socket) do
    send(self(), {:run_search, search})
    {:noreply, assign(socket, search: search, networks: [], loading: true)}
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "networks"}, socket) do
    network = Networks.get_network(id)
    {:ok, _} = Networks.delete_network(network)

    {:noreply, stream_delete(socket, :rows, network)}
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "organizations"}, socket) do
    organization = Organizations.get_organization!(id)
    {:ok, _} = Organizations.delete_organization(organization)
    {:noreply, stream_delete(socket, :rows, organization)}
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "users"}, socket) do
    {:ok, _} = Accounts.delete_user(id)
    {:noreply, stream_delete(socket, :rows, %Accounts.User{id: id})}
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "devices"}, socket) do
    device = %Devices.Device{id: id}
    {:ok, _} = Devices.delete_device(device)
    {:noreply, stream_delete(socket, :rows, device)}
  end

  # Networks
  defp apply_action(socket, :new, %{"resource" => "networks"}) do
    socket
    |> assign(:page_title, "New Network")
    |> assign(:resource, %Networks.Network{name: "test"})
  end

  defp apply_action(socket, :edit, %{"id" => id, "resource" => "networks"}) do
    socket
    |> assign(:page_title, "Edit Network")
    |> assign(:resource, Networks.get_network(id))
  end

  # Organizations

  # TODO: Should not be able to create organizations without a network
  # so we must move this action to network_show tabs.
  defp apply_action(socket, :edit, %{"id" => id, "resource" => "organizations"}) do
    socket
    |> assign(:page_title, "Edit Organization")
    |> assign(:resource, Organizations.get_organization!(id))
  end

  defp apply_action(socket, :index, %{"resource" => "organizations"}) do
    socket
    |> assign(:page_title, "Organizations")
    |> assign(:resource, nil)
  end

  defp apply_action(socket, :index, _params) do
    socket
    |> assign(:page_title, "Networks")
    |> assign(:resource, nil)
  end
end
