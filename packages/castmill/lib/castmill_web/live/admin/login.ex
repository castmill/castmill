defmodule CastmillWeb.Live.Admin.Login do
  use CastmillWeb, :live_view

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.header class="text-center">
        Welcome to Castmill Admin
        <:subtitle>
          Sign in with your admin passkey.
        </:subtitle>
      </.header>

      <form id="admin-passkey-login" phx-hook="AdminPasskey" data-action="login" class="mt-8">
        <label class="mb-4 block text-sm">
          <input type="checkbox" name="remember_me" value="true" /> Keep me signed in
        </label>
        <.button class="w-full" type="submit">Sign in with a passkey</.button>
        <p data-passkey-error role="alert" class="mt-4 text-red-500" aria-live="polite"></p>
      </form>

      <p class="mt-8 text-sm">
        First time here? Use root credentials below to register your first passkey.
        Once enrolled, a passkey is required to sign in.
      </p>
      <.simple_form for={@form} id="login_form" action={~p"/admin/login"} phx-update="ignore">
        <.input field={@form[:email]} type="email" label="Email" required />
        <.input field={@form[:password]} type="password" label="Password" required />

        <:actions>
          <p class="text-sm">
            Lost all admin passkeys? Contact the server operator for recovery.
          </p>
        </:actions>
        <:actions>
          <.button phx-disable-with="Signing in..." class="w-full">
            Set up first passkey <span aria-hidden="true">→</span>
          </.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    email = live_flash(socket.assigns.flash, :email)
    form = to_form(%{"email" => email}, as: "user")
    {:ok, assign(socket, form: form, current_user: nil), temporary_assigns: [form: form]}
  end
end
