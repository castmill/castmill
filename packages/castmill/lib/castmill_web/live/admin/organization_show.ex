defmodule CastmillWeb.Live.Admin.OrganizationShow do
  use CastmillWeb, :live_view

  alias Castmill.Organizations
  alias Castmill.Teams
  alias Castmill.Devices

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
          name: "Network ID",
          field: :network_id
        },
        %{
          name: "Parent organization ID",
          field: :organization_id
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
          form: CastmillWeb.Live.Admin.TeamForm
        },
        %{
          name: "Users",
          icon: "hero-users-solid",
          href: "users",
          form: CastmillWeb.Live.Admin.UserForm
        },
        %{
          name: "Devices",
          icon: "hero-computer-desktop-solid",
          href: "devices",
          form: CastmillWeb.Live.Admin.DeviceForm
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

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "teams"}, socket) do
    team = Teams.get_team(id)
    {:ok, _} = Teams.delete_team(team)

    {:noreply, stream_delete(socket, :rows, team)}
  end

  @impl true
  def handle_event("delete", %{"id" => user_id, "resource" => "users"}, socket) do
    # Remove user from organization
    case Organizations.remove_user(socket.assigns.resource.id, user_id) do
      {:ok, _} ->
        # TODO: If user is not in any other organization, delete user
        {:noreply, stream_delete(socket, :rows, %Castmill.Accounts.User{id: user_id})}

      {:error, _} ->
        {:noreply,
         socket
         |> put_flash(:error, "Error removing user from organization.")}
    end
  end

  @impl true
  def handle_event("delete", %{"id" => id, "resource" => "devices"}, socket) do
    device = %Devices.Device{id: id}
    {:ok, _} = Devices.delete_device(device)

    {:noreply, stream_delete(socket, :rows, device)}
  end

  # When a child resource is created we need to update the stream for the resources.
  @impl true
  def handle_info({CastmillWeb.Live.Admin.TeamForm, {:created, resource}}, socket) do
    # This handler works but the stream_insert does not for some unknown reason.
    {:noreply, stream_insert(socket, :rows, resource)}
  end

  def handle_info(_params, socket), do: {:noreply, socket}

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
         name: "Email",
         field: :email
       },
       %{
         name: "Role",
         field: :role
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

  defp resources_for_organization(organization_id, "channels") do
    {Organizations.list_channels(organization_id) || [],
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
