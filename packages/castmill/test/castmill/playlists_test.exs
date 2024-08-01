defmodule Castmill.PlaylistsTest do
  use Castmill.DataCase

  alias Castmill.Resources.Playlist
  alias Castmill.Files

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures
  import Castmill.MediasFixtures
  import Castmill.FilesFixtures

  @moduletag :playlist_data_case

  alias Castmill.Resources

  describe "playlists" do
    test "list_playlists/1 returns all playlists" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})

      assert Resources.list_resources(Playlist, %{organization_id: organization.id}) == [playlist]
    end

    test "insert_item_into_playlist/6 inserts items at the begining of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item3} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item4} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item4, item3, item2, item1], fn item -> item.id end)
    end

    test "insert_item_into_playlist/6 inserts items at the end of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 423)

      {:ok, item3} =
        Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 1231)

      {:ok, item4} =
        Resources.insert_item_into_playlist(playlist.id, item3.id, widget.id, 0, 8675)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item1, item2, item3, item4], fn item -> item.id end)
    end

    test "insert_item_into_playlist/6 inserts items in random orders in the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 423)

      {:ok, item3} =
        Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 1231)

      {:ok, item4} =
        Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 8675)

      {:ok, item5} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item6} = Resources.insert_item_into_playlist(playlist.id, item3.id, widget.id, 0, 423)

      {:ok, item7} =
        Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 1231)

      {:ok, item8} =
        Resources.insert_item_into_playlist(playlist.id, item5.id, widget.id, 0, 8675)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)

      assert playlist_items ==
               Enum.map([item5, item8, item1, item3, item6, item2, item7, item4], fn item ->
                 item.id
               end)
    end

    test "remove_item_from_playlist/1 removes one item of a playlist of size 1" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)

      Resources.remove_item_from_playlist(playlist.id, item1.id)

      playlist_items = Resources.get_playlist_items(playlist.id)
      assert playlist_items == []
    end

    test "remove_item_from_playlist/1 removes the first item of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item3} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)

      Resources.remove_item_from_playlist(playlist.id, item3.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == [item2.id, item1.id]
    end

    test "remove_item_from_playlist/1 removes the last item of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item3} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)

      Resources.remove_item_from_playlist(playlist.id, item1.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == [item3.id, item2.id]
    end

    test "remove_item_from_playlist/1 removes items from the middle of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 423)

      {:ok, item3} =
        Resources.insert_item_into_playlist(playlist.id, item1.id, widget.id, 0, 1231)

      {:ok, item4} =
        Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 8675)

      {:ok, item5} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item6} = Resources.insert_item_into_playlist(playlist.id, item3.id, widget.id, 0, 423)

      {:ok, item7} =
        Resources.insert_item_into_playlist(playlist.id, item2.id, widget.id, 0, 1231)

      {:ok, item8} =
        Resources.insert_item_into_playlist(playlist.id, item5.id, widget.id, 0, 8675)

      Resources.remove_item_from_playlist(playlist.id, item3.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)

      assert playlist_items ==
               Enum.map([item5, item8, item1, item6, item2, item7, item4], fn item -> item.id end)

      Resources.remove_item_from_playlist(playlist.id, item2.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)

      assert playlist_items ==
               Enum.map([item5, item8, item1, item6, item7, item4], fn item -> item.id end)
    end

    test "move_item_in_playlist/2 moves an item from one position to another in the middle of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item8} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item7} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item6} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item5} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      {:ok, item4} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item3} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item7.id, item4.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)

      assert playlist_items ==
               Enum.map([item1, item2, item3, item4, item7, item5, item6, item8], fn item ->
                 item.id
               end)
    end

    test "move_item_in_playlist/2 moves an item from one position to the beginning of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item8} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item7} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item6} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item5} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      {:ok, item4} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item3} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item5.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)

      assert playlist_items ==
               Enum.map([item5, item1, item2, item3, item4, item6, item7, item8], fn item ->
                 item.id
               end)
    end

    test "move_item_in_playlist/2 moves an item from one position to the end of the playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item8} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item7} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item6} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item5} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      {:ok, item4} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 12345)
      {:ok, item3} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 423)
      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item5.id, item8.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)

      assert playlist_items ==
               Enum.map([item1, item2, item3, item4, item6, item7, item8, item5], fn item ->
                 item.id
               end)
    end

    test "move_item_in_playlist/2 swaps items in a playlist composed of 2 items" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item1.id, item2.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item2, item1], fn item -> item.id end)
    end

    test "move_item_in_playlist/2 moves item to the same position in a playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.move_item_in_playlist(item1.id, item1.id)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == Enum.map([item1, item2], fn item -> item.id end)
    end

    test "delete_playlist/1 deletes a playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      widget = Castmill.Widgets.get_widget_by_slug("image")

      {:ok, item2} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231)
      {:ok, item1} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 8675)

      Resources.delete_playlist(playlist)

      playlist_items = Enum.map(Resources.get_playlist_items(playlist.id), fn item -> item.id end)
      assert playlist_items == []

      assert Repo.get_by(Resources.Playlist, id: playlist.id) == nil
      assert Repo.get_by(Resources.PlaylistItem, id: item1.id) == nil
      assert Repo.get_by(Resources.PlaylistItem, id: item2.id) == nil
    end

    test "count_resources" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      _playlist1 = playlist_fixture(%{organization_id: organization.id, name: "Apples"})
      _playlist2 = playlist_fixture(%{organization_id: organization.id, name: "Bananas"})
      _playlist3 = playlist_fixture(%{organization_id: organization.id, name: "Oranges"})
      _playlist4 = playlist_fixture(%{organization_id: organization.id, name: "Pears"})
      _playlist5 = playlist_fixture(%{organization_id: organization.id, name: "Blueberries"})

      assert Resources.count_resources(Playlist, %{organization_id: organization.id, search: "a"}) ==
               4
    end

    @tag :only
    test "transforms playlist items correctly" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id, name: "Apples"})
      widget = Castmill.Widgets.get_widget_by_slug("image")
      media = media_fixture(%{organization_id: organization.id, name: "Test Media"})

      {:ok, file} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=1",
          name: "file1"
        })

      assert Files.add_file_to_media(file.id, media.id, "default")

      {:ok, _} =
        Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1231, %{
          "image" => "#{media.id}",
          "duration" => 15
        })

      fetched_playlist = Resources.get_playlist(playlist.id)

      [%{config: %Castmill.Widgets.WidgetConfig{options: options}}] = fetched_playlist.items

      assert %{"image" => %Castmill.Resources.Media{id: fetched_media_id, name: fetched_name}} =
               options

      assert fetched_media_id == media.id
      assert fetched_name == "Test Media"

      assert %{"image" => %{files: %{"default" => %{id: file_id}}}} = options

      assert file_id == file.id
    end
  end

  describe "pagination" do
    @describetag :pagination

    test "list playlists returns the specified number of playlists" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist1 = playlist_fixture(%{organization_id: organization.id})
      playlist2 = playlist_fixture(%{organization_id: organization.id})
      _playlist3 = playlist_fixture(%{organization_id: organization.id})
      _playlist4 = playlist_fixture(%{organization_id: organization.id})

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               page: 1,
               page_size: 2,
               search: nil
             }) == [playlist1, playlist2]
    end

    test "list playlists returns all playlists when the limit is greater than the number of playlists" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist1 = playlist_fixture(%{organization_id: organization.id})
      playlist2 = playlist_fixture(%{organization_id: organization.id})

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               page: 1,
               page_size: 5,
               search: nil
             }) == [playlist1, playlist2]
    end

    test "list playlists returns the specified number of playlists starting at the specified offset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      _playlist1 = playlist_fixture(%{organization_id: organization.id})
      _playlist2 = playlist_fixture(%{organization_id: organization.id})
      _playlist3 = playlist_fixture(%{organization_id: organization.id})
      playlist4 = playlist_fixture(%{organization_id: organization.id})
      playlist5 = playlist_fixture(%{organization_id: organization.id})
      playlist6 = playlist_fixture(%{organization_id: organization.id})

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               page: 2,
               page_size: 3,
               search: nil
             }) == [
               playlist4,
               playlist5,
               playlist6
             ]
    end

    test "list playlists returns the remaining playlists when limit + offset is greater than the number of playlists" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      _playlist1 = playlist_fixture(%{organization_id: organization.id})
      _playlist2 = playlist_fixture(%{organization_id: organization.id})
      _playlist3 = playlist_fixture(%{organization_id: organization.id})
      playlist4 = playlist_fixture(%{organization_id: organization.id})

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               page_size: 3,
               page: 2,
               search: nil
             }) == [playlist4]
    end
  end

  describe "filter" do
    @describetag :filter

    test "list playlists returns the playlists that match the specified filter" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      _playlist1 = playlist_fixture(%{organization_id: organization.id, name: "Apples"})
      playlist2 = playlist_fixture(%{organization_id: organization.id, name: "Bananas"})
      _playlist3 = playlist_fixture(%{organization_id: organization.id, name: "Oranges"})
      _playlist4 = playlist_fixture(%{organization_id: organization.id, name: "Pears"})
      playlist5 = playlist_fixture(%{organization_id: organization.id, name: "Blueberries"})

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               search: "B",
               page: 1,
               page_size: 10
             }) == [
               playlist2,
               playlist5
             ]

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               search: "Bl",
               page: 1,
               page_size: 10
             }) == [playlist5]

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               search: "Bla",
               page: 1,
               page_size: 10
             }) == []
    end

    test "list playlists filter is case insensitive" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      _playlist1 = playlist_fixture(%{organization_id: organization.id, name: "Apples"})
      _playlist2 = playlist_fixture(%{organization_id: organization.id, name: "Bananas"})
      playlist3 = playlist_fixture(%{organization_id: organization.id, name: "Oranges"})
      _playlist4 = playlist_fixture(%{organization_id: organization.id, name: "Pears"})
      _playlist5 = playlist_fixture(%{organization_id: organization.id, name: "Blueberries"})

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               search: "or",
               page: 1,
               page_size: 10
             }) == [playlist3]
    end

    test "list playlists matches within name" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      _playlist1 = playlist_fixture(%{organization_id: organization.id, name: "Apples"})
      playlist2 = playlist_fixture(%{organization_id: organization.id, name: "Bananas"})
      _playlist3 = playlist_fixture(%{organization_id: organization.id, name: "Oranges"})
      _playlist4 = playlist_fixture(%{organization_id: organization.id, name: "Pears"})
      _playlist5 = playlist_fixture(%{organization_id: organization.id, name: "Blueberries"})

      assert Resources.list_resources(Playlist, %{
               organization_id: organization.id,
               search: "ana",
               page: 1,
               page_size: 10
             }) == [playlist2]
    end
  end
end
