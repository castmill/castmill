defmodule CastmillWeb.Live.Admin.UserForm do
  use CastmillWeb, :live_component

  alias Castmill.Accounts
  alias Castmill.Networks
  alias Castmill.Organizations
  alias Castmill.Organizations.Organization

  @roles ~w(admin manager member guest)

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1><%= title(@action, @resource) %></h1>
        <p :if={@action == :new} class="text-sm text-gray-600 mt-2">
          Enter the email of an existing user, for example yourself, or of a new person. New
          people get an account and create a passkey with "Lost your credentials?" when they sign in.
        </p>
      </div>
      <.simple_form
        for={@form}
        id="user-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <.input field={@form[:email]} type="text" label="Email" />
        <.input
          field={@form[:name]}
          type="text"
          label={if @action == :new, do: "Name (only for new users)", else: "Name"}
        />
        <.input
          :if={@action == :new}
          id="user-role"
          name="user[role]"
          type="select"
          label="Role"
          value={@role}
          options={Enum.map(roles(), &{String.capitalize(&1), &1})}
        />

        <:actions>
          <.button phx-disable-with="Saving...">
            <%= if @action == :new, do: "Add User", else: "Save User" %>
          </.button>
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
     |> assign(:role, "member")
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

    {:noreply,
     socket
     |> assign(:role, params["role"] || socket.assigns[:role])
     |> assign_form(changeset)}
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

  # Adds a new or existing user to the organization whose Users tab this is.
  defp save(%{assigns: %{resource: %Organization{} = organization}} = socket, :new, params) do
    role = if params["role"] in @roles, do: params["role"], else: "member"

    case Organizations.add_member_by_email(organization, params, String.to_existing_atom(role)) do
      {:ok, user} ->
        notify_parent({:created, user})

        {:noreply,
         socket
         |> put_flash(:info, added_message(user, organization, role))
         |> push_patch(to: socket.assigns.patch)}

      # A component's flash is dropped unless it navigates, so errors are
      # shown in the form, which stays open.
      {:error, :already_member} ->
        {:noreply,
         socket
         |> assign(:role, role)
         |> assign_form(
           socket.assigns.user
           |> Accounts.change_user(params)
           |> Ecto.Changeset.add_error(:email, "is already a member of this organization")
           |> Map.put(:action, :insert)
         )}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, socket |> assign(:role, role) |> assign_form(changeset)}
    end
  end

  defp added_message(user, organization, role) do
    message = "#{user.email} was added to #{organization.name} as #{role}."

    if Accounts.list_user_credentials(user.id) == [] do
      network = Networks.get_network(organization.network_id)

      message <>
        " To sign in, they choose \"Lost your credentials?\" on #{Networks.dashboard_url(network)}" <>
        " to create a passkey."
    else
      message
    end
  end

  defp title(:new, %Organization{name: name}), do: "Add User to #{name}"
  defp title(_action, _resource), do: "User Settings"

  defp roles, do: @roles

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    assign(socket, :form, to_form(changeset))
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
end
