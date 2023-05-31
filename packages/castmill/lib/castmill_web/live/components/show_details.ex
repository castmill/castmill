defmodule CastmillWeb.Live.Admin.Show do
  use CastmillWeb, :html

  use Phoenix.Component
  import CastmillWeb.CoreComponents

  import CastmillWeb.Live.Admin.Table
  import CastmillWeb.Live.Admin.Tabs
  import CastmillWeb.Live.Admin.Search

  def show_details(assigns) do
    ~H"""
    <div>
      <.header>
        <%= @type %> <%= @resource.name %>
        <:subtitle>Not sure what text should be here actually...</:subtitle>

        <:actions>
          <.link patch={~p"/admin/#{@bucket}/#{@resource}/edit"} phx-click={JS.push_focus()}>
            <.button>Edit <%= @type %></.button>
          </.link>
        </:actions>
      </.header>

      <.list>
        <:item :for={col <- @cols} title={col.name}><%= Map.get(@resource, col.field, "") %></:item>
      </.list>

      <div class="mt-8">
        <div class="text-lg font-semibold leading-8 text-blue-400">
          Resources
        </div>
        <.tabs tabs={@tabs} selected_tab={@selected_tab} base_url={@base_url}>
          <div :if={@selected_tab != nil} class="p-2">
            <div class="flex flex-row justify-between py-2">
              <.search placeholder="Search" phx-debounce="500" phx-target="search" phx-value="" />
              <!-- use href instead of patch because streams do not allow :reset yet -->
              <.link
                :if={Enum.find(@tabs, fn tab -> tab.href == @selected_tab end).form != nil}
                href={~p"/admin/#{@bucket}/#{@resource}/#{@selected_tab}/new"}
                phx-click={JS.push_focus()}
              >
                <.button>Add <%= @selected_tab %></.button>
              </.link>
            </div>
            <.admin_table
              rows={@rows}
              cols={@resource_cols}
              base_url={@base_resource_url}
              resource={@selected_tab}
            />
          </div>
        </.tabs>
      </div>
      <.back navigate={~p"/admin/#{@bucket}"}>Back to <%= @bucket %></.back>

      <.modal
        :if={@live_action == :edit}
        id="resource-modal"
        show
        on_cancel={JS.patch(~p"/admin/#{@bucket}/#{@resource}")}
      >
        <.live_component
          module={@form_module}
          id={@resource.id}
          title={@title}
          action={@live_action}
          resource={@resource}
          patch={~p"/admin/#{@bucket}/#{@resource}"}
        />
      </.modal>
      <!-- This modal is used to create new child resources, depending on the selected tab we need a different form -->
      <.modal
        :if={@live_action == :new && @selected_tab != nil}
        id="child-modal"
        show
        on_cancel={JS.patch(~p"/admin/#{@bucket}/#{@resource}")}
      >
        <.live_component
          module={Enum.find(@tabs, fn tab -> tab.href == @selected_tab end).form}
          id={:new}
          title={@title}
          action={@live_action}
          resource={@resource}
          patch={~p"/admin/#{@bucket}/#{@resource}"}
        />
      </.modal>
    </div>
    """
  end
end
