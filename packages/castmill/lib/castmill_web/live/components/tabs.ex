defmodule CastmillWeb.Live.Admin.Tabs do
  use Phoenix.Component
  import CastmillWeb.CoreComponents

  slot :inner_block, required: true
  attr :tabs, :list, required: true
  attr :selected_tab, :string, required: true

  def tabs(assigns) do
    ~H"""
    <div>
      <div class="text-sm font-medium text-center text-gray-500 border-b border-gray-200 dark:text-gray-400 dark:border-gray-700">
        <ul class="flex flex-wrap -mb-px">
          <li :for={tab <- @tabs} class="mr-2">
            <!-- due to a streams lacking reset we need to use href instead of patch -->
            <.link href={"#{@base_url}/#{tab.href}"} class={active_link(tab, @selected_tab)}>
              <.icon name={tab.icon} class="h-4 w-4" />
              <%= tab.name %>
            </.link>
          </li>
        </ul>
      </div>
      <%= render_slot(@inner_block) %>
    </div>
    """
  end

  defp active_link(tab, selected_tab) do
    if tab.href == selected_tab do
      "inline-block p-4 text-blue-600 border-b-2 border-blue-600 rounded-t-lg active dark:text-blue-500 dark:border-blue-500"
    else
      "inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300"
    end
  end

  # TODO: add support for disabled: "inline-block p-4 text-gray-400 rounded-t-lg cursor-not-allowed dark:text-gray-500"
end
