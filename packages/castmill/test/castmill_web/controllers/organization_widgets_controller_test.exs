defmodule CastmillWeb.OrganizationWidgetsControllerTest do
  @moduledoc """
  Tests for widget-related endpoints in the OrganizationController.
  """
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Organizations
  alias Castmill.Accounts

  describe "GET /dashboard/organizations/:organization_id/widgets/:widget_id" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, user} =
        Accounts.create_user(%{
          email: "test@test.com",
          name: "Test User",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, user.id, :member)

      # Create a test widget with minimal required fields
      widget =
        widget_fixture(%{
          name: "Test Widget",
          slug: "test-widget-#{System.unique_integer([:positive])}",
          template: %{
            "type" => "text",
            "name" => "text",
            "opts" => %{"text" => "Hello"}
          }
        })

      %{
        organization: organization,
        user: user,
        widget: widget,
        network: network
      }
    end

    test "returns widget details for authenticated user", %{
      conn: conn,
      organization: org,
      user: user,
      widget: widget
    } do
      conn =
        conn
        |> assign(:current_user, user)
        |> get("/dashboard/organizations/#{org.id}/widgets/#{widget.id}")

      assert %{"data" => widget_data} = json_response(conn, 200)
      assert widget_data["id"] == widget.id
      assert widget_data["name"] == widget.name
      assert widget_data["slug"] == widget.slug
    end

    test "returns 404 for non-existent widget", %{
      conn: conn,
      organization: org,
      user: user
    } do
      conn =
        conn
        |> assign(:current_user, user)
        |> get("/dashboard/organizations/#{org.id}/widgets/999999")

      assert json_response(conn, 404)["errors"]["detail"] == "Widget not found"
    end

    test "returns 401 for unauthenticated request", %{
      conn: conn,
      organization: org,
      widget: widget
    } do
      conn = get(conn, "/dashboard/organizations/#{org.id}/widgets/#{widget.id}")

      assert json_response(conn, 401)
    end
  end

  describe "GET /dashboard/organizations/:organization_id/widgets" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, user} =
        Accounts.create_user(%{
          email: "list-test@test.com",
          name: "List Test User",
          network_id: network.id
        })

      {:ok, _} = Organizations.set_user_role(organization.id, user.id, :member)

      %{
        organization: organization,
        user: user,
        network: network
      }
    end

    test "returns list of widgets for authenticated user", %{
      conn: conn,
      organization: org,
      user: user
    } do
      conn =
        conn
        |> assign(:current_user, user)
        |> get("/dashboard/organizations/#{org.id}/widgets")

      assert %{"data" => widgets, "count" => _count} = json_response(conn, 200)
      assert is_list(widgets)
    end

    test "returns 401 for unauthenticated request", %{
      conn: conn,
      organization: org
    } do
      conn = get(conn, "/dashboard/organizations/#{org.id}/widgets")

      assert json_response(conn, 401)
    end
  end
end
