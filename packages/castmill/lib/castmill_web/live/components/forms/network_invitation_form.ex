defmodule CastmillWeb.Live.Admin.NetworkInvitationForm do
  use CastmillWeb, :live_component

  alias Castmill.Networks

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
    form = to_form(%{"email" => "", "organization_name" => ""})

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:form, form)}
  end

  @impl true
  def handle_event("validate", %{"email" => _email, "organization_name" => _org_name}, socket) do
    {:noreply, socket}
  end

  def handle_event("save", %{"email" => email, "organization_name" => organization_name}, socket) do
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
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
            Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
              opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
            end)
          end)

        error_msg =
          errors
          |> Enum.map(fn {field, messages} ->
            "#{field}: #{Enum.join(messages, ", ")}"
          end)
          |> Enum.join("; ")

        {:noreply,
         socket
         |> put_flash(:error, "Failed to create invitation: #{error_msg}")}

      {:error, _} ->
        {:noreply,
         socket
         |> put_flash(:error, "Failed to create invitation")}
    end
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
end
