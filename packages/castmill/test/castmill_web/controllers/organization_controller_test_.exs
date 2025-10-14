defmodule CastmillWeb.OrganizationControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.OrganizationsFixtures

  alias Castmill.Organizations.Organization

  @create_attrs %{
    name: "some name"
  }
  @update_attrs %{
    name: "some updated name"
  }
  @invalid_attrs %{name: nil}

  setup %{conn: conn} do
    {:ok, conn: put_req_header(conn, "accept", "application/json")}
  end

  describe "index" do
    test "lists all organizations", %{conn: conn} do
      conn = get(conn, ~p"/api/organizations")
      assert json_response(conn, 200)["data"] == []
    end
  end

  describe "create organization" do
    test "renders organization when data is valid", %{conn: conn} do
      conn = post(conn, ~p"/api/organizations", organization: @create_attrs)
      assert %{"id" => id} = json_response(conn, 201)["data"]

      conn = get(conn, ~p"/api/organizations/#{id}")

      assert %{
               "id" => ^id,
               "name" => "some name"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn} do
      conn = post(conn, ~p"/api/organizations", organization: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "update organization" do
    setup [:create_organization]

    test "renders organization when data is valid", %{
      conn: conn,
      organization: %Organization{id: id} = organization
    } do
      conn = put(conn, ~p"/api/organizations/#{organization}", organization: @update_attrs)
      assert %{"id" => ^id} = json_response(conn, 200)["data"]

      conn = get(conn, ~p"/api/organizations/#{id}")

      assert %{
               "id" => ^id,
               "name" => "some updated name"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn, organization: organization} do
      conn = put(conn, ~p"/api/organizations/#{organization}", organization: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "delete organization" do
    setup [:create_organization]

    test "deletes chosen organization", %{conn: conn, organization: organization} do
      conn = delete(conn, ~p"/api/organizations/#{organization}")
      assert response(conn, 204)

      assert_error_sent 404, fn ->
        get(conn, ~p"/api/organizations/#{organization}")
      end
    end
  end

  describe "remove_member" do
    import Castmill.NetworksFixtures
    import Castmill.AccountsFixtures

    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      %{organization: organization, network: network}
    end

    test "allows a member to remove themselves", %{organization: organization} do
      member_user = user_fixture()
      Castmill.Organizations.add_user(organization.id, member_user.id, :member)
      admin_user = user_fixture()
      Castmill.Organizations.add_user(organization.id, admin_user.id, :admin)

      member_token =
        access_token_fixture(%{
          user_id: member_user.id,
          secret: "member:self",
          is_root: false
        })

      member_conn =
        build_conn()
        |> Map.put(:endpoint, CastmillWeb.Endpoint)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{member_token.secret}")

      conn =
        delete(
          member_conn,
          ~p"/dashboard/organizations/#{organization.id}/members/#{member_user.id}"
        )

      assert conn.status == 200
      users = Castmill.Organizations.list_users(%{organization_id: organization.id})
      refute Enum.any?(users, fn u -> u.user_id == member_user.id end)
    end

    test "allows an admin to remove themselves when another admin exists", %{
      organization: organization
    } do
      admin_one = user_fixture()
      admin_two = user_fixture()
      Castmill.Organizations.add_user(organization.id, admin_one.id, :admin)
      Castmill.Organizations.add_user(organization.id, admin_two.id, :admin)

      admin_token =
        access_token_fixture(%{
          user_id: admin_one.id,
          secret: "admin:self",
          is_root: false
        })

      admin_conn =
        build_conn()
        |> Map.put(:endpoint, CastmillWeb.Endpoint)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{admin_token.secret}")

      conn =
        delete(
          admin_conn,
          ~p"/dashboard/organizations/#{organization.id}/members/#{admin_one.id}"
        )

      assert conn.status == 200
    end

    test "prevents admin from leaving when they are the last admin", %{
      organization: organization
    } do
      admin_user = user_fixture()
      member_user = user_fixture()
      Castmill.Organizations.add_user(organization.id, admin_user.id, :admin)
      Castmill.Organizations.add_user(organization.id, member_user.id, :member)

      admin_token =
        access_token_fixture(%{
          user_id: admin_user.id,
          secret: "admin:last",
          is_root: false
        })

      admin_conn =
        build_conn()
        |> Map.put(:endpoint, CastmillWeb.Endpoint)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{admin_token.secret}")

      conn =
        delete(
          admin_conn,
          ~p"/dashboard/organizations/#{organization.id}/members/#{admin_user.id}"
        )

      assert conn.status == 422
      assert %{"error" => "cannot_remove_last_organization_admin"} = json_response(conn, 422)
    end

    test "prevents a member from removing another member", %{organization: organization} do
      acting_member = user_fixture()
      target_member = user_fixture()
      Castmill.Organizations.add_user(organization.id, acting_member.id, :member)
      Castmill.Organizations.add_user(organization.id, target_member.id, :member)

      member_token =
        access_token_fixture(%{
          user_id: acting_member.id,
          secret: "member:other",
          is_root: false
        })

      member_conn =
        build_conn()
        |> Map.put(:endpoint, CastmillWeb.Endpoint)
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{member_token.secret}")

      conn =
        delete(
          member_conn,
          ~p"/dashboard/organizations/#{organization.id}/members/#{target_member.id}"
        )

      assert conn.status == 403
    end
  end

  defp create_organization(_) do
    organization = organization_fixture()
    %{organization: organization}
  end
end
