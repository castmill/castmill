defmodule CastmillWeb.Live.Admin.Table do
  use Phoenix.Component
  import CastmillWeb.CoreComponents

  alias Phoenix.LiveView.JS
  alias Castmill.Organizations.Organization

  attr(:base_url, :string, default: nil)
  attr(:cols, :list, required: true)
  attr(:resource, :string, required: true)
  attr(:rows, :list, required: true)

  def admin_table(assigns) do
    # Helper function to extract the item from LiveStream tuple or return as-is for regular lists
    row_item = fn
      {_dom_id, item} -> item
      item -> item
    end

    # Only set row_click if base_url is provided
    row_click =
      if assigns.base_url do
        fn row -> JS.navigate("#{assigns.base_url}/#{row_item.(row).id}") end
      else
        nil
      end

    assigns =
      assigns
      |> assign(:row_item, row_item)
      |> assign(:row_click, row_click)

    ~H"""
    <div>
      <.table id="networks" rows={@rows} row_item={@row_item} row_click={@row_click}>
        <:col :let={row} :for={col <- @cols} label={col.name}>
          <%= if Map.has_key?(col, :render),
            do: col.render.(row),
            else: Map.get(@row_item.(row), col.field, "") %>
        </:col>

        <:action :let={row}>
          <%= if @base_url do %>
            <div class="sr-only">
              <.link navigate={"#{@base_url}/#{@row_item.(row).id}"}>Show</.link>
            </div>
            <.link patch={"#{@base_url}/#{@row_item.(row).id}/edit"}>Edit</.link>
          <% end %>
        </:action>
        <:action :let={row}>
          <%= if @resource == "organizations" do %>
            <%= if Organization.blocked?(@row_item.(row)) do %>
              <.link
                phx-click={JS.push("unblock", value: %{id: @row_item.(row).id, resource: @resource})}
                data-confirm="Are you sure you want to unblock this organization?"
              >
                Unblock
              </.link>
            <% else %>
              <.link
                phx-click={JS.push("block", value: %{id: @row_item.(row).id, resource: @resource})}
                data-confirm="Are you sure you want to block this organization? Users will not be able to login."
              >
                Block
              </.link>
            <% end %>
          <% end %>
        </:action>
        <:action :let={row}>
          <.link
            phx-click={
              JS.push("delete", value: %{id: @row_item.(row).id, resource: @resource})
              |> hide("##{@row_item.(row).id}")
            }
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
