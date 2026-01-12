defmodule CastmillWeb.OrganizationController.WidgetsTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Widgets

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  @moduletag :e2e

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    access_token =
      access_token_fixture(%{secret: "testuser:testpass", user_id: user.id, is_root: true})

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    # Create test widgets
    {:ok, widget1} =
      Widgets.create_widget(%{
        name: "Alpha Widget",
        slug: "alpha-widget",
        description: "First test widget",
        template: %{},
        options_schema: %{},
        data_schema: %{}
      })

    {:ok, widget2} =
      Widgets.create_widget(%{
        name: "Beta Widget",
        slug: "beta-widget",
        description: "Second test widget",
        template: %{},
        options_schema: %{},
        data_schema: %{}
      })

    {:ok, widget3} =
      Widgets.create_widget(%{
        name: "Gamma Widget",
        slug: "gamma-widget",
        description: "Third test widget",
        template: %{},
        options_schema: %{},
        data_schema: %{}
      })

    {:ok,
     conn: conn,
     user: user,
     organization: organization,
     widget1: widget1,
     widget2: widget2,
     widget3: widget3}
  end

  describe "GET /organizations/:organization_id/widgets" do
    test "lists all widgets with proper response format", %{
      conn: conn,
      organization: organization
    } do
      conn = get(conn, "/dashboard/organizations/#{organization.id}/widgets")
      response = json_response(conn, 200)

      assert %{"data" => data, "count" => count} = response
      assert is_list(data)
      assert is_integer(count)
      assert count >= 3
      assert length(data) >= 3
    end

    test "includes widget properties in response", %{
      conn: conn,
      organization: organization,
      widget1: widget1
    } do
      conn = get(conn, "/dashboard/organizations/#{organization.id}/widgets")
      response = json_response(conn, 200)

      widget = Enum.find(response["data"], fn w -> w["id"] == widget1.id end)
      assert widget["name"] == "Alpha Widget"
      assert widget["slug"] == "alpha-widget"
      assert widget["description"] == "First test widget"
    end

    test "supports pagination with page and page_size", %{
      conn: conn,
      organization: organization
    } do
      conn =
        get(conn, "/dashboard/organizations/#{organization.id}/widgets", %{
          page: "1",
          page_size: "2"
        })

      response = json_response(conn, 200)

      assert %{"data" => data, "count" => count} = response
      assert length(data) == 2
      assert count >= 3
    end

    test "supports search by widget name", %{
      conn: conn,
      organization: organization
    } do
      conn =
        get(conn, "/dashboard/organizations/#{organization.id}/widgets", %{
          search: "Alpha"
        })

      response = json_response(conn, 200)

      assert %{"data" => data, "count" => count} = response
      assert length(data) >= 1
      assert count >= 1
      assert Enum.all?(data, fn w -> String.contains?(w["name"], "Alpha") end)
    end

    test "search is case insensitive", %{
      conn: conn,
      organization: organization
    } do
      conn =
        get(conn, "/dashboard/organizations/#{organization.id}/widgets", %{
          search: "alpha"
        })

      response = json_response(conn, 200)

      assert %{"data" => data} = response
      assert length(data) >= 1
      assert Enum.any?(data, fn w -> String.contains?(w["name"], "Alpha") end)
    end

    test "returns empty list for non-matching search", %{
      conn: conn,
      organization: organization
    } do
      conn =
        get(conn, "/dashboard/organizations/#{organization.id}/widgets", %{
          search: "NonExistentWidget99999"
        })

      response = json_response(conn, 200)

      assert %{"data" => data, "count" => count} = response
      assert data == []
      assert count == 0
    end

    test "supports sorting by name ascending", %{
      conn: conn,
      organization: organization
    } do
      conn =
        get(conn, "/dashboard/organizations/#{organization.id}/widgets", %{
          key: "name",
          direction: "ascending"
        })

      response = json_response(conn, 200)

      names = Enum.map(response["data"], fn w -> w["name"] end)
      assert names == Enum.sort(names)
    end

    test "supports sorting by name descending", %{
      conn: conn,
      organization: organization
    } do
      conn =
        get(conn, "/dashboard/organizations/#{organization.id}/widgets", %{
          key: "name",
          direction: "descending"
        })

      response = json_response(conn, 200)

      names = Enum.map(response["data"], fn w -> w["name"] end)
      assert names == Enum.sort(names, :desc)
    end

    test "combines pagination, search, and sorting", %{
      conn: conn,
      organization: organization
    } do
      conn =
        get(conn, "/dashboard/organizations/#{organization.id}/widgets", %{
          page: "1",
          page_size: "10",
          search: "Widget",
          key: "name",
          direction: "ascending"
        })

      response = json_response(conn, 200)

      assert %{"data" => data, "count" => count} = response
      assert is_list(data)
      assert count >= 3

      if length(data) > 1 do
        names = Enum.map(data, fn w -> w["name"] end)
        assert names == Enum.sort(names)
      end
    end

    test "uses default values when parameters are not provided", %{
      conn: conn,
      organization: organization
    } do
      conn = get(conn, "/dashboard/organizations/#{organization.id}/widgets")
      response = json_response(conn, 200)

      assert %{"data" => data, "count" => _count} = response
      # Default page_size might return all or a default limit
      assert is_list(data)
    end
  end

  describe "GET /organizations/:organization_id/widgets/:widget_id/usage" do
    test "returns empty usage for widget not in any playlist", %{
      conn: conn,
      organization: organization,
      widget1: widget1
    } do
      conn = get(conn, "/dashboard/organizations/#{organization.id}/widgets/#{widget1.id}/usage")
      response = json_response(conn, 200)

      assert %{"data" => data, "count" => count} = response
      assert data == []
      assert count == 0
    end

    test "returns 404 for non-existent widget", %{
      conn: conn,
      organization: organization
    } do
      conn = get(conn, "/dashboard/organizations/#{organization.id}/widgets/999999/usage")
      response = json_response(conn, 404)

      assert %{"error" => "Widget not found"} = response
    end
  end

  describe "DELETE /organizations/:organization_id/widgets/:widget_id" do
    test "successfully deletes a widget not in use", %{
      conn: conn,
      organization: organization,
      widget3: widget3
    } do
      conn = delete(conn, "/dashboard/organizations/#{organization.id}/widgets/#{widget3.id}")
      assert response(conn, 204)

      # Verify widget is deleted
      assert Widgets.get_widget(widget3.id) == nil
    end

    test "returns 404 for non-existent widget", %{
      conn: conn,
      organization: organization
    } do
      conn = delete(conn, "/dashboard/organizations/#{organization.id}/widgets/999999")
      response = json_response(conn, 404)

      assert %{"error" => "Widget not found"} = response
    end
  end
end
