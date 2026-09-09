defmodule CastmillWeb.TagControllerTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Tags

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.MediasFixtures
  import Castmill.DevicesFixtures
  import Castmill.TagsFixtures

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

    {:ok, conn: conn, organization: organization}
  end

  # ============================================================================
  # Tag Groups CRUD
  # ============================================================================

  describe "tag groups CRUD" do
    test "create tag group", %{conn: conn, organization: org} do
      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tag-groups", %{
          name: "Location",
          color: "#FF0000"
        })

      assert %{"data" => %{"name" => "Location", "color" => "#FF0000"}} =
               json_response(conn, 201)
    end

    test "list tag groups", %{conn: conn, organization: org} do
      tag_group_fixture(%{organization_id: org.id, name: "Campaign"})

      conn = get(conn, "/dashboard/organizations/#{org.id}/tag-groups")
      response = json_response(conn, 200)

      assert %{"data" => [%{"name" => "Campaign"}]} = response
    end

    test "show tag group", %{conn: conn, organization: org} do
      group = tag_group_fixture(%{organization_id: org.id, name: "Region"})

      conn = get(conn, "/dashboard/organizations/#{org.id}/tag-groups/#{group.id}")

      assert %{"data" => %{"name" => "Region"}} = json_response(conn, 200)
    end

    test "update tag group", %{conn: conn, organization: org} do
      group = tag_group_fixture(%{organization_id: org.id, name: "Old"})

      conn =
        put(conn, "/dashboard/organizations/#{org.id}/tag-groups/#{group.id}", %{name: "New"})

      assert %{"data" => %{"name" => "New"}} = json_response(conn, 200)
    end

    test "delete tag group", %{conn: conn, organization: org} do
      group = tag_group_fixture(%{organization_id: org.id})

      conn = delete(conn, "/dashboard/organizations/#{org.id}/tag-groups/#{group.id}")
      assert json_response(conn, 200)

      assert Tags.list_tag_groups(org.id) == []
    end
  end

  # ============================================================================
  # Tags CRUD
  # ============================================================================

  describe "tags CRUD" do
    test "create tag", %{conn: conn, organization: org} do
      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tags", %{
          name: "London",
          color: "#00FF00"
        })

      assert %{"data" => %{"name" => "London"}} = json_response(conn, 201)
    end

    test "create tag with tag_group_id", %{conn: conn, organization: org} do
      group = tag_group_fixture(%{organization_id: org.id})
      group_id = group.id

      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tags", %{
          name: "Berlin",
          tag_group_id: group.id
        })

      assert %{"data" => %{"name" => "Berlin", "tag_group_id" => ^group_id}} =
               json_response(conn, 201)
    end

    test "list tags", %{conn: conn, organization: org} do
      tag_fixture(%{organization_id: org.id, name: "Alpha"})

      conn = get(conn, "/dashboard/organizations/#{org.id}/tags")

      assert %{"data" => [%{"name" => "Alpha"}]} = json_response(conn, 200)
    end

    test "update tag", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id, name: "Old"})

      conn = put(conn, "/dashboard/organizations/#{org.id}/tags/#{tag.id}", %{name: "New"})
      assert %{"data" => %{"name" => "New"}} = json_response(conn, 200)
    end

    test "delete tag", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})

      conn = delete(conn, "/dashboard/organizations/#{org.id}/tags/#{tag.id}")
      assert json_response(conn, 200)
    end
  end

  # ============================================================================
  # Resource Tags for Media (integer IDs)
  # ============================================================================

  describe "resource tags — media (integer ID)" do
    test "tag a media", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})
      tag_id = tag.id

      conn =
        post(conn, "/dashboard/organizations/#{org.id}/medias/#{media.id}/tags", %{tag_id: tag.id})

      assert %{"data" => %{"tag_id" => ^tag_id}} = json_response(conn, 201)
    end

    test "get tags for a media", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})
      tag_id = tag.id

      Tags.tag_resource(tag.id, :media, to_string(media.id))

      conn = get(conn, "/dashboard/organizations/#{org.id}/medias/#{media.id}/tags")

      assert %{"data" => [%{"id" => ^tag_id}]} = json_response(conn, 200)
    end

    test "untag a media", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      Tags.tag_resource(tag.id, :media, to_string(media.id))

      conn = delete(conn, "/dashboard/organizations/#{org.id}/medias/#{media.id}/tags/#{tag.id}")
      assert json_response(conn, 200)

      assert Tags.get_resource_tags(:media, to_string(media.id)) == []
    end

    test "set tags on a media (replace)", %{conn: conn, organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      Tags.tag_resource(tag1.id, :media, to_string(media.id))

      conn =
        put(conn, "/dashboard/organizations/#{org.id}/medias/#{media.id}/tags", %{
          tag_ids: [tag2.id]
        })

      assert %{"data" => data} = json_response(conn, 200)
      assert length(data) == 1

      tag_ids = Enum.map(data, & &1["tag_id"])
      assert tag2.id in tag_ids
      refute tag1.id in tag_ids
    end

    test "list medias filtered by tag", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id, name: "tagged"})
      _other = media_fixture(%{organization_id: org.id, name: "untagged"})

      Tags.tag_resource(tag.id, :media, to_string(media.id))

      conn =
        get(conn, "/dashboard/organizations/#{org.id}/medias", %{
          tag_ids: "#{tag.id}",
          tag_filter_mode: "all"
        })

      response = json_response(conn, 200)
      assert response["count"] == 1
      assert hd(response["data"])["name"] == "tagged"
    end
  end

  # ============================================================================
  # Resource Tags for Devices (UUID IDs) — the critical bug fix
  # ============================================================================

  describe "resource tags — device (UUID ID)" do
    test "tag a device (UUID)", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      device = device_fixture(%{organization_id: org.id})

      # Device IDs are UUIDs
      assert String.contains?(device.id, "-")

      conn =
        post(conn, "/dashboard/organizations/#{org.id}/devices/#{device.id}/tags", %{
          tag_id: tag.id
        })

      response = json_response(conn, 201)
      assert response["data"]["resource_id"] == device.id
    end

    test "get tags for a device (UUID)", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "ctrl-get-#{System.unique_integer([:positive])}"
        })

      tag_id = tag.id

      Tags.tag_resource(tag.id, :device, device.id)

      conn = get(conn, "/dashboard/organizations/#{org.id}/devices/#{device.id}/tags")

      assert %{"data" => [%{"id" => ^tag_id}]} = json_response(conn, 200)
    end

    test "untag a device (UUID)", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      device = device_fixture(%{organization_id: org.id})

      Tags.tag_resource(tag.id, :device, device.id)

      conn =
        delete(conn, "/dashboard/organizations/#{org.id}/devices/#{device.id}/tags/#{tag.id}")

      assert json_response(conn, 200)

      assert Tags.get_resource_tags(:device, device.id) == []
    end

    test "set tags on a device (UUID, replace)", %{conn: conn, organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})
      device = device_fixture(%{organization_id: org.id})

      Tags.tag_resource(tag1.id, :device, device.id)

      conn =
        put(conn, "/dashboard/organizations/#{org.id}/devices/#{device.id}/tags", %{
          tag_ids: [tag2.id]
        })

      assert %{"data" => data} = json_response(conn, 200)
      tag_ids = Enum.map(data, & &1["tag_id"])
      assert tag2.id in tag_ids
      refute tag1.id in tag_ids
    end

    test "list devices filtered by tag (the critical UUID filter test)", %{
      conn: conn,
      organization: org
    } do
      tag = tag_fixture(%{organization_id: org.id})
      device = device_fixture(%{organization_id: org.id, name: "tagged_device"})
      _other = device_fixture(%{organization_id: org.id, name: "untagged_device"})

      Tags.tag_resource(tag.id, :device, device.id)

      conn =
        get(conn, "/dashboard/organizations/#{org.id}/devices", %{
          tag_ids: "#{tag.id}",
          tag_filter_mode: "all"
        })

      response = json_response(conn, 200)
      assert response["count"] == 1
      assert hd(response["data"])["name"] == "tagged_device"
    end
  end

  # ============================================================================
  # Bulk Operations
  # ============================================================================

  describe "bulk operations" do
    test "bulk tag medias", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      m1 = media_fixture(%{organization_id: org.id})
      m2 = media_fixture(%{organization_id: org.id})

      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tags/#{tag.id}/bulk", %{
          resource_type: "media",
          resource_ids: [m1.id, m2.id]
        })

      assert %{"success" => true, "count" => 2} = json_response(conn, 200)
    end

    test "bulk tag devices (UUID)", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      d1 = device_fixture(%{organization_id: org.id})
      d2 = device_fixture(%{organization_id: org.id})

      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tags/#{tag.id}/bulk", %{
          resource_type: "device",
          resource_ids: [d1.id, d2.id]
        })

      assert %{"success" => true, "count" => 2} = json_response(conn, 200)

      # Verify both devices are actually tagged
      assert length(Tags.get_resource_tags(:device, d1.id)) == 1
      assert length(Tags.get_resource_tags(:device, d2.id)) == 1
    end

    test "bulk untag devices (UUID)", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      d1 = device_fixture(%{organization_id: org.id})
      d2 = device_fixture(%{organization_id: org.id})

      Tags.bulk_tag_resources(tag.id, :device, [d1.id, d2.id])

      conn =
        delete(conn, "/dashboard/organizations/#{org.id}/tags/#{tag.id}/bulk", %{
          resource_type: "device",
          resource_ids: [d1.id, d2.id]
        })

      assert %{"success" => true, "count" => 2} = json_response(conn, 200)
    end
  end

  # ============================================================================
  # Color Palette & Stats
  # ============================================================================

  describe "utility endpoints" do
    test "color palette", %{conn: conn, organization: org} do
      conn = get(conn, "/dashboard/organizations/#{org.id}/tags/colors")

      assert %{"data" => colors} = json_response(conn, 200)
      assert is_list(colors)
      assert length(colors) > 0
    end

    test "tag stats", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})
      Tags.tag_resource(tag.id, :media, to_string(media.id))

      conn = get(conn, "/dashboard/organizations/#{org.id}/tags/stats")

      assert %{"data" => [%{"count" => 1}]} = json_response(conn, 200)
    end
  end

  # ============================================================================
  # Show Tag (GET single tag)
  # ============================================================================

  describe "show tag" do
    test "returns a single tag", %{conn: conn, organization: org} do
      tag = tag_fixture(%{organization_id: org.id, name: "ShowMe", color: "#ABCDEF"})

      conn = get(conn, "/dashboard/organizations/#{org.id}/tags/#{tag.id}")

      assert %{"data" => %{"name" => "ShowMe", "color" => "#ABCDEF"}} =
               json_response(conn, 200)
    end

    test "returns 404 for non-existent tag", %{conn: conn, organization: org} do
      conn = get(conn, "/dashboard/organizations/#{org.id}/tags/999999")

      assert %{"error" => "Tag not found"} = json_response(conn, 404)
    end
  end

  # ============================================================================
  # Error Paths
  # ============================================================================

  describe "error paths" do
    test "create tag with missing name returns 422", %{conn: conn, organization: org} do
      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tags", %{
          color: "#FF0000"
        })

      assert json_response(conn, 422)
    end

    test "create tag group with missing name returns 422", %{conn: conn, organization: org} do
      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tag-groups", %{
          color: "#FF0000"
        })

      assert json_response(conn, 422)
    end

    test "create tag with duplicate name returns 422", %{conn: conn, organization: org} do
      tag_fixture(%{organization_id: org.id, name: "Duplicate"})

      conn =
        post(conn, "/dashboard/organizations/#{org.id}/tags", %{
          name: "Duplicate"
        })

      assert json_response(conn, 422)
    end

    test "show non-existent tag group returns 404", %{conn: conn, organization: org} do
      conn = get(conn, "/dashboard/organizations/#{org.id}/tag-groups/999999")

      assert %{"error" => "Tag group not found"} = json_response(conn, 404)
    end

    test "update non-existent tag returns 404", %{conn: conn, organization: org} do
      conn = put(conn, "/dashboard/organizations/#{org.id}/tags/999999", %{name: "New"})

      assert %{"error" => "Tag not found"} = json_response(conn, 404)
    end

    test "update non-existent tag group returns 404", %{conn: conn, organization: org} do
      conn = put(conn, "/dashboard/organizations/#{org.id}/tag-groups/999999", %{name: "New"})

      assert %{"error" => "Tag group not found"} = json_response(conn, 404)
    end

    test "delete non-existent tag returns 404", %{conn: conn, organization: org} do
      conn = delete(conn, "/dashboard/organizations/#{org.id}/tags/999999")

      assert %{"error" => "Tag not found"} = json_response(conn, 404)
    end

    test "delete non-existent tag group returns 404", %{conn: conn, organization: org} do
      conn = delete(conn, "/dashboard/organizations/#{org.id}/tag-groups/999999")

      assert %{"error" => "Tag group not found"} = json_response(conn, 404)
    end

    test "untag non-existent tag from resource returns 404", %{conn: conn, organization: org} do
      media = media_fixture(%{organization_id: org.id})

      conn = delete(conn, "/dashboard/organizations/#{org.id}/medias/#{media.id}/tags/999999")

      assert %{"error" => _} = json_response(conn, 404)
    end
  end
end
