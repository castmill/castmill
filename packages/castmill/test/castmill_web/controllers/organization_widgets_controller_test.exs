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

    test "does not return a widget owned by another organization", %{
      conn: conn,
      organization: org,
      user: user,
      network: network
    } do
      other_org = organization_fixture(%{network_id: network.id})

      other_widget =
        widget_fixture(%{
          name: "Other Organization Widget",
          slug: "other-org-widget-#{System.unique_integer([:positive])}",
          organization_id: other_org.id,
          template: %{"type" => "group", "name" => "root", "components" => []}
        })

      conn =
        conn
        |> assign(:current_user, user)
        |> get("/dashboard/organizations/#{org.id}/widgets/#{other_widget.id}")

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

  describe "widget asset endpoints" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      user_with_role = fn role ->
        {:ok, user} =
          Accounts.create_user(%{
            email: "assets-#{role}-#{System.unique_integer([:positive])}@test.com",
            name: "Assets #{role}",
            network_id: network.id
          })

        {:ok, _} = Organizations.set_user_role(organization.id, user.id, role)
        user
      end

      widget =
        widget_fixture(%{
          organization_id: organization.id,
          is_system: false,
          assets: %{"images" => %{}}
        })

      %{organization: organization, widget: widget, user_with_role: user_with_role}
    end

    test "users with widget update permission can delete assets", %{
      conn: conn,
      organization: org,
      widget: widget,
      user_with_role: user_with_role
    } do
      conn =
        conn
        |> assign(:current_user, user_with_role.(:editor))
        |> delete("/dashboard/organizations/#{org.id}/widgets/#{widget.id}/assets/images/logo")

      assert %{"id" => id} = json_response(conn, 200)
      assert id == widget.id
    end

    test "users with widget update permission reach the upload action", %{
      conn: conn,
      organization: org,
      widget: widget,
      user_with_role: user_with_role
    } do
      conn =
        conn
        |> assign(:current_user, user_with_role.(:editor))
        |> post("/dashboard/organizations/#{org.id}/widgets/#{widget.id}/assets", %{})

      assert json_response(conn, 400)["error"] == "A file and a category are required"
    end

    test "users without widget update permission are forbidden", %{
      conn: conn,
      organization: org,
      widget: widget,
      user_with_role: user_with_role
    } do
      member = user_with_role.(:member)

      upload_conn =
        conn
        |> assign(:current_user, member)
        |> post("/dashboard/organizations/#{org.id}/widgets/#{widget.id}/assets", %{})

      assert upload_conn.status == 403

      delete_conn =
        build_conn()
        |> assign(:current_user, member)
        |> delete("/dashboard/organizations/#{org.id}/widgets/#{widget.id}/assets/images/logo")

      assert delete_conn.status == 403
    end
  end
end
