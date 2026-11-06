defmodule CastmillWeb.WidgetChoicesController do
  @moduledoc """
  Lists integration-provided choices for widget options.

  POST /dashboard/organizations/:organization_id/widgets/:widget_id/choices/:field

  The actor must be allowed to update playlists in the organization, because the
  values end up in playlist widget configurations.
  """
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash
  alias Castmill.Widgets
  alias Castmill.Widgets.Integrations.Choices

  plug(AuthorizeDash)

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, :list_choices, %{"organization_id" => organization_id}) do
    {:ok, Organizations.has_access(organization_id, actor_id, "playlists", :update)}
  end

  def check_access(_actor_id, _action, _params), do: {:ok, false}

  def list_choices(
        conn,
        %{"organization_id" => organization_id, "widget_id" => widget_id, "field" => field} =
          params
      ) do
    case widget_for_organization(organization_id, widget_id) do
      nil ->
        error(conn, :not_found, "widget_not_found")

      widget ->
        request = Map.take(params, ["options", "query", "cursor", "values"])

        case Choices.list(organization_id, widget, field, request, actor_id: actor_id(conn)) do
          {:ok, %{items: items, next: next}} ->
            json(conn, %{items: items, next: next})

          {:error, :not_a_choice_field} ->
            error(conn, :not_found, "not_a_choice_field")

          {:error, :missing_dependency} ->
            error(conn, :unprocessable_entity, "missing_dependency")

          {:error, :no_credentials} ->
            error(conn, :unprocessable_entity, "missing_credentials")

          {:error, :rate_limited} ->
            error(conn, :too_many_requests, "rate_limited")

          {:error, _reason} ->
            error(conn, :bad_gateway, "provider_error")
        end
    end
  end

  # Widget Access policies apply: widgets the organization cannot use are not found.
  defp widget_for_organization(organization_id, widget_id) do
    case Integer.parse(to_string(widget_id)) do
      {_id, ""} -> Widgets.get_available_widget(organization_id, widget_id)
      _ -> Widgets.get_available_widget_by_slug(organization_id, widget_id)
    end
  end

  defp actor_id(conn) do
    case conn.assigns[:current_actor] || conn.assigns[:current_user] do
      %{id: id} -> id
      _ -> nil
    end
  end

  defp error(conn, status, code) do
    conn
    |> put_status(status)
    |> json(%{error: code})
  end
end
