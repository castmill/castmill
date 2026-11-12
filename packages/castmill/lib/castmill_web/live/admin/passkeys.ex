defmodule CastmillWeb.Live.Admin.Passkeys do
  use CastmillWeb, :live_view

  alias Castmill.Accounts
  alias Castmill.Accounts.AdminPasskeys

  @impl true
  def mount(_params, session, socket) do
    user =
      if socket.assigns.live_action == :enroll do
        token = session["admin_enrollment_token"]
        user = token && Accounts.get_user_by_admin_enrollment_token(token)
        if user && !AdminPasskeys.enrolled?(user.id), do: user
      else
        socket.assigns.current_user
      end

    if user do
      {:ok,
       socket
       |> assign_new(:current_user, fn -> nil end)
       |> assign(:page_title, "Admin passkeys")
       |> assign(:user, user)
       |> assign(:passkeys, AdminPasskeys.list(user.id))}
    else
      {:ok, redirect(socket, to: ~p"/admin/login")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-xl">
      <.header>
        Admin passkeys
        <:subtitle>
          <%= if @live_action == :enroll do %>
            Register your first passkey to access the admin tool. Password login will no longer work.
          <% else %>
            Keep at least two passkeys on separate devices in case one is lost.
          <% end %>
        </:subtitle>
      </.header>
      <form id="admin-passkey-register" phx-hook="AdminPasskey" data-action="register" class="mt-8">
        <label for="passkey-name" class="block text-sm font-semibold">Passkey name</label>
        <input
          id="passkey-name"
          name="name"
          type="text"
          maxlength="80"
          required
          placeholder="For example: Laptop or backup security key"
          class="mt-2 block w-full rounded-md text-gray-900"
        />
        <.button class="mt-4" type="submit">Register passkey</.button>
        <p data-passkey-error role="alert" class="mt-4 text-red-500" aria-live="polite"></p>
      </form>
      <div :if={@live_action != :enroll} class="mt-8">
        <h2 class="text-lg font-semibold">Registered passkeys</h2>
        <ul class="mt-4 space-y-4">
          <li :for={key <- @passkeys}>
            <span><%= key.name %></span>
            <.link
              :if={length(@passkeys) > 1}
              href={~p"/admin/passkeys/#{key.id}"}
              method="delete"
              data-confirm="Remove this passkey? All admin sessions will be signed out."
              class="ml-4"
            >
              Remove
            </.link>
          </li>
        </ul>
        <.back navigate={~p"/admin"}>Back to admin</.back>
      </div>
      <.link :if={@live_action == :enroll} href={~p"/admin/login"} class="mt-8 block">
        Back to sign in
      </.link>
    </div>
    """
  end
end
