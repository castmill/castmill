defmodule CastmillWeb.Live.Admin.NetworkInvitationForm do
  use CastmillWeb, :live_component

  alias Castmill.Networks
  alias Castmill.Networks.NetworkInvitation

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1>Invite User to New Organization</h1>
        <p class="text-sm text-gray-600 mt-2">
          Invite a user to create and admin a new organization in this network.
        </p>
      </div>
      <.simple_form
        for={@form}
        id="network-invitation-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <.input field={@form[:email]} type="email" label="Email" required />
        <.input field={@form[:organization_name]} type="text" label="Organization Name" required />

        <:actions>
          <.button phx-disable-with="Sending invitation...">Send Invitation</.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  @impl true
  def update(assigns, socket) do
    changeset = NetworkInvitation.changeset(%NetworkInvitation{}, %{})

    # Extract network_id - could come from direct assignment or from resource struct
    network_id = assigns[:network_id] || (assigns[:resource] && assigns[:resource].id)

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:network_id, network_id)
     |> assign(:form, to_form(changeset))}
  end

  @impl true
  def handle_event("validate", %{"network_invitation" => params}, socket) do
    # Add a dummy token and network_id for validation purposes
    params_with_required =
      Map.merge(params, %{
        "token" => "temp_token",
        "network_id" => socket.assigns.network_id
      })

    changeset =
      %NetworkInvitation{}
      |> NetworkInvitation.changeset(params_with_required)
      |> Map.put(:action, :validate)

    {:noreply, assign(socket, :form, to_form(changeset))}
  end

  # Handle old format for backwards compatibility
  def handle_event("validate", %{"email" => email, "organization_name" => org_name}, socket) do
    handle_event(
      "validate",
      %{"network_invitation" => %{"email" => email, "organization_name" => org_name}},
      socket
    )
  end

  def handle_event("save", %{"network_invitation" => params}, socket) do
    email = params["email"]
    organization_name = params["organization_name"]
    do_save(socket, email, organization_name)
  end

  # Handle old format for backwards compatibility
  def handle_event("save", %{"email" => email, "organization_name" => organization_name}, socket) do
    do_save(socket, email, organization_name)
  end

  defp do_save(socket, email, organization_name) do
    # First validate the changeset locally to catch validation errors like invalid email
    params = %{
      "email" => email,
      "organization_name" => organization_name,
      "token" => "temp_validation",
      "network_id" => socket.assigns.network_id
    }

    changeset =
      %NetworkInvitation{}
      |> NetworkInvitation.changeset(params)
      |> Map.put(:action, :validate)

    if changeset.valid? do
      # Proceed with the actual invitation
      case Networks.invite_user_to_new_organization(
             socket.assigns.network_id,
             email,
             organization_name
           ) do
        {:ok, _invitation} ->
          notify_parent({:invited, email})

          {:noreply,
           socket
           |> put_flash(:info, "Invitation sent successfully to #{email}")
           |> push_patch(to: socket.assigns.patch)}

        {:error, error} when is_binary(error) ->
          {:noreply,
           socket
           |> put_flash(:error, error)}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:noreply, assign(socket, :form, to_form(changeset))}

        {:error, _} ->
          {:noreply,
           socket
           |> put_flash(:error, "Failed to create invitation")}
      end
    else
      # Changeset has validation errors (e.g., invalid email)
      {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
end
