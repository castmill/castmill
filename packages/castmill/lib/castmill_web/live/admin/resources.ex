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
      |> assign(:total_items, 0)
      |> assign(:sort, "name")
      |> assign(:sort_dir, "asc")
      |> assign(:loading, false)
      |> assign(:options, %{
        page: 1,
        page_size: 10,
        search: ""
      })
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

    socket = handle_resource("Network", params, socket)

    {:noreply,
     socket
     |> apply_action(socket.assigns.live_action, params)
     |> assign(:cols, columns)
     |> assign(:selected_link, "networks")
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
        name: "Status",
        field: :status,
        render: fn org ->
          if Organizations.Organization.blocked?(org), do: "Blocked", else: "Active"
        end
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    socket = handle_resource("Organization", params, socket)

    {:noreply,
     socket
     |> apply_action(socket.assigns.live_action, params)
     |> assign(:cols, columns)
     |> assign(:selected_link, "organizations")
     |> assign(:page_title, "Organizations")
     |> assign(:form_module, CastmillWeb.Live.Admin.OrganizationForm)}
  end

  def handle_params(%{"resource" => "teams"} = params, _url, socket) do
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

    socket = handle_resource("Team", params, socket)

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> assign(:selected_link, "teams")
     |> assign(:page_title, "Teams")}
  end

  def handle_params(%{"resource" => "users"} = params, _url, socket) do
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
        name: "Network Role",
        field: :network_role
      },
      %{
        name: "Network ID",
        field: :network_id
      },
      %{
        name: "Created",
        field: :inserted_at
      }
    ]

    socket = handle_resource("User", params, socket)

    {:noreply,
     socket
     |> apply_action(socket.assigns.live_action, params)
     |> assign(:cols, columns)
     |> assign(:selected_link, "users")
     |> assign(:page_title, "Users")
     |> assign(:form_module, CastmillWeb.Live.Admin.UserForm)}
  end

  def handle_params(%{"resource" => "devices"} = params, _url, socket) do
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

    socket = handle_resource("Device", params, socket)

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> assign(:selected_link, "devices")
     |> assign(:page_title, "Devices")}
  end

  def handle_params(%{"resource" => "channels"} = params, _url, socket) do
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

    socket = handle_resource("Channel", params, socket)

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> assign(:selected_link, "channels")
     |> assign(:page_title, "Channels")}
  end

  def handle_params(%{"resource" => "playlists"} = params, _url, socket) do
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

    socket = handle_resource("Playlist", params, socket)

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> assign(:selected_link, "playlists")
     |> assign(:page_title, "Playlists")}
  end

  def handle_params(%{"resource" => "medias"} = params, _url, socket) do
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

    socket = handle_resource("Media", params, socket)

    {:noreply,
     socket
     |> assign(:cols, columns)
     |> assign(:selected_link, "medias")
     |> assign(:page_title, "Medias")}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
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
        <.search placeholder="Search" value={@options.search} />
      </div>
      <.admin_table
        rows={@rows}
        cols={@cols}
        resource={@selected_link}
        base_url={~p"/admin/#{@selected_link}"}
      />

      <.pagination selected_link={@selected_link} total_items={@total_items} options={@options} />
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
    rows = update_or_insert_row(socket.assigns.rows, row)
    {:noreply, assign(socket, :rows, rows)}
  end

  @impl true
  def handle_info({CastmillWeb.Live.Admin.OrganizationForm, {:saved, row}}, socket) do
    rows = update_or_insert_row(socket.assigns.rows, row)
    {:noreply, assign(socket, :rows, rows)}
  end

  @impl true
  def handle_info({CastmillWeb.Live.Admin.UserForm, {:saved, row}}, socket) do
    rows = update_or_insert_row(socket.assigns.rows, row)
    {:noreply, assign(socket, :rows, rows)}
  end

  def handle_event("search", %{"search" => search}, socket) do
    {:noreply, assign(socket, search: search)}
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "networks"}, socket) do
    network = Networks.get_network(id)
    {:ok, _} = Networks.delete_network(network)
    rows = Enum.reject(socket.assigns.rows, fn r -> r.id == network.id end)
    {:noreply, assign(socket, :rows, rows)}
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "organizations"}, socket) do
    organization = Organizations.get_organization!(id)
    {:ok, _} = Organizations.delete_organization(organization)
    rows = Enum.reject(socket.assigns.rows, fn r -> r.id == organization.id end)
    {:noreply, assign(socket, :rows, rows)}
  end

  @impl true
  def handle_event("block", %{"id" => id, "resource" => "organizations"}, socket) do
    organization = Organizations.get_organization!(id)

    case Organizations.block_organization(organization, "Blocked via admin panel") do
      {:ok, updated_org} ->
        rows = update_or_insert_row(socket.assigns.rows, updated_org)
        {:noreply, assign(socket, :rows, rows)}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to block organization")}
    end
  end

  @impl true
  def handle_event("unblock", %{"id" => id, "resource" => "organizations"}, socket) do
    organization = Organizations.get_organization!(id)

    case Organizations.unblock_organization(organization) do
      {:ok, updated_org} ->
        rows = update_or_insert_row(socket.assigns.rows, updated_org)
        {:noreply, assign(socket, :rows, rows)}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to unblock organization")}
    end
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "users"}, socket) do
    {:ok, _} = Accounts.delete_user(id)
    rows = Enum.reject(socket.assigns.rows, fn r -> r.id == id end)
    {:noreply, assign(socket, :rows, rows)}
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "devices"}, socket) do
    device = %Devices.Device{id: id}
    {:ok, _} = Devices.delete_device(device)
    rows = Enum.reject(socket.assigns.rows, fn r -> r.id == id end)
    {:noreply, assign(socket, :rows, rows)}
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

  # Users
  defp apply_action(socket, :show, %{"id" => id, "resource" => "users"}) do
    socket
    |> assign(:page_title, "User Details")
    |> assign(:resource, Castmill.Accounts.get_user(id))
  end

  defp apply_action(socket, :edit, %{"id" => id, "resource" => "users"}) do
    socket
    |> assign(:page_title, "Edit User")
    |> assign(:resource, Castmill.Accounts.get_user(id))
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

  # Select rows for a given resource
  defp select_rows(resource_name, query_params) do
    case resource_name do
      "Media" ->
        %{
          rows: Resources.list_resources(Castmill.Resources.Media, query_params),
          count: Resources.count_resources(Castmill.Resources.Media, query_params)
        }

      "Playlist" ->
        %{
          rows: Resources.list_resources(Castmill.Resources.Playlist, query_params),
          count: Resources.count_resources(Castmill.Resources.Playlist, query_params)
        }

      "Channel" ->
        %{
          rows: Resources.list_resources(Castmill.Resources.Channel, query_params),
          count: Resources.count_resources(Castmill.Resources.Channel, query_params)
        }

      "Device" ->
        %{
          rows: Devices.list_devices(query_params),
          count: Devices.count_devices(query_params)
        }

      "User" ->
        %{
          rows: Accounts.list_users(query_params),
          count: Accounts.count_users(query_params)
        }

      "Team" ->
        %{
          rows: Teams.list_teams(query_params),
          count: Teams.count_teams(query_params)
        }

      "Organization" ->
        %{
          rows: Organizations.list_organizations(query_params),
          count: Organizations.count_organizations(query_params)
        }

      "Network" ->
        %{
          rows: Networks.list_networks(query_params),
          count: Networks.count_networks(query_params)
        }

      _ ->
        []
    end
  end

  @index_params_schema %{
    page: [type: :integer, number: [min: 1], default: 1],
    page_size: [type: :integer, number: [min: 1, max: 100], default: 10],
    search: [type: :string, default: ""]
  }

  # Select the rows from the database and assign them to the socket
  defp handle_resource(resource_name, params, socket) do
    {:ok, options} = Tarams.cast(params, @index_params_schema)
    #
    # select the rows from the database depending on the resource name
    %{rows: rows, count: total_items} = select_rows(resource_name, options)

    socket
    |> assign(:rows, rows)
    |> assign(:total_items, total_items)
    |> assign(:resource_name, resource_name)
    |> assign(:options, options)
  end

  # Helper to update an existing row or insert a new one
  defp update_or_insert_row(rows, new_row) do
    case Enum.find_index(rows, fn r -> r.id == new_row.id end) do
      nil -> [new_row | rows]
      index -> List.replace_at(rows, index, new_row)
    end
  end
end
