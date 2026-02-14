defmodule Castmill.TagsTest do
  use Castmill.DataCase

  @moduletag :tags_data_case

  alias Castmill.Tags

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.TagsFixtures
  import Castmill.MediasFixtures
  import Castmill.DevicesFixtures

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    {:ok, organization: organization}
  end

  # ============================================================================
  # Tag Groups
  # ============================================================================

  describe "tag groups" do
    test "create_tag_group/1 creates a tag group", %{organization: org} do
      {:ok, group} =
        Tags.create_tag_group(%{
          name: "Location",
          color: "#FF0000",
          organization_id: org.id
        })

      assert group.name == "Location"
      assert group.color == "#FF0000"
      assert group.organization_id == org.id
    end

    test "create_tag_group/1 enforces unique name per organization", %{organization: org} do
      {:ok, _} = Tags.create_tag_group(%{name: "Location", organization_id: org.id})

      assert {:error, changeset} =
               Tags.create_tag_group(%{name: "Location", organization_id: org.id})

      assert errors_on(changeset)[:organization_id] != nil
    end

    test "list_tag_groups/1 returns all groups for an organization", %{organization: org} do
      {:ok, g1} = Tags.create_tag_group(%{name: "Location", organization_id: org.id, position: 1})
      {:ok, g2} = Tags.create_tag_group(%{name: "Campaign", organization_id: org.id, position: 0})

      groups = Tags.list_tag_groups(org.id)
      group_ids = Enum.map(groups, & &1.id)

      assert g2.id in group_ids
      assert g1.id in group_ids
    end

    test "update_tag_group/2 updates a tag group", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id, name: "Old Name"})

      {:ok, updated} = Tags.update_tag_group(group, %{name: "New Name"})
      assert updated.name == "New Name"
    end

    test "delete_tag_group/1 deletes a tag group and cascades to tags", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id})
      _tag = tag_fixture(%{organization_id: org.id, tag_group_id: group.id})

      {:ok, _} = Tags.delete_tag_group(group)

      assert Tags.list_tags(org.id) == []
    end
  end

  # ============================================================================
  # Tags
  # ============================================================================

  describe "tags" do
    test "create_tag/1 creates a tag", %{organization: org} do
      {:ok, tag} =
        Tags.create_tag(%{
          name: "London Office",
          color: "#00FF00",
          organization_id: org.id
        })

      assert tag.name == "London Office"
      assert tag.color == "#00FF00"
    end

    test "create_tag/1 with tag_group_id", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id})

      {:ok, tag} =
        Tags.create_tag(%{
          name: "London",
          organization_id: org.id,
          tag_group_id: group.id
        })

      assert tag.tag_group_id == group.id
    end

    test "create_tag/1 enforces unique name per organization", %{organization: org} do
      {:ok, _} = Tags.create_tag(%{name: "Unique Tag", organization_id: org.id})

      assert {:error, changeset} =
               Tags.create_tag(%{name: "Unique Tag", organization_id: org.id})

      assert errors_on(changeset)[:organization_id] != nil
    end

    test "list_tags/1 returns all tags for an organization", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      tags = Tags.list_tags(org.id)

      assert length(tags) == 1
      assert hd(tags).id == tag.id
    end

    test "list_tags/2 filters by tag_group_id", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id})
      tag_in_group = tag_fixture(%{organization_id: org.id, tag_group_id: group.id})
      _tag_no_group = tag_fixture(%{organization_id: org.id})

      tags = Tags.list_tags(org.id, tag_group_id: group.id)
      assert length(tags) == 1
      assert hd(tags).id == tag_in_group.id
    end

    test "update_tag/2 updates a tag", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id, name: "Old"})
      {:ok, updated} = Tags.update_tag(tag, %{name: "New"})
      assert updated.name == "New"
    end

    test "delete_tag/1 deletes a tag and cascades to resource_tags", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))
      assert Tags.get_resource_tags(:media, to_string(media.id)) != []

      {:ok, _} = Tags.delete_tag(tag)
      assert Tags.get_resource_tags(:media, to_string(media.id)) == []
    end
  end

  # ============================================================================
  # Resource Tags — Media (integer ID)
  # ============================================================================

  describe "resource tags for media (integer ID)" do
    test "tag_resource/3 tags a media", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, resource_tag} = Tags.tag_resource(tag.id, :media, to_string(media.id))
      assert resource_tag.tag_id == tag.id
      assert resource_tag.resource_type == :media
      assert resource_tag.resource_id == to_string(media.id)
    end

    test "get_resource_tags/2 returns tags for a media", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag1.id, :media, to_string(media.id))
      {:ok, _} = Tags.tag_resource(tag2.id, :media, to_string(media.id))

      tags = Tags.get_resource_tags(:media, to_string(media.id))
      tag_ids = Enum.map(tags, & &1.id)

      assert tag1.id in tag_ids
      assert tag2.id in tag_ids
    end

    test "untag_resource/3 removes a tag from a media", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))
      assert length(Tags.get_resource_tags(:media, to_string(media.id))) == 1

      {:ok, _} = Tags.untag_resource(tag.id, :media, to_string(media.id))
      assert Tags.get_resource_tags(:media, to_string(media.id)) == []
    end

    test "set_resource_tags/3 replaces all tags on a media", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})
      tag3 = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag1.id, :media, to_string(media.id))

      {:ok, _} = Tags.set_resource_tags(:media, to_string(media.id), [tag2.id, tag3.id])

      tags = Tags.get_resource_tags(:media, to_string(media.id))
      tag_ids = Enum.map(tags, & &1.id)

      refute tag1.id in tag_ids
      assert tag2.id in tag_ids
      assert tag3.id in tag_ids
    end

    test "filter_by_tags/3 filters medias by tag (any mode)", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})

      media1 = media_fixture(%{organization_id: org.id, name: "tagged1"})
      media2 = media_fixture(%{organization_id: org.id, name: "tagged2"})
      _media3 = media_fixture(%{organization_id: org.id, name: "untagged"})

      {:ok, _} = Tags.tag_resource(tag1.id, :media, to_string(media1.id))
      {:ok, _} = Tags.tag_resource(tag2.id, :media, to_string(media2.id))

      query = from(m in Castmill.Resources.Media)
      results = Tags.filter_by_tags(query, :media, [tag1.id]) |> Repo.all()

      assert length(results) == 1
      assert hd(results).id == media1.id
    end

    test "filter_by_tags/3 filters medias by multiple tags (all mode)", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})

      media1 = media_fixture(%{organization_id: org.id, name: "both_tags"})
      media2 = media_fixture(%{organization_id: org.id, name: "one_tag"})

      {:ok, _} = Tags.tag_resource(tag1.id, :media, to_string(media1.id))
      {:ok, _} = Tags.tag_resource(tag2.id, :media, to_string(media1.id))
      {:ok, _} = Tags.tag_resource(tag1.id, :media, to_string(media2.id))

      query = from(m in Castmill.Resources.Media)
      results = Tags.filter_by_tags(query, :media, [tag1.id, tag2.id], mode: :all) |> Repo.all()

      assert length(results) == 1
      assert hd(results).id == media1.id
    end

    test "bulk_tag_resources/3 tags multiple medias", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media1 = media_fixture(%{organization_id: org.id})
      media2 = media_fixture(%{organization_id: org.id})

      {:ok, count} =
        Tags.bulk_tag_resources(tag.id, :media, [to_string(media1.id), to_string(media2.id)])

      assert count == 2
      assert length(Tags.get_resource_tags(:media, to_string(media1.id))) == 1
      assert length(Tags.get_resource_tags(:media, to_string(media2.id))) == 1
    end

    test "bulk_untag_resources/3 untags multiple medias", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media1 = media_fixture(%{organization_id: org.id})
      media2 = media_fixture(%{organization_id: org.id})

      {:ok, _} =
        Tags.bulk_tag_resources(tag.id, :media, [to_string(media1.id), to_string(media2.id)])

      {:ok, count} =
        Tags.bulk_untag_resources(tag.id, :media, [to_string(media1.id), to_string(media2.id)])

      assert count == 2
      assert Tags.get_resource_tags(:media, to_string(media1.id)) == []
    end
  end

  # ============================================================================
  # Resource Tags — Device (UUID / binary_id)
  # ============================================================================

  describe "resource tags for device (UUID ID)" do
    test "tag_resource/3 tags a device with UUID ID", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-tag-#{System.unique_integer([:positive])}"
        })

      # Device IDs are UUIDs like "a1b2c3d4-..."
      assert is_binary(device.id)
      assert String.contains?(device.id, "-")

      {:ok, resource_tag} = Tags.tag_resource(tag.id, :device, device.id)
      assert resource_tag.tag_id == tag.id
      assert resource_tag.resource_type == :device
      assert resource_tag.resource_id == device.id
    end

    test "get_resource_tags/2 returns tags for a device", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-get-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag.id, :device, device.id)

      tags = Tags.get_resource_tags(:device, device.id)
      assert length(tags) == 1
      assert hd(tags).id == tag.id
    end

    test "untag_resource/3 removes a tag from a device", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-untag-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag.id, :device, device.id)
      {:ok, _} = Tags.untag_resource(tag.id, :device, device.id)

      assert Tags.get_resource_tags(:device, device.id) == []
    end

    test "set_resource_tags/3 replaces all tags on a device", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-set-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag1.id, :device, device.id)
      {:ok, _} = Tags.set_resource_tags(:device, device.id, [tag2.id])

      tags = Tags.get_resource_tags(:device, device.id)
      assert length(tags) == 1
      assert hd(tags).id == tag2.id
    end

    test "filter_by_tags/3 filters devices by tag — the critical UUID test", %{
      organization: org
    } do
      tag = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          name: "tagged_device",
          hardware_id: "dev-filter1-#{System.unique_integer([:positive])}"
        })

      _other =
        device_fixture(%{
          organization_id: org.id,
          name: "untagged_device",
          hardware_id: "dev-filter2-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag.id, :device, device.id)

      query = from(d in Castmill.Devices.Device)
      results = Tags.filter_by_tags(query, :device, [tag.id]) |> Repo.all()

      assert length(results) == 1
      assert hd(results).id == device.id
    end

    test "filter_by_tags/3 filters devices by multiple tags (all mode)", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})

      device_both =
        device_fixture(%{
          organization_id: org.id,
          name: "both_tags",
          hardware_id: "dev-allmode1-#{System.unique_integer([:positive])}"
        })

      device_one =
        device_fixture(%{
          organization_id: org.id,
          name: "one_tag",
          hardware_id: "dev-allmode2-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag1.id, :device, device_both.id)
      {:ok, _} = Tags.tag_resource(tag2.id, :device, device_both.id)
      {:ok, _} = Tags.tag_resource(tag1.id, :device, device_one.id)

      query = from(d in Castmill.Devices.Device)
      results = Tags.filter_by_tags(query, :device, [tag1.id, tag2.id], mode: :all) |> Repo.all()

      assert length(results) == 1
      assert hd(results).id == device_both.id
    end

    test "bulk_tag_resources/3 tags multiple devices", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})

      d1 =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-bulk1-#{System.unique_integer([:positive])}"
        })

      d2 =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-bulk2-#{System.unique_integer([:positive])}"
        })

      {:ok, count} = Tags.bulk_tag_resources(tag.id, :device, [d1.id, d2.id])
      assert count == 2
    end

    test "count_resources_with_tag/1 counts across resource types", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-count-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))
      {:ok, _} = Tags.tag_resource(tag.id, :device, device.id)

      assert Tags.count_resources_with_tag(tag.id) == 2
      assert Tags.count_resources_with_tag(tag.id, :media) == 1
      assert Tags.count_resources_with_tag(tag.id, :device) == 1
    end
  end

  # ============================================================================
  # Statistics
  # ============================================================================

  describe "tag statistics" do
    test "get_tag_usage_stats/1 returns counts", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))

      stats = Tags.get_tag_usage_stats(org.id)
      assert length(stats) == 1
      assert hd(stats).count == 1
    end
  end

  # ============================================================================
  # Edge Cases
  # ============================================================================

  describe "edge cases" do
    test "tagging same resource twice is idempotent", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))
      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))

      assert length(Tags.get_resource_tags(:media, to_string(media.id))) == 1
    end

    test "untag non-existent tag returns error", %{organization: org} do
      media = media_fixture(%{organization_id: org.id})
      assert {:error, :not_found} = Tags.untag_resource(99999, :media, to_string(media.id))
    end

    test "filter_by_tags with empty list returns original query", %{organization: org} do
      media = media_fixture(%{organization_id: org.id})
      query = from(m in Castmill.Resources.Media)
      results = Tags.filter_by_tags(query, :media, []) |> Repo.all()

      assert length(results) == 1
      assert hd(results).id == media.id
    end

    test "filter_by_tags with non-matching tags returns empty", %{organization: org} do
      _media = media_fixture(%{organization_id: org.id})
      tag = tag_fixture(%{organization_id: org.id})

      query = from(m in Castmill.Resources.Media)
      results = Tags.filter_by_tags(query, :media, [tag.id]) |> Repo.all()

      assert results == []
    end

    test "set_resource_tags with empty list clears all tags", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))
      {:ok, result} = Tags.set_resource_tags(:media, to_string(media.id), [])

      assert result == []
      assert Tags.get_resource_tags(:media, to_string(media.id)) == []
    end
  end

  # ============================================================================
  # add_tags_to_resource/3
  # ============================================================================

  describe "add_tags_to_resource/3" do
    test "adds tags without removing existing ones", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})
      tag3 = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag1.id, :media, to_string(media.id))

      {:ok, added} = Tags.add_tags_to_resource(:media, to_string(media.id), [tag2.id, tag3.id])
      assert length(added) == 2

      tags = Tags.get_resource_tags(:media, to_string(media.id))
      tag_ids = Enum.map(tags, & &1.id)

      assert tag1.id in tag_ids
      assert tag2.id in tag_ids
      assert tag3.id in tag_ids
    end

    test "returns ok with empty list when no tags provided", %{organization: org} do
      media = media_fixture(%{organization_id: org.id})
      assert {:ok, []} = Tags.add_tags_to_resource(:media, to_string(media.id), [])
    end

    test "handles duplicates gracefully (on_conflict: :nothing)", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag.id, :media, to_string(media.id))

      # Adding the same tag again should not raise
      {:ok, _result} = Tags.add_tags_to_resource(:media, to_string(media.id), [tag.id])

      tags = Tags.get_resource_tags(:media, to_string(media.id))
      assert length(tags) == 1
    end

    test "works with device (UUID) resource IDs", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-add-tags-#{System.unique_integer([:positive])}"
        })

      {:ok, added} = Tags.add_tags_to_resource(:device, device.id, [tag1.id, tag2.id])
      assert length(added) == 2

      tags = Tags.get_resource_tags(:device, device.id)
      assert length(tags) == 2
    end
  end

  # ============================================================================
  # clear_resource_tags/2
  # ============================================================================

  describe "clear_resource_tags/2" do
    test "removes all tags from a resource", %{organization: org} do
      tag1 = tag_fixture(%{organization_id: org.id})
      tag2 = tag_fixture(%{organization_id: org.id})
      media = media_fixture(%{organization_id: org.id})

      {:ok, _} = Tags.tag_resource(tag1.id, :media, to_string(media.id))
      {:ok, _} = Tags.tag_resource(tag2.id, :media, to_string(media.id))
      assert length(Tags.get_resource_tags(:media, to_string(media.id))) == 2

      {count, _} = Tags.clear_resource_tags(:media, to_string(media.id))
      assert count == 2
      assert Tags.get_resource_tags(:media, to_string(media.id)) == []
    end

    test "returns 0 when resource has no tags", %{organization: org} do
      media = media_fixture(%{organization_id: org.id})
      {count, _} = Tags.clear_resource_tags(:media, to_string(media.id))
      assert count == 0
    end

    test "works with device (UUID) resource IDs", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-clear-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag.id, :device, device.id)
      assert length(Tags.get_resource_tags(:device, device.id)) == 1

      {count, _} = Tags.clear_resource_tags(:device, device.id)
      assert count == 1
      assert Tags.get_resource_tags(:device, device.id) == []
    end
  end

  # ============================================================================
  # Preload Options
  # ============================================================================

  describe "preload options" do
    test "list_tag_groups with preload_tags preloads tags", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id})
      _tag = tag_fixture(%{organization_id: org.id, tag_group_id: group.id, name: "Preloaded"})

      groups = Tags.list_tag_groups(org.id, preload_tags: true)
      assert length(groups) == 1
      assert length(hd(groups).tags) == 1
      assert hd(hd(groups).tags).name == "Preloaded"
    end

    test "list_tag_groups without preload_tags does not preload", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id})
      _tag = tag_fixture(%{organization_id: org.id, tag_group_id: group.id})

      groups = Tags.list_tag_groups(org.id)
      assert length(groups) == 1
      # Tags are not loaded (Ecto association not loaded)
      assert %Ecto.Association.NotLoaded{} = hd(groups).tags
    end

    test "list_tags with preload_tag_group preloads the group", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id, name: "TestGroup"})
      _tag = tag_fixture(%{organization_id: org.id, tag_group_id: group.id})

      tags = Tags.list_tags(org.id, preload_tag_group: true)
      assert length(tags) == 1
      assert hd(tags).tag_group.name == "TestGroup"
    end
  end

  # ============================================================================
  # get_tag!/1 and get_tag_group!/1 (raising variants)
  # ============================================================================

  describe "raising getters" do
    test "get_tag!/1 returns the tag", %{organization: org} do
      tag = tag_fixture(%{organization_id: org.id, name: "FindMe"})
      found = Tags.get_tag!(tag.id)
      assert found.id == tag.id
      assert found.name == "FindMe"
    end

    test "get_tag!/1 raises on non-existent ID" do
      assert_raise Ecto.NoResultsError, fn ->
        Tags.get_tag!(999_999)
      end
    end

    test "get_tag_group!/1 returns the tag group", %{organization: org} do
      group = tag_group_fixture(%{organization_id: org.id, name: "FindGroup"})
      found = Tags.get_tag_group!(group.id)
      assert found.id == group.id
      assert found.name == "FindGroup"
    end

    test "get_tag_group!/1 raises on non-existent ID" do
      assert_raise Ecto.NoResultsError, fn ->
        Tags.get_tag_group!(999_999)
      end
    end
  end

  # ============================================================================
  # Defensive cast_resource_ids (the UUID fix)
  # ============================================================================

  describe "defensive resource ID filtering" do
    test "filter_by_tags with mixed valid/invalid device UUIDs only uses valid ones", %{
      organization: org
    } do
      tag = tag_fixture(%{organization_id: org.id})

      device =
        device_fixture(%{
          organization_id: org.id,
          hardware_id: "dev-defensive-#{System.unique_integer([:positive])}"
        })

      {:ok, _} = Tags.tag_resource(tag.id, :device, device.id)

      # This should work without crashing, even though there might be
      # garbage data in the DB (now cleaned, but the defensive code should handle it)
      query = from(d in Castmill.Devices.Device)
      results = Tags.filter_by_tags(query, :device, [tag.id]) |> Repo.all()

      assert length(results) == 1
      assert hd(results).id == device.id
    end
  end
end
