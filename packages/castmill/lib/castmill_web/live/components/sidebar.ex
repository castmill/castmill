defmodule CastmillWeb.Live.Admin.Sidebar do
  use CastmillWeb, :live_component

  @impl true
  def mount(socket) do
    links = [
      %{
        href: "networks",
        name: "Networks",
        icon: "hero-wrench-screwdriver-solid"
      },
      %{
        href: "organizations",
        name: "Organizations",
        icon: "hero-globe-alt-solid"
      },
      %{
        href: "teams",
        name: "Teams",
        icon: "hero-user-group-solid"
      },
      %{
        href: "users",
        name: "Users",
        icon: "hero-users-solid"
      },
      %{
        href: "devices",
        name: "Devices",
        icon: "hero-computer-desktop-solid"
      },
      %{
        href: "calendars",
        name: "Calendars",
        icon: "hero-calendar-days-solid"
      },
      %{
        href: "playlists",
        name: "Playlists",
        icon: "hero-play-solid"
      },
      %{
        href: "medias",
        name: "Medias",
        icon: "hero-photo-solid"
      }
    ]

    socket =
      socket
      |> assign(:links, links)
      |> assign(:selected_link, nil)

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <aside
      class="z-40 w-72 h-full transition-transform -translate-x-full sm:translate-x-0"
      aria-label="Sidebar"
    >
      <div class="h-full flex flex-col justify-between px-3 py-4 overflow-y-auto bg-gray-50 dark:bg-gray-800">
        <div>
          <ul class="space-y-2 font-medium">
            <li :for={link <- @links}>
              <!-- Cannot use patch here, because it will not work with streams, yet. -->
              <.link href={~p"/admin/#{link.href}"} class={active_link(link, @selected_link)}>
                <.icon name={link.icon} class="h-4 w-4" />

                <span class="flex-1 ml-3 whitespace-nowrap"><%= link.name %></span>

                <span class="inline-flex items-center justify-center px-2 ml-3 text-sm font-medium text-gray-800 bg-gray-200 rounded-full dark:bg-gray-700 dark:text-gray-300">
                  Pro
                </span>
                <span class="inline-flex items-center justify-center w-3 h-3 p-3 ml-3 text-sm font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-300">
                  3
                </span>
              </.link>
            </li>
          </ul>
        </div>
        <div class="text-gray-600 text-xs text-center">
          <div>© 2011-2024, Castmill AB</div>
          <div>Licensed under AGPL</div>
          <div>All rights reserved</div>
        </div>
      </div>
    </aside>
    """
  end

  defp active_link(link, selected_link) do
    classes = "flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100"

    if link.href == selected_link do
      classes <> "bg-gray-100 dark:bg-gray-700"
    else
      classes <> "hover:bg-gray-100 dark:hover:bg-gray-700"
    end
  end
end
