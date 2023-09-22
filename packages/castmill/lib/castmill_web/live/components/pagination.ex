defmodule CastmillWeb.Live.Admin.Pagination do
  use Phoenix.Component
  use CastmillWeb, :html

  # Get the list of pages to show in the pagination. The list will never be longer than 7 items.
  # If the total number of pages is less than 7, all pages will be shown.
  # If there are more than 7 pages, ellipsis will be used to indicate that there are more pages.
  defp get_pages_to_show(_page, total_pages) when total_pages <= 0, do: []

  defp get_pages_to_show(_page, total_pages) when total_pages <= 7,
    do: 1..total_pages |> Enum.to_list()

  defp get_pages_to_show(page, total_pages) when total_pages > 7 and page <= 4,
    do: Enum.to_list(1..5) ++ [nil, total_pages]

  defp get_pages_to_show(page, total_pages) when total_pages > 7 and page >= total_pages - 3,
    do: [1, nil] ++ Enum.to_list((total_pages - 4)..total_pages)

  defp get_pages_to_show(page, total_pages),
    do: [1, nil] ++ Enum.to_list((page - 1)..(page + 1)) ++ [nil, total_pages]

  def pagination(assigns) do
    total_pages = ceil(assigns.total_items / assigns.options.page_size)
    pages_to_show = get_pages_to_show(assigns.options.page, total_pages)

    assigns =
      assign(
        assigns,
        total_pages: total_pages,
        selected_link: assigns.selected_link,
        page: assigns.options.page,
        has_previous: assigns.options.page > 1,
        has_next: assigns.options.page < total_pages,
        from: assigns.options.page_size * (assigns.options.page - 1) + 1,
        to: min(assigns.options.page_size * assigns.options.page, assigns.total_items),
        pages_to_show: pages_to_show
      )

    ~H"""
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700">
          Showing
          <span :if={@total_pages > 1}>
            <span class="font-medium">
              <%= @from %>
            </span>
            to
            <span class="font-medium">
              <%= @to %>
            </span>
            of
          </span>
          <span class="font-medium">
            <%= @total_items %>
          </span>
          results
        </p>
      </div>
      <nav
        :if={@total_pages > 1}
        class="isolate inline-flex -space-x-px rounded-md shadow-sm"
        aria-label="Pagination"
      >
        <.link
          patch={~p"/admin/#{@selected_link}?#{%{@options | page: @page - 1}}"}
          class={"relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 dark:text-slate-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 #{if !@has_previous, do: "pointer-events-none opacity-50"}"}
        >
          <span class="sr-only">Previous</span>
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clip-rule="evenodd"
            />
          </svg>
        </.link>

        <%= for pageNo <- @pages_to_show do %>
          <%= if pageNo == nil do %>
            <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-400 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
              ...
            </span>
          <% else %>
            <.link
              aria-current={if pageNo == @page, do: "page", else: nil}
              patch={~p"/admin/#{@selected_link}?#{%{@options | page: pageNo}}"}
              class={"#{if pageNo == @page,
                do: "relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                else: "relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-slate-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"}"}
            >
              <%= pageNo %>
            </.link>
          <% end %>
        <% end %>

        <.link
          patch={~p"/admin/#{@selected_link}?#{%{@options | page: @page + 1}}"}
          class={"relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 #{if !@has_next, do: "pointer-events-none opacity-50"}"}
        >
          <span class="sr-only">Next</span>
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clip-rule="evenodd"
            />
          </svg>
        </.link>
      </nav>
    </div>
    """
  end
end
