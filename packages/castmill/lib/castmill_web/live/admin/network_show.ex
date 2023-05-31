defmodule CastmillWeb.Live.Admin.NetworkShow do
  use CastmillWeb, :live_view
  alias Castmill.Networks

  alias Castmill.Organizations

  import CastmillWeb.Live.Admin.Show

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
          name: "Language",
          field: :default_language
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
          name: "Devices",
          icon: "hero-computer-desktop-solid",
          href: "devices",
          form: nil
        },
        %{
          name: "Calendars",
          icon: "hero-calendar-days-solid",
          href: "calendars",
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
        }
      ])
      |> assign(:selected_tab, nil)

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div>
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
    </div>
    """
  end

  @impl true
  def handle_params(%{"id" => id, "resource" => resource}, uri, socket) do
    {:noreply, socket} = handle_params(%{"id" => id}, uri, socket)

    {rows, cols} = resources_for_network(id, resource)

    {:noreply,
     socket
     |> assign(:base_resource_url, ~p"/admin/#{resource}")
     |> maybe_stream(:rows, rows)
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

  # def handle_info(_params, socket), do: {:noreply, socket}

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "organizations"}, socket) do
    organization = Organizations.get_organization!(id)
    {:ok, _} = Organizations.delete_organization(organization)

    {:noreply, stream_delete(socket, :rows, organization)}
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

  # defp maybe_replace_stream(socket, key, data) do
  #   with %{:assigns => %{:streams => %{^key => _data}}} <- socket do
  #     socket
  #     |> assign(:streams, Map.delete(socket.assigns.streams, key))
  #     |> stream(key, data)
  #   else
  #     _ -> stream(socket, key, data)
  #   end
  # end

  defp page_title(:show), do: "Show Network"
  defp page_title(:edit), do: "Edit Network"
  defp page_title(:new), do: "New Network"

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
end
