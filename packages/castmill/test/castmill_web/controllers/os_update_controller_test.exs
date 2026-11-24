defmodule CastmillWeb.OsUpdateControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  alias Castmill.Organizations
  alias Castmill.OsUpdates

  @x86 "castmill-os-genericx86-64"

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    device = device_fixture(%{organization_id: organization.id})

    {:ok, _} =
      OsUpdates.import_manifest(%{
        "version" => "0.3.0",
        "published_at" => "2026-12-01T10:00:00Z",
        "artifacts" => %{
          @x86 => %{
            "url" => "https://github.com/castmill/castmill-os/releases/download/v0.3.0/x86.raucb",
            "sha256" => String.duplicate("b", 64),
            "size" => 10
          }
        }
      })

    users =
      for role <- [:admin, :guest] do
        user = user_fixture(%{network_id: network.id})
        {:ok, _} = Organizations.set_user_role(organization.id, user.id, role)
        {role, user}
      end
      |> Map.new()

    %{
      conn: put_req_header(conn, "accept", "application/json"),
      organization: organization,
      device: device,
      users: users
    }
  end

  defp as(conn, user), do: assign(conn, :current_user, user)

  test "admins read and set the organization policy", %{
    conn: conn,
    organization: org,
    users: users
  } do
    path = "/dashboard/organizations/#{org.id}/os-updates"

    assert %{"policy" => %{"mode" => "manual"}, "releases" => [%{"version" => "0.3.0"}]} =
             conn |> as(users.admin) |> get(path) |> json_response(200)

    assert %{"policy" => %{"mode" => "version", "version" => "0.3.0"}} =
             build_conn()
             |> as(users.admin)
             |> put(path, %{"mode" => "version", "version" => "0.3.0"})
             |> json_response(200)

    assert %{"error" => "unknown_version"} =
             build_conn()
             |> as(users.admin)
             |> put(path, %{"mode" => "version", "version" => "9.9.9"})
             |> json_response(422)
  end

  test "guests can't change the policy or a device override", %{
    conn: conn,
    organization: org,
    device: device,
    users: users
  } do
    assert conn
           |> as(users.guest)
           |> put("/dashboard/organizations/#{org.id}/os-updates", %{"mode" => "latest"})
           |> response(403)

    assert build_conn()
           |> as(users.guest)
           |> put("/dashboard/devices/#{device.id}/os-update", %{"mode" => "follow"})
           |> response(403)

    assert OsUpdates.get_policy(org.id)["mode"] == "manual"
  end

  test "admins set a device override", %{conn: conn, device: device, users: users} do
    assert %{"os_update" => %{"mode" => "version", "version" => "0.3.0", "now" => true}} =
             conn
             |> as(users.admin)
             |> put("/dashboard/devices/#{device.id}/os-update", %{
               "mode" => "version",
               "version" => "0.3.0",
               "now" => true
             })
             |> json_response(200)
  end
end
