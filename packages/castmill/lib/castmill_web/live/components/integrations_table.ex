defmodule CastmillWeb.Live.Admin.IntegrationsTable do
  @moduledoc """
  Custom table component for displaying widget integrations with configuration actions.
  """
  use CastmillWeb, :html
  use Phoenix.Component

  attr(:network_id, :string, required: true)
  attr(:cols, :list, required: true)
  attr(:rows, :any, required: true)

  def integrations_table(assigns) do
    # Handle both stream format ({dom_id, item}) and regular list format
    rows = normalize_rows(assigns.rows)
    assigns = assign(assigns, :normalized_rows, rows)

    ~H"""
    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <table class="min-w-full divide-y divide-gray-300">
        <thead class="bg-gray-50">
          <tr>
            <th
              :for={col <- @cols}
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              <%= col.name %>
            </th>
            <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr :for={row <- @normalized_rows} id={"integration-#{row.id}"} class="hover:bg-gray-50">
            <td :for={col <- @cols} class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
              <%= if col.field == :status do %>
                <span class={[
                  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                  if(row.is_configured,
                    do: "bg-green-50 text-green-700 ring-green-600/20",
                    else: "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
                  )
                ]}>
                  <%= Map.get(row, col.field, "") %>
                </span>
              <% else %>
                <%= Map.get(row, col.field, "") %>
              <% end %>
            </td>
            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
              <.link
                navigate={~p"/admin/networks/#{@network_id}/integrations/#{row.id}/configure"}
                class="text-indigo-600 hover:text-indigo-900"
              >
                Configure<span class="sr-only">, <%= row.name %></span>
              </.link>
            </td>
          </tr>
          <tr :if={Enum.empty?(@normalized_rows)}>
            <td colspan={length(@cols) + 1} class="px-3 py-8 text-center text-sm text-gray-500">
              No integrations available
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    """
  end

  # Handle stream format: list of {dom_id, item} tuples
  defp normalize_rows(rows) when is_list(rows) do
    Enum.map(rows, fn
      {_dom_id, item} when is_map(item) -> item
      item when is_map(item) -> item
      _ -> nil
    end)
    |> Enum.reject(&is_nil/1)
  end

  # Handle Phoenix.LiveView.LiveStream
  defp normalize_rows(%Phoenix.LiveView.LiveStream{} = stream) do
    stream
    |> Enum.map(fn {_dom_id, item} -> item end)
  end

  defp normalize_rows(_), do: []
end
