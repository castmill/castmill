defmodule CastmillWeb.Live.Admin.TeamForm do
  use CastmillWeb, :live_component

  alias Castmill.Teams

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1>Team Settings</h1>
      </div>
      <.simple_form
        for={@form}
        id="team-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <.input field={@form[:name]} type="text" label="Name" />

        <:actions>
          <.button phx-disable-with="Saving...">Save Team</.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  @impl true
  def update(%{action: :new} = assigns, socket) do
    # team = %Teams.Team{organization_id: socket.assigns.resource.id}
    team = %Teams.Team{}
    changeset = Teams.change_team(team)

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:team, team)
     |> assign_form(changeset)}
  end

  @impl true
  def update(_assigns, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"team" => params}, socket) do
    changeset =
      socket.assigns.team
      |> Teams.change_team(params)
      |> Map.put(:action, :validate)

    {:noreply, assign_form(socket, changeset)}
  end

  def handle_event("save", %{"team" => params}, socket) do
    save(socket, socket.assigns.action, params)
  end

  defp save(socket, :edit, params) do
    case Teams.update_team(socket.assigns.resource, params) do
      {:ok, resource} ->
        notify_parent({:saved, resource})

        {:noreply,
         socket
         |> put_flash(:info, "Team updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  # Create a team within an organization
  defp save(socket, :new, params) do
    create_attrs = Map.merge(params, %{"organization_id" => socket.assigns.resource.id})
    creator = Map.get(socket.assigns, :current_user)

    case Teams.create_team(create_attrs, creator) do
      {:ok, resource} ->
        notify_parent({:created, resource})

        {:noreply,
         socket
         |> put_flash(:info, "Team created successfully")
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
