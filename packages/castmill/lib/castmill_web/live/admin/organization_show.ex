defmodule CastmillWeb.Live.Admin.OrganizationShow do
  use CastmillWeb, :live_view
  alias Castmill.Organizations
  alias Castmill.Teams
  alias Castmill.Devices

  import CastmillWeb.Live.Admin.Table
  import CastmillWeb.Live.Admin.Tabs
  import CastmillWeb.Live.Admin.Show

  @impl true
  def mount(params, _session, socket) do
    IO.inspect(params)

    socket =
      socket
      |> assign(:cols, [
        %{
          name: "ID",
          field: :id
        },
        %{
          name: "Network ID",
          field: :network_id
        },
        %{
          name: "Parent organization ID",
          field: :organization_id
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
        form_module={CastmillWeb.Live.Admin.OrganizationForm}
        id={@resource.id}
        type="Organization"
        bucket="organizations"
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

    {rows, cols} = resources_for_organization(id, resource)

    {:noreply,
     socket
     |> assign(:base_resource_url, ~p"/admin/#{resource}")
     |> stream(:rows, rows)
     |> assign(:selected_tab, resource)
     |> assign(:resource_cols, cols)}
  end

  def handle_params(%{"id" => id}, _, socket) do
    {:noreply,
     socket
     |> assign(:page_title, page_title(socket.assigns.live_action))
     |> assign(:selected_link, "organizations")
     |> assign(:resource, Organizations.get_organization!(id))
     |> assign(:resource_cols, [])
     |> assign(:base_url, ~p"/admin/organizations/#{id}")}
  end

  defp page_title(:show), do: "Show Organization"
  defp page_title(:edit), do: "Edit Organization"
  defp page_title(:new), do: "New Organization"

  defp resources_for_organization(organization_id, "organizations") do
    {Organizations.list_organizations(organization_id) || [],
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

  defp resources_for_organization(organization_id, "teams") do
    {Teams.list_teams(organization_id) || [],
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

  defp resources_for_organization(organization_id, "users") do
    {Organizations.list_users(organization_id) || [],
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

  defp resources_for_organization(organization_id, "devices") do
    {Devices.list_devices(organization_id) || [],
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

  defp resources_for_organization(organization_id, "calendars") do
    {Organizations.list_calendars(organization_id) || [],
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

  defp resources_for_organization(organization_id, "playlists") do
    {Organizations.list_playlists(organization_id) || [],
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

  defp resources_for_organization(organization_id, "medias") do
    {Organizations.list_medias(organization_id) || [],
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
