defmodule CastmillWeb.Live.Admin.Topbar do
  use CastmillWeb, :html
  use Phoenix.Component

  attr :current_user, :any, required: true

  def topbar(assigns) do
    ~H"""
    <header
      class="z-40 pr-4 py-2 w-full transition-transform -translate-x-full sm:translate-x-0 bg-gray-50 dark:bg-gray-800"
      aria-label="Topbar"
    >
      <div class="flex items-center justify-between py-3 text-sm">
        <div class="flex items-center">
          <a href="https://castmill.io">
            <div class="w-56 h-10 bg-[url('/images/castmill-logo.png')] bg-no-repeat bg-center"></div>
          </a>
          <p class="bg-brand/5 text-brand rounded-full px-2 font-medium leading-6">
            v<%= Application.spec(:castmill, :vsn) %>
          </p>
        </div>

        <div class="flex items-center gap-4 font-semibold leading-6 text-zinc-300">
          <div :if={@current_user} class="text-zink-200 font-bold">
            <a href={~p"/admin/settings"} class="hover:text-zinc-600">
              <%= @current_user.email %>
            </a>

            <.link
              href={~p"/admin/logout"}
              method="delete"
              class="text-[0.8125rem] leading-6 text-zinc-200 font-semibold hover:text-zinc-700"
            >
              Log out
            </.link>
          </div>

          <a href="https://twitter.com/castmill" class="hover:text-zinc-600">
            @castmill
          </a>
          <a href="https://github.com/castmill" class="hover:text-zinc-600">
            GitHub
          </a>
          <a
            href="https://docs.castmill.io"
            class="rounded-lg bg-zinc-600 px-2 py-1 hover:bg-zinc-200/80"
          >
            Help <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </header>
    """
  end
end
