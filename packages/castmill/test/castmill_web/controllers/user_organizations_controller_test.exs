defmodule CastmillWeb.UserOrganizationsControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Organizations

  setup do
    first_network = network_fixture(%{domain: "app.first-network.test"})
    second_network = network_fixture(%{domain: "app.second-network.test"})

    first_org = organization_fixture(%{network: first_network, name: "First Org"})
    second_org = organization_fixture(%{network: second_network, name: "Second Org"})
    other_org = organization_fixture(%{network: first_network, name: "Other Org"})

    user = user_fixture()
    {:ok, _} = Organizations.add_user(first_org.id, user.id, :admin)
    {:ok, _} = Organizations.add_user(second_org.id, user.id, :member)

    %{user: user, first_org: first_org, second_org: second_org, other_org: other_org}
  end

  test "lists the user's organizations in the network of the dashboard's domain", %{
    conn: conn,
    user: user,
    first_org: first_org,
    second_org: second_org
  } do
    assert organization_ids(conn, user, "https://app.first-network.test") == [first_org.id]
    assert organization_ids(conn, user, "https://app.second-network.test") == [second_org.id]
  end

  test "lists all of the user's organizations without an Origin", %{
    conn: conn,
    user: user,
    first_org: first_org,
    second_org: second_org
  } do
    assert Enum.sort(organization_ids(conn, user, nil)) ==
             Enum.sort([first_org.id, second_org.id])
  end

  test "requires a dashboard token", %{conn: conn, user: user} do
    conn = get(conn, ~p"/dashboard/users/#{user.id}/organizations")
    assert conn.status == 401
  end

  defp organization_ids(conn, user, origin) do
    token =
      Phoenix.Token.sign(
        CastmillWeb.Endpoint,
        CastmillWeb.Secrets.get_dashboard_user_token_salt(),
        user.id
      )

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer " <> token)

    conn = if origin, do: put_req_header(conn, "origin", origin), else: conn

    conn
    |> get(~p"/dashboard/users/#{user.id}/organizations")
    |> json_response(200)
    |> Map.fetch!("data")
    |> Enum.map(& &1["id"])
  end
end
