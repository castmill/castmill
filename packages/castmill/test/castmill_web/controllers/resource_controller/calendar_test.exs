defmodule CastmillWeb.ResourceController.CalendarsTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Teams

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.TeamsFixtures
  import Castmill.CalendarsFixtures

  @moduletag :e2e

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    team = team_fixture(%{organization_id: organization.id})
    {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :member)

    access_token =
      access_token_fixture(%{secret: "testuser:testpass", user_id: user.id, is_root: true})

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, organization: organization, team: team}
  end

  describe "list calendars" do
    test "lists all calendars", %{conn: conn, organization: organization} do
      calendar_fixture(%{
        organization_id: organization.id,
        name: "calendar1",
        timezone: "Europe/Amsterdam"
      })

      conn = get(conn, "/api/organizations/#{organization.id}/calendars")
      response = json_response(conn, 200)

      assert %{"data" => [%{"name" => "calendar1"}], "count" => 1} = response
    end

    test "lists calendars with pagination", %{conn: conn, organization: organization} do
      for i <- 1..5 do
        calendar_fixture(%{
          organization_id: organization.id,
          name: "calendar#{i}",
          timezone: "Europe/Amsterdam"
        })
      end

      conn =
        get(conn, "/api/organizations/#{organization.id}/calendars", %{page: 1, page_size: 2})

      response = json_response(conn, 200)

      assert %{"data" => [%{"name" => "calendar1"}, %{"name" => "calendar2"}], "count" => 5} =
               response
    end
  end

  describe "create calendars" do
    test "creates a new calendar", %{conn: conn, organization: organization} do
      calendar_params = %{
        "calendar" => %{"name" => "Office Calendar", "timezone" => "Europe/Amsterdam"}
      }

      conn = post(conn, "/api/organizations/#{organization.id}/calendars", calendar_params)
      response = json_response(conn, 201)

      assert %{"data" => %{"name" => "Office Calendar"}} = response
    end

    test "fails to create a new calendar when data is incomplete", %{
      conn: conn,
      organization: organization
    } do
      incomplete_calendar_params = %{"calendar" => %{}}

      conn =
        post(conn, "/api/organizations/#{organization.id}/calendars", incomplete_calendar_params)

      response = json_response(conn, 422)

      assert response["errors"] != nil
    end
  end

  describe "delete calendar" do
    test "deletes an existing calendar successfully", %{conn: conn, organization: organization} do
      calendar =
        calendar_fixture(%{
          organization_id: organization.id,
          name: "calendar1",
          timezone: "Europe/Amsterdam"
        })

      conn = delete(conn, "/api/organizations/#{organization.id}/calendars/#{calendar.id}")
      assert response(conn, 204)
    end

    test "fails to delete a non-existent calendar", %{conn: conn, organization: organization} do
      conn = delete(conn, "/api/organizations/#{organization.id}/calendars/0")
      assert response(conn, 404)
    end
  end

  describe "full calendar lifecycle" do
    test "creates and retrieves a new calendar from the list", %{
      conn: conn,
      organization: organization
    } do
      calendar_params = %{
        "calendar" => %{"name" => "Office Calendar", "timezone" => "Europe/Amsterdam"}
      }

      conn = post(conn, "/api/organizations/#{organization.id}/calendars", calendar_params)
      response = json_response(conn, 201)

      assert %{"data" => %{"name" => "Office Calendar", "id" => id}} = response

      conn = get(conn, "/api/organizations/#{organization.id}/calendars")
      retrieval_response = json_response(conn, 200)

      assert %{"data" => [%{"name" => "Office Calendar", "id" => ^id}], "count" => 1} =
               retrieval_response
    end
  end
end
