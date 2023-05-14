defmodule CastmillWeb.Live.Admin do
  use CastmillWeb, :live_view

  # mount
  def mount(params, _session, socket) do
    IO.puts("mounting admin live view")
    IO.puts("socket: #{inspect(params)}")
    {:ok, socket}
  end

  #     <.live_component module={CastmillWeb.Live.Admin.Sidebar} id="sidebar" />

  def render(assigns) do
    ~H"""
    <div>Castmill Admin</div>
    """
  end

  def handle_event("ping", %{"id" => id}, socket) do
    {:noreply, assign(socket, :devices, Castmill.Device.list_devices())}
  end
end
