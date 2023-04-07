defmodule Castmill.PlaylistsTest do
  use Castmill.DataCase

  @moduletag :playlist_data_case

  alias Castmill.Resources

  describe "playlists" do
    alias Castmill.Accounts.AccessToken

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.PlaylistsFixtures

    @invalid_attrs %{accessed: nil, accessed_at: nil, last_ip: nil}

    test "list_playlists/1 returns all playlists" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})

      assert Resources.list_playlists(organization.id) == [playlist]
    end

    test "insert_item_into_playlist/6 inserts items at the begining of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item4 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item4, item3, item2, item1], fn item -> item.id end)
    end

    test "insert_item_into_playlist/6 inserts items at the end of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 423)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 1231)
      {:ok, item4 } = Resources.insert_item_into_playlist(playlist.id, item3.id, widget.id, 0, 8675)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item1, item2, item3, item4], fn item -> item.id end)
    end

    test "insert_item_into_playlist/6 inserts items in random orders in the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 423)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 1231)
      {:ok, item4 } = Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 8675)

      {:ok, item5 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item6 } = Resources.insert_item_into_playlist(playlist.id, item3.id, widget.id, 0, 423)
      {:ok, item7 } = Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 1231)
      {:ok, item8 } = Resources.insert_item_into_playlist(playlist.id, item5.id, widget.id, 0, 8675)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item5, item8, item1, item3, item6, item2, item7, item4], fn item -> item.id end)
    end

    test "remove_item_from_playlist/1 removes one item of a playlist of size 1" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)

      Resources.remove_item_from_playlist(item1.id)

      playlist_items = Resources.get_playlist_items(playlist.id)
      assert playlist_items ==[]
    end

    test "remove_item_from_playlist/1 removes the first item of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)

      Resources.remove_item_from_playlist(item3.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items ==[item2.id, item1.id]
    end

    test "remove_item_from_playlist/1 removes the last item of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)

      Resources.remove_item_from_playlist(item1.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items ==[item3.id, item2.id]
    end

    test "remove_item_from_playlist/1 removes items from the middle of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 423)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 1231)
      {:ok, item4 } = Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 8675)

      {:ok, item5 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item6 } = Resources.insert_item_into_playlist(playlist.id, item3.id, widget.id, 0, 423)
      {:ok, item7 } = Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 1231)
      {:ok, item8 } = Resources.insert_item_into_playlist(playlist.id, item5.id, widget.id, 0, 8675)

      Resources.remove_item_from_playlist(item3.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item5, item8, item1, item6, item2, item7, item4], fn item -> item.id end)

      Resources.remove_item_from_playlist(item2.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item5, item8, item1, item6, item7, item4], fn item -> item.id end)
    end

    test "move_item_in_playlist/2 moves an item from one position to another in the middle of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item8 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item7 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item6 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item5 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      {:ok, item4 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item7.id, item4.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item1, item2, item3, item4, item7, item5, item6, item8], fn item -> item.id end)
    end

    test "move_item_in_playlist/2 moves an item from one position to the beginning of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item8 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item7 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item6 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item5 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      {:ok, item4 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item5.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item5, item1, item2, item3, item4, item6, item7, item8], fn item -> item.id end)
    end

    test "move_item_in_playlist/2 moves an item from one position to the end of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item8 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item7 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item6 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item5 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      {:ok, item4 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item3 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item5.id, item8.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item1, item2, item3, item4, item6, item7, item8, item5], fn item -> item.id end)
    end

    test "move_item_in_playlist/2 swaps items in a playlist composed of 2 items" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item1.id, item2.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item2, item1], fn item -> item.id end)
    end

    test "move_item_in_playlist/2 moves item to the same position in a playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Repo.get_by(Castmill.Widgets.Widget, uri: "widget://image")

      {:ok, item2 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1 } = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item1.id, item1.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item1, item2], fn item -> item.id end)
    end
  end
end
