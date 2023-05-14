defmodule CastmillWeb.Live.Admin.NetworkForm do
  use CastmillWeb, :live_component

  alias Castmill.Networks

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1>Network Settings</h1>
      </div>
      <.simple_form
        for={@form}
        id="network-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <.input field={@form[:name]} type="text" label="Name" />
        <.input field={@form[:email]} type="text" label="Email" />
        <.input field={@form[:domain]} type="text" label="Domain" />
        <.input field={@form[:default_language]} type="text" label="Default Language" />
        <.input field={@form[:logo]} type="text" label="Logo" />
        <.input field={@form[:copyright]} type="text" label="Copyright" />

        <:actions>
          <.button phx-disable-with="Saving...">Save Network</.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  @impl true
  def update(%{resource: network} = assigns, socket) do
    changeset = Networks.change_network(network)

    {:ok,
     socket
     |> assign(assigns)
     |> assign_form(changeset)}
  end

  @impl true
  def handle_event("validate", %{"network" => params}, socket) do
    changeset =
      socket.assigns.resource
      |> Networks.change_network(params)
      |> Map.put(:action, :validate)

    {:noreply, assign_form(socket, changeset)}
  end

  def handle_event("save", %{"network" => params}, socket) do
    save_network(socket, socket.assigns.action, params)
  end

  defp save_network(socket, :edit, params) do
    case Networks.update_network(socket.assigns.resource, params) do
      {:ok, network} ->
        notify_parent({:saved, network})

        {:noreply,
         socket
         |> put_flash(:info, "Network updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  defp save_network(socket, :new, params) do
    case Networks.create_network(params) do
      {:ok, network} ->
        notify_parent({:saved, network})

        {:noreply,
         socket
         |> put_flash(:info, "Network created successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    assign(socket, :form, to_form(changeset))
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
end
