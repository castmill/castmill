defmodule CastmillWeb.OrganizationQuotaControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.QuotasFixtures
  alias CastmillWeb.Router.Helpers, as: Routes

  @organization_id "00000000-0000-0000-0000-000000000000"

  @moduletag :skip

  setup %{conn: conn} do
    {:ok, conn: put_req_header(conn, "accept", "application/json")}
  end

  describe "index" do
    test "lists all quotas for an organization", %{conn: conn} do
      quota = quota_organization_fixture(%{organization_id: @organization_id, resource: :medias})

      conn =
        get(conn, Routes.organization_organization_quota_path(conn, :index, @organization_id))

      assert json_response(conn, 200)["data"] == [
               %{
                 "organization_id" => @organization_id,
                 "resource" => "medias",
                 "max" => quota.max
               }
             ]
    end
  end

  describe "show" do
    test "renders a quota when data is valid", %{conn: conn} do
      quota = quota_organization_fixture(%{organization_id: @organization_id, resource: :medias})

      conn =
        get(
          conn,
          Routes.organization_organization_quota_path(
            conn,
            :show,
            @organization_id,
            quota.resource
          )
        )

      assert json_response(conn, 200)["data"] == %{
               "organization_id" => @organization_id,
               "resource" => "medias",
               "max" => quota.max
             }
    end

    test "returns 404 when quota for resource does not exist", %{conn: conn} do
      assert_error_sent 404, fn ->
        get(
          conn,
          Routes.organization_organization_quota_path(
            conn,
            :show,
            @organization_id,
            "non_existent_resource"
          )
        )
      end
    end
  end

  describe "check_quota_usage" do
    test "returns usage data for a resource", %{conn: conn} do
      quota = quota_organization_fixture(%{organization_id: @organization_id, resource: :medias})

      # Insert mock usage data as needed. For now, let's assume usage = 50.
      # In a real test, you might insert records into the `medias` (or corresponding) table
      # that belong to `organization_id` to reflect actual usage.

      conn =
        get(
          conn,
          Routes.organization_organization_quota_path(
            conn,
            :check_quota_usage,
            @organization_id,
            # matches the quota's resource
            "medias"
          )
        )

      assert json_response(conn, 200)["data"] == %{
               # Adjust this based on how usage is actually calculated in your code.
               "usage" => 50,
               "max" => quota.max
             }
    end
  end
end
