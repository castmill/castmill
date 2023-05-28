defmodule CastmillWeb.Live.Admin.OrganizationForm do
  use CastmillWeb, :live_component

  alias Castmill.Organizations

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1>Organization Settings</h1>
      </div>
      <.simple_form
        for={@form}
        id="organization-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <.input field={@form[:name]} type="text" label="Name" />

        <:actions>
          <.button phx-disable-with="Saving...">Save Organization</.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  @impl true
  def update(%{resource: organization, action: :edit} = assigns, socket) do
    changeset = Organizations.change_organization(organization)

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:organization, organization)
     |> assign_form(changeset)}
  end

  def update(%{resource: network, action: :new} = assigns, socket) do
    organization = %Organizations.Organization{network_id: network.id}
    changeset = Organizations.change_organization(organization, %{})

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:action, :new)
     |> assign(:organization, organization)
     |> assign_form(changeset)}
  end

  def update(_assigns, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"organization" => params}, socket) do
    changeset =
      socket.assigns.organization
      |> Organizations.change_organization(params)
      |> Map.put(:action, :validate)

    {:noreply, assign_form(socket, changeset)}
  end

  def handle_event("save", %{"organization" => params}, socket) do
    save(socket, socket.assigns.action, params)
  end

  defp save(socket, :edit, params) do
    case Organizations.update_organization(socket.assigns.resource, params) do
      {:ok, resource} ->
        notify_parent({:saved, resource})

        {:noreply,
         socket
         |> put_flash(:info, "Organization updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  # Save an organization that has an organization as parent.
  defp save(
         %{:assigns => %{:resource => %Castmill.Organizations.Organization{} = organization}} =
           socket,
         :new,
         params
       ) do
    case Organizations.create_organization(
           Map.merge(params, %{
             "network_id" => organization.network_id,
             "organization_id" => organization.id
           })
         ) do
      {:ok, resource} ->
        notify_parent({:created, resource})

        {:noreply,
         socket
         |> put_flash(:info, "Organization created successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  # Save an organization that has a network as parent.
  defp save(socket, :new, params) do
    case Organizations.create_organization(
           Map.merge(params, %{"network_id" => socket.assigns.resource.id})
         ) do
      {:ok, resource} ->
        notify_parent({:created, resource})

        {:noreply,
         socket
         |> put_flash(:info, "Organization created successfully")
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
