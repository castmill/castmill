defmodule CastmillWeb.Live.Admin.UserForm do
  use CastmillWeb, :live_component

  alias Castmill.Accounts
  alias Castmill.Organizations

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1>User Settings</h1>
      </div>
      <.simple_form
        for={@form}
        id="user-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <.input field={@form[:name]} type="text" label="Name" />
        <.input field={@form[:email]} type="text" label="Email" />
        <.input
          field={@form[:network_role]}
          type="select"
          prompt="Select a role"
          options={[{"Member", :member}, {"Admin", :admin}]}
          label="Network Role"
        />

        <:actions>
          <.button phx-disable-with="Saving...">Save User</.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  @impl true
  def update(%{action: :new} = assigns, socket) do
    user = %Accounts.User{}
    changeset = Accounts.change_user(user)

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:user, user)
     |> assign_form(changeset)}
  end

  @impl true
  def update(%{resource: user} = assigns, socket) when not is_nil(user) do
    changeset = Accounts.change_user(user)

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:user, user)
     |> assign_form(changeset)}
  end

  @impl true
  def update(assigns, socket) do
    {:ok, assign(socket, assigns)}
  end

  @impl true
  def handle_event("validate", %{"user" => params}, socket) do
    changeset =
      socket.assigns.user
      |> Accounts.change_user(params)
      |> Map.put(:action, :validate)

    {:noreply, assign_form(socket, changeset)}
  end

  def handle_event("save", %{"user" => params}, socket) do
    save(socket, socket.assigns.action, params)
  end

  defp save(socket, :edit, params) do
    case Accounts.update_user(socket.assigns.resource, params) do
      {:ok, resource} ->
        notify_parent({:saved, resource})

        {:noreply,
         socket
         |> put_flash(:info, "User updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  # Create a user within an organization
  defp save(socket, :new, %{"role" => role} = params) do
    organization = Organizations.get_organization!(socket.assigns.resource.id)

    case Accounts.create_user(
           Map.merge(params, %{
             "network_id" => organization.network_id,
             "organization_id" => organization.id
           })
         ) do
      {:ok, user} ->
        case Organizations.add_user(organization.id, user.id, String.to_existing_atom(role)) do
          {:ok, _} ->
            notify_parent({:created, user})

            {:noreply,
             socket
             |> put_flash(:info, "User created successfully")
             |> push_patch(to: socket.assigns.patch)}

          {:error, %Ecto.Changeset{} = changeset} ->
            {:noreply, assign_form(socket, changeset)}
        end

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign_form(socket, changeset)}
    end
  end

  # TODO: Create a user within a Network, for instance a network admin user

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    assign(socket, :form, to_form(changeset))
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
end
