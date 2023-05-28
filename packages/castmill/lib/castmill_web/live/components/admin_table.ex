defmodule CastmillWeb.Live.Admin.Table do
  use Phoenix.Component
  import CastmillWeb.CoreComponents

  alias Phoenix.LiveView.JS

  attr(:base_url, :string, required: true)
  attr(:cols, :list, required: true)
  attr(:resource, :string, required: true)
  attr(:rows, :list, required: true)

  def admin_table(assigns) do
    ~H"""
    <div>
      <.table
        id="networks"
        rows={@rows}
        row_click={fn {_id, row} -> JS.navigate("#{@base_url}/#{row.id}") end}
      >
        <:col :let={{_id, row}} :for={col <- @cols} label={col.name}>
          <%= Map.get(row, col.field, "") %>
        </:col>

        <:action :let={{_id, row}}>
          <div class="sr-only">
            <.link navigate={"#{@base_url}/#{row.id}"}>Show</.link>
          </div>
          <.link patch={"#{@base_url}/#{row.id}/edit"}>Edit</.link>
        </:action>
        <:action :let={{id, row}}>
          <.link
            phx-click={JS.push("delete", value: %{id: row.id, resource: @resource}) |> hide("##{id}")}
            data-confirm="Are you sure?"
          >
            Delete
          </.link>
        </:action>
      </.table>
    </div>
    """
  end
end
