defmodule CastmillWeb.Live.Admin.OrganizationShow do
  use CastmillWeb, :live_view

  alias Castmill.Organizations
  alias Castmill.Teams
  alias Castmill.Devices
  alias CastmillWeb.Live.Admin.TabSearch

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
        },
        %{
          name: "Quotas",
          icon: "hero-adjustments-horizontal-solid",
          href: "quotas",
          form: nil
        }
      ])
      |> assign(:quota_rows, [])
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
        actions={tab_actions(@selected_tab)}
      >
        <:resource_content :if={@selected_tab == "quotas"}>
          <p class="py-2 text-sm text-gray-400">
            An override replaces this organization's plan for that resource. Leave it empty to use
            the plan. Storage and upload sizes are in MB.
          </p>
          <.table id="organization-quotas" rows={@quota_rows}>
            <:col :let={row} label="Resource"><%= row.resource %></:col>
            <:col :let={row} label="Current limit"><%= row.effective %></:col>
            <:col :let={row} label="Override">
              <form
                id={"quota-#{row.resource}"}
                phx-submit="save_quota"
                class="flex items-center gap-2"
              >
                <input type="hidden" name="resource" value={row.resource} />
                <input
                  type="number"
                  name="max"
                  min="0"
                  value={row.override}
                  placeholder="Plan"
                  aria-label={"Override for #{row.resource}"}
                  class="w-28 rounded-md text-gray-900"
                />
                <.button>Save</.button>
              </form>
            </:col>
          </.table>
        </:resource_content>
      </.show_details>
    </div>
    """
  end

  @impl true
  def handle_params(%{"id" => id, "resource" => resource}, uri, socket) do
    {:noreply, socket} = handle_params(%{"id" => id}, uri, socket)

    {rows, cols} = resources_for_organization(id, resource)
    selected_tab = if Enum.any?(socket.assigns.tabs, &(&1.href == resource)), do: resource

    socket =
      socket
      |> assign(:base_resource_url, ~p"/admin/#{resource}")
      |> assign(:selected_tab, selected_tab)
      |> assign(:resource_cols, cols)
      |> assign(:quota_rows, if(selected_tab == "quotas", do: quota_rows(id), else: []))

    socket =
      if Map.has_key?(Map.get(socket.assigns, :streams, %{}), :rows) do
        replace_rows(socket, rows)
      else
        socket
        |> stream(:rows, rows)
        |> assign(:shown_rows, rows)
      end

    {:noreply, socket}
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
  def handle_event("search", %{"search" => search}, %{assigns: %{selected_tab: tab}} = socket)
      when is_binary(tab) do
    {rows, _cols} = resources_for_organization(socket.assigns.resource.id, tab)
    {:noreply, replace_rows(socket, TabSearch.filter(rows, search))}
  end

  def handle_event("search", _params, socket), do: {:noreply, socket}

  def handle_event("save_quota", %{"resource" => resource, "max" => max}, socket) do
    organization_id = socket.assigns.resource.id

    with %{} = row <- Enum.find(socket.assigns.quota_rows, &(&1.resource == resource)),
         {:ok, value} <- parse_quota(max),
         :ok <- Castmill.Quotas.set_organization_quota(organization_id, row.key, value) do
      {:noreply,
       socket
       |> put_flash(:info, "Quota for #{resource} saved.")
       |> assign(:quota_rows, quota_rows(organization_id))}
    else
      _ ->
        {:noreply,
         put_flash(socket, :error, "Enter a whole number of 0 or more, or leave it empty.")}
    end
  end

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

  # Streams keep no items after rendering (LiveView 0.18, no reset), so delete
  # the shown rows that are gone, then insert (or update in place) the new ones.
  defp replace_rows(socket, rows) do
    new_ids = MapSet.new(rows, & &1.id)

    socket =
      socket.assigns
      |> Map.get(:shown_rows, [])
      |> Enum.reject(&MapSet.member?(new_ids, &1.id))
      |> Enum.reduce(socket, &stream_delete(&2, :rows, &1))

    rows
    |> Enum.reduce(socket, &stream_insert(&2, :rows, &1, at: -1))
    |> assign(:shown_rows, rows)
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
    members =
      %{organization_id: organization_id, page_size: nil}
      |> Organizations.list_users()
      |> Enum.map(fn %{user: user, role: role, inserted_at: inserted_at} ->
        %{id: user.id, name: user.name, email: user.email, role: role, inserted_at: inserted_at}
      end)

    {members,
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
         name: "Added",
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
    {Organizations.list_channels(%{organization_id: organization_id}),
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
    {Organizations.list_playlists(%{organization_id: organization_id}),
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
    {Organizations.list_medias(%{organization_id: organization_id}),
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

  defp resources_for_organization(organization_id, "widgets") do
    rows =
      organization_id
      |> Castmill.Widgets.list_available_widgets()
      |> Enum.map(fn widget ->
        %{
          id: widget.id,
          name: widget.name,
          slug: widget.slug,
          scope: Castmill.Widgets.scope(widget)
        }
      end)

    {rows,
     [
       %{name: "ID", field: :id},
       %{name: "Name", field: :name},
       %{name: "Slug", field: :slug},
       %{name: "Scope", field: :scope}
     ]}
  end

  defp resources_for_organization(_organization_id, _tab) do
    {[], [%{name: "Name", field: :name}]}
  end

  # Row actions this page handles (see the "delete" handle_event clauses).
  defp parse_quota(value) do
    case String.trim(value || "") do
      "" ->
        {:ok, nil}

      text ->
        case Integer.parse(text) do
          {n, ""} when n >= 0 -> {:ok, n}
          _ -> :error
        end
    end
  end

  defp quota_rows(organization_id) do
    overrides =
      organization_id
      |> Castmill.Quotas.list_quotas()
      |> Map.new(&{&1.resource, &1.max})

    for resource <- Castmill.Quotas.organization_quota_resources() do
      %{
        id: to_string(resource),
        key: resource,
        resource: to_string(resource),
        effective: Castmill.Quotas.get_quota_for_organization(organization_id, resource),
        override: Map.get(overrides, resource)
      }
    end
  end

  defp tab_actions("organizations"), do: [:edit]
  defp tab_actions("teams"), do: [:delete]
  defp tab_actions("users"), do: [:edit, :delete]
  defp tab_actions("devices"), do: [:delete]
  defp tab_actions(_tab), do: []
end
