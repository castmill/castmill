defmodule CastmillWeb.AddonsVisibilityTest do
  use CastmillWeb.ConnCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  defmodule ShownAddon do
    def component_info, do: %Castmill.Addons.ComponentInfo{id: "shown", name: "Shown"}
  end

  defmodule NetworkOnlyAddon do
    def component_info,
      do: %Castmill.Addons.ComponentInfo{id: "network-only", name: "Network only"}

    def visible?(%{network_id: network_id}),
      do: network_id == Application.get_env(:castmill, :visible_addon_network)
  end

  setup %{conn: conn} do
    previous = Application.get_env(:castmill, :external_addons)

    Application.put_env(:castmill, :external_addons, [{ShownAddon, []}, {NetworkOnlyAddon, []}])

    on_exit(fn ->
      Application.put_env(:castmill, :external_addons, previous || [])
      Application.delete_env(:castmill, :visible_addon_network)
    end)

    network = network_fixture()
    other_network = network_fixture()
    Application.put_env(:castmill, :visible_addon_network, network.id)
    %{conn: conn, network: network, other_network: other_network}
  end

  defp addon_ids(conn, network) do
    user = user_fixture(%{network_id: network.id})

    conn
    |> Plug.Test.init_test_session(user_id: user.id)
    |> assign(:current_user, user)
    |> put_req_header("accept", "application/json")
    |> put_req_header("origin", network.domain)
    |> get("/dashboard/addons")
    |> json_response(200)
    |> Enum.map(& &1["id"])
  end

  test "add-ons can hide themselves on other networks' dashboards", %{
    conn: conn,
    network: network,
    other_network: other_network
  } do
    assert "network-only" in addon_ids(conn, network)
    assert "shown" in addon_ids(conn, network)

    refute "network-only" in addon_ids(conn, other_network)
    assert "shown" in addon_ids(conn, other_network)
  end

  test "without a context every add-on is listed" do
    ids = Enum.map(Castmill.Addons.Supervisor.list_component_infos(), & &1.id)
    assert "network-only" in ids
  end
end
