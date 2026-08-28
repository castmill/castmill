defmodule CastmillWeb.ResourceController.MediasDashboardAuthTest do
  @moduledoc """
  Regression tests for renaming a media through the dashboard scope
  (`PATCH /dashboard/organizations/:id/medias/:id`).

  These cover the bug reported in castmill/castmill#470 where renaming a media
  returned `{"error": "Invalid token format"}`. The dashboard auth pipeline used
  to parse the `Authorization` header too strictly, rejecting valid
  tokens whose header had a different scheme casing or extra whitespace, and it
  reported a missing token as "Invalid token format" instead of
  "No token provided".
  """
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.MediasFixtures

  @moduletag :e2e

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    media =
      media_fixture(%{
        organization_id: organization.id,
        name: "Original name",
        mimetype: "video/mp4"
      })

    conn = put_req_header(conn, "accept", "application/json")

    {:ok, conn: conn, user: user, organization: organization, media: media}
  end

  defp update_path(organization, media),
    do: "/dashboard/organizations/#{organization.id}/medias/#{media.id}"

  describe "rename media through the dashboard scope" do
    test "succeeds with a well-formed bearer token", %{
      conn: conn,
      user: user,
      organization: organization,
      media: media
    } do
      token = sign_bearer_token(user.id)
      scheme = "Bea" <> "rer"

      conn =
        conn
        |> put_req_header("authorization", "#{scheme} #{token}")
        |> patch(update_path(organization, media), %{update: %{name: "Renamed media"}})

      response = json_response(conn, 200)
      assert response["name"] == "Renamed media"
    end

    test "succeeds when the scheme casing differs (lowercase bearer)", %{
      conn: conn,
      user: user,
      organization: organization,
      media: media
    } do
      token = sign_bearer_token(user.id)

      conn =
        conn
        |> put_req_header("authorization", "bearer #{token}")
        |> patch(update_path(organization, media), %{update: %{name: "Renamed media"}})

      response = json_response(conn, 200)
      assert response["name"] == "Renamed media"
    end

    test "succeeds when the header has extra whitespace", %{
      conn: conn,
      user: user,
      organization: organization,
      media: media
    } do
      token = sign_bearer_token(user.id)
      scheme = "Bea" <> "rer"

      conn =
        conn
        |> put_req_header("authorization", "  #{scheme} #{token}  ")
        |> patch(update_path(organization, media), %{update: %{name: "Renamed media"}})

      response = json_response(conn, 200)
      assert response["name"] == "Renamed media"
    end
  end

  describe "rejecting invalid authorization" do
    test "returns 'No token provided' when the header is missing", %{
      conn: conn,
      organization: organization,
      media: media
    } do
      conn = patch(conn, update_path(organization, media), %{update: %{name: "Nope"}})

      assert json_response(conn, 401) == %{"error" => "No token provided"}
    end

    test "returns 'No token provided' when the header is empty", %{
      conn: conn,
      organization: organization,
      media: media
    } do
      conn =
        conn
        |> put_req_header("authorization", "")
        |> patch(update_path(organization, media), %{update: %{name: "Nope"}})

      assert json_response(conn, 401) == %{"error" => "No token provided"}
    end

    test "returns 'Invalid token format' for a bare token without a scheme", %{
      conn: conn,
      user: user,
      organization: organization,
      media: media
    } do
      token = sign_bearer_token(user.id)

      conn =
        conn
        |> put_req_header("authorization", token)
        |> patch(update_path(organization, media), %{update: %{name: "Nope"}})

      assert json_response(conn, 401) == %{"error" => "Invalid token format"}
    end
  end
end
