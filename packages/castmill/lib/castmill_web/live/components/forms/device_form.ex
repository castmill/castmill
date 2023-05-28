defmodule CastmillWeb.Live.Admin.DeviceForm do
  use CastmillWeb, :live_component

  alias Castmill.Devices

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1>Device Settings</h1>
      </div>
      <.simple_form
        for={@form}
        id="device-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <.input field={@form[:name]} type="text" label="Name" />
        <.input field={@form[:pincode]} type="text" label="Pincode" />

        <:actions>
          <!-- TODO: we need a different text when saving vs registering -->
          <.button phx-disable-with="Registering...">Register Device</.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  @impl true
  def update(%{action: :new} = assigns, socket) do
    device = %Devices.Device{}
    changeset = Devices.change_device(device)

    {
      :ok,
      socket
      |> assign(assigns)
      |> assign(:device, device)
      |> assign_form(changeset)
    }
  end

  @impl true
  def update(_assigns, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"device" => params}, socket) do
    changeset =
      socket.assigns.device
      |> Devices.change_device(params)
      |> Map.put(:action, :validate)

    {:noreply, assign_form(socket, changeset)}
  end

  def handle_event("save", %{"device" => params}, socket) do
    save(socket, socket.assigns.action, params)
  end

  defp save(socket, :edit, params) do
    case Devices.update_device(socket.assigns.resource, params) do
      {:ok, resource} ->
        notify_parent({:saved, resource})

        {:noreply,
         socket
         |> put_flash(:info, "Device updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  # Create a device within an organization
  defp save(socket, :new, %{"pincode" => pincode, "name" => name} = params) do
    case Devices.register_device(socket.assigns.resource.id, pincode, %{:name => name}) do
      {:ok, device} ->
        notify_parent({:created, device})

        {:noreply,
         socket
         |> put_flash(:info, "Device registered successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}

      {:error, :pincode_expired} ->
        {:noreply,
         socket
         |> put_flash(:error, "Pincode has expired. Please try again.")
         |> push_patch(to: socket.assigns.patch)}


      {:error, :invalid_pincode} ->
        {:noreply,
         socket
         |> put_flash(:error, "Invalid pincode. Please try again.")
         |> push_patch(to: socket.assigns.patch)}
    end
  end

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    assign(socket, :form, to_form(changeset))
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
end
