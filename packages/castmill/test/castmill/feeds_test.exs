defmodule Castmill.FeedsTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Feeds
  alias Castmill.Feeds.{Feed, FeedEntry}
  alias Castmill.Repo

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    {:ok, feed} = Feeds.create_feed(organization.id, %{name: "Posts", keep: 3})
    {:ok, organization: organization, feed: feed}
  end

  defp ids(entries), do: Enum.map(entries, & &1["title"])
  defp titles(feed), do: feed |> Feeds.data() |> Map.fetch!("entries") |> ids()
  defp reload(feed), do: Repo.get!(Feed, feed.id)

  describe "feeds" do
    test "creates, lists, updates and deletes feeds", %{organization: organization, feed: feed} do
      assert feed.mode == "list"
      assert feed.version == 1

      {:ok, _doc} =
        Feeds.create_feed(organization.id, %{
          name: "Hours",
          mode: "document",
          media_fields: [%{"path" => "photos[].url", "mode" => "link"}]
        })

      assert %{count: 2, data: [hours, posts]} = Feeds.list_feeds(organization.id)
      assert hours["name"] == "Hours"
      assert hours["entry_count"] == nil
      assert posts["entry_count"] == 0
      assert posts["usage_count"] == 0

      assert %{count: 1, data: [%{"name" => "Posts"}]} =
               Feeds.list_feeds(organization.id, %{"search" => "pos", "page_size" => "5"})

      assert %{data: [%{"name" => "Posts"}]} =
               Feeds.list_feeds(organization.id, %{"page" => "2", "page_size" => "1"})

      assert Feeds.get_feed(organization.id, feed.id).id == feed.id
      assert Feeds.get_feed(Ecto.UUID.generate(), feed.id) == nil
      assert Feeds.get_feed(organization.id, "nope") == nil
      assert Feeds.get_feed("nope") == nil

      assert {:ok, updated} = Feeds.update_feed(feed, %{description: "News"})
      assert updated.version == 1
      assert {:ok, _} = Feeds.delete_feed(updated)
      assert Feeds.get_feed(feed.id) == nil
    end

    test "validates settings", %{organization: organization} do
      for {attrs, field} <- [
            {%{name: ""}, :name},
            {%{name: "x", mode: "table"}, :mode},
            {%{name: "x", keep: 0}, :keep},
            {%{name: "x", keep: 101}, :keep},
            {%{name: "x", schema: %{"title" => "nope"}}, :schema},
            {%{name: "x", media_fields: [%{"path" => "bad path"}]}, :media_fields},
            {%{name: "x", media_fields: [%{"path" => "a", "mode" => "move"}]}, :media_fields},
            {%{name: "x", media_fields: [%{"path" => "a", "x" => 1}]}, :media_fields},
            {%{name: "x", media_fields: ["a"]}, :media_fields},
            {%{name: "x", media_fields: [%{"path" => "a"}, %{"path" => "a"}]}, :media_fields},
            {%{name: "x", media_fields: for(n <- 1..21, do: %{"path" => "f#{n}"})},
             :media_fields},
            {%{name: "Posts"}, :name}
          ] do
        assert {:error, changeset} = Feeds.create_feed(organization.id, attrs)
        assert Keyword.has_key?(changeset.errors, field), inspect({attrs, changeset.errors})
      end
    end

    test "enforces the feed quota", %{organization: organization} do
      Castmill.Quotas.add_quota_to_organization(organization.id, :feeds, 1)
      assert {:error, :quota_exceeded} = Feeds.create_feed(organization.id, %{name: "More"})
    end
  end

  describe "list feeds" do
    test "appends entries newest first and keeps the latest", %{feed: feed} do
      assert {:ok, %{entries: [entry], version: 2}} =
               Feeds.append_entries(feed, [%{"title" => "a", "id" => "ignored"}])

      assert entry["title"] == "a"
      assert entry["id"] != "ignored"
      assert entry["received_at"]

      {:ok, %{entries: stored}} =
        Feeds.append_entries(feed, [%{"title" => "b"}, %{"title" => "c"}, %{"title" => "d"}])

      # Batches are chronological; the response and data are newest first.
      assert ids(stored) == ["d", "c", "b"]
      assert titles(feed) == ["d", "c", "b"]
      assert reload(feed).version == 3
      assert reload(feed).data_updated_at
    end

    test "omits entries already dropped by keep", %{feed: feed} do
      entries = for n <- 1..5, do: %{"title" => "#{n}"}
      assert {:ok, %{entries: stored}} = Feeds.append_entries(feed, entries)
      assert ids(stored) == ["5", "4", "3"]
      assert Repo.aggregate(FeedEntry, :count) == 3
    end

    test "replaces entries with the same external id in place", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"external_id" => 7, "title" => "old"}])
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "other"}])

      {:ok, %{entries: [updated]}} =
        Feeds.append_entries(feed, [%{"external_id" => "7", "title" => "new"}])

      assert updated["external_id"] == "7"
      assert titles(feed) == ["other", "new"]

      # Duplicates within a batch keep the last one.
      {:ok, %{entries: stored}} =
        Feeds.append_entries(feed, [
          %{"external_id" => "x", "title" => "first"},
          %{"external_id" => " ", "title" => "blank id"},
          %{"external_id" => "x", "title" => "second"}
        ])

      assert ids(stored) == ["second", "blank id"]
    end

    test "validates entries", %{organization: organization, feed: feed} do
      {:ok, typed} =
        Feeds.create_feed(organization.id, %{
          name: "Typed",
          schema: %{"title" => %{"type" => "string", "required" => true}}
        })

      big = String.duplicate("x", Feeds.max_entry_bytes())

      assert {:error, {:schema_mismatch, 1, message}} =
               Feeds.append_entries(typed, [%{"title" => "ok"}, %{"text" => "no title"}])

      assert message =~ "title"
      assert {:ok, _} = Feeds.append_entries(typed, [%{"title" => "ok", "extra" => 1}])

      assert {:error, {:entry_too_large, 0}} = Feeds.append_entries(feed, [%{"t" => big}])
      assert {:error, {:invalid_entry, 0, _}} = Feeds.append_entries(feed, ["text"])

      assert {:error, {:invalid_entry, 0, "external_id must be a string or an integer"}} =
               Feeds.append_entries(feed, [%{"external_id" => %{}}])

      assert {:error, {:invalid_entry, 0, "external_id is longer than 255 characters"}} =
               Feeds.append_entries(feed, [%{"external_id" => String.duplicate("x", 256)}])

      assert {:error, :no_entries} = Feeds.append_entries(feed, [])

      assert {:error, :too_many_entries} =
               Feeds.append_entries(feed, List.duplicate(%{}, Feeds.max_batch() + 1))

      assert {:error, {:invalid_entry, 0, _}} = Feeds.append_entries(feed, :invalid)
      assert reload(feed).version == 1
    end

    test "replaces all entries", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "a"}])

      assert {:ok, %{entries: stored}} =
               Feeds.replace_data(feed, %{"entries" => [%{"title" => "x"}, %{"title" => "y"}]})

      assert ids(stored) == ["y", "x"]
      assert titles(feed) == ["y", "x"]
      assert {:error, {:invalid_entry, 0, _}} = Feeds.replace_data(feed, %{"title" => "x"})
      assert {:error, :no_entries} = Feeds.replace_data(feed, %{"entries" => []})
    end

    test "deletes entries and clears the feed", %{feed: feed} do
      {:ok, %{entries: [entry]}} = Feeds.append_entries(feed, [%{"title" => "a"}])
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "b"}])

      assert {:ok, %Feed{}} = Feeds.delete_entry(feed, entry["id"])
      assert titles(feed) == ["b"]
      assert {:error, :not_found} = Feeds.delete_entry(feed, entry["id"])
      assert {:error, :not_found} = Feeds.delete_entry(feed, "nope")

      assert {:ok, %Feed{}} = Feeds.clear(feed)
      assert titles(feed) == []
    end

    test "lowering keep drops the oldest entries", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "a"}, %{"title" => "b"}])
      assert {:ok, updated} = Feeds.update_feed(feed, %{keep: 1})
      assert updated.version == 3
      assert titles(updated) == ["b"]
      assert {:error, %Ecto.Changeset{}} = Feeds.update_feed(updated, %{keep: 0})
    end

    test "appends one entry to several feeds atomically", %{
      organization: organization,
      feed: feed
    } do
      {:ok, other} = Feeds.create_feed(organization.id, %{name: "Other"})

      assert {:ok, [first, second]} =
               Feeds.append_to_feeds([feed, other, feed], %{"title" => "shared"})

      assert first.feed_id == feed.id and second.feed_id == other.id
      assert [%{"title" => "shared"}] = first.entries
      assert titles(other) == ["shared"]

      {:ok, typed} =
        Feeds.create_feed(organization.id, %{
          name: "Typed",
          schema: %{"title" => %{"type" => "number"}}
        })

      assert {:error, {:feed, id, {:schema_mismatch, 0, _}}} =
               Feeds.append_to_feeds([feed, typed], %{"title" => "text"})

      assert id == typed.id
      assert titles(feed) == ["shared"]

      {:ok, document} = Feeds.create_feed(organization.id, %{name: "Doc", mode: "document"})

      assert {:error, {:not_a_list_feed, doc_id}} =
               Feeds.append_to_feeds([feed, document], %{"title" => "x"})

      assert doc_id == document.id
      assert {:error, :no_feeds} = Feeds.append_to_feeds([], %{})
    end
  end

  describe "document feeds" do
    setup %{organization: organization} do
      {:ok, feed} =
        Feeds.create_feed(organization.id, %{
          name: "Hours",
          mode: "document",
          schema: %{"open" => %{"type" => "string", "required" => true}}
        })

      {:ok, document_feed: feed}
    end

    test "replaces the document", %{document_feed: feed} do
      assert Feeds.data(feed) == %{"document" => nil, "updated_at" => nil}

      assert {:ok, %{document: %{"open" => "9-17"}, version: 2}} =
               Feeds.replace_data(feed, %{"open" => "9-17"})

      assert %{"document" => %{"open" => "9-17"}, "updated_at" => at} = Feeds.data(reload(feed))
      assert at

      assert {:error, {:schema_mismatch, 0, _}} = Feeds.replace_data(feed, %{"close" => "x"})

      assert {:error, :document_too_large} =
               Feeds.replace_data(feed, %{
                 "open" => String.duplicate("x", Feeds.max_document_bytes())
               })

      assert {:error, {:invalid_entry, 0, _}} = Feeds.replace_data(feed, "text")
      assert {:error, :not_a_list_feed} = Feeds.append_entries(feed, [%{"open" => "x"}])

      assert {:ok, cleared} = Feeds.clear(reload(feed))
      assert cleared.document == nil
    end
  end

  test "notifies dashboard previews on writes", %{organization: organization, feed: feed} do
    Phoenix.PubSub.subscribe(Castmill.PubSub, "organization:#{organization.id}")
    {:ok, _} = Feeds.append_entries(feed, [%{"title" => "a"}])

    feed_id = feed.id

    assert_receive {:widget_config_data_update,
                    %{
                      feed_id: ^feed_id,
                      widget_id: nil,
                      version: 2,
                      data: %{"entries" => [%{"title" => "a"}]}
                    }}

    {:ok, _} = Feeds.update_feed(reload(feed), %{name: "Renamed"})
    refute_receive {:widget_config_data_update, _}, 50
  end

  describe "tokens" do
    test "creates, authenticates and revokes tokens", %{feed: feed} do
      assert {:ok, token, secret} = Feeds.create_token(feed, %{"name" => "Make"})
      assert String.starts_with?(secret, Feeds.token_prefix())
      assert token.hint == String.slice(secret, -4, 4)
      refute token.secret_hash == secret

      assert {:ok, %{feed: %Feed{id: feed_id}} = authenticated} = Feeds.authenticate_token(secret)
      assert feed_id == feed.id
      assert authenticated.last_used_at

      assert {:error, :invalid_token} = Feeds.authenticate_token(secret <> "x")
      assert {:error, :invalid_token} = Feeds.authenticate_token("other")

      {:ok, _unnamed, _} = Feeds.create_token(feed, %{})
      assert ["Make", "Token"] = Enum.map(Feeds.list_tokens(feed), & &1.name)

      assert {:ok, revoked} = Feeds.revoke_token(feed, token.id)
      assert revoked.revoked_at
      assert {:ok, ^revoked} = Feeds.revoke_token(feed, token.id)
      assert {:error, :invalid_token} = Feeds.authenticate_token(secret)
      assert {:error, :not_found} = Feeds.revoke_token(feed, Ecto.UUID.generate())
      assert {:error, :not_found} = Feeds.revoke_token(feed, "nope")

      # Revoked tokens are listed last.
      assert [%{name: "Token", revoked_at: nil}, %{name: "Make"}] = Feeds.list_tokens(feed)
    end
  end

  describe "widgets" do
    setup %{organization: organization, feed: feed} do
      widget =
        widget_fixture(%{
          is_system: true,
          options_schema: %{
            "feed" => %{"type" => "string", "choices" => %{"list" => "feeds"}},
            "title" => "string"
          }
        })

      playlist = playlist_fixture(%{organization_id: organization.id})
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "a"}])
      {:ok, widget: widget, playlist: playlist}
    end

    test "widget_data/3 reads the selected feed", %{
      organization: organization,
      feed: feed,
      widget: widget
    } do
      assert Feeds.feed_option(widget) == "feed"
      assert Feeds.feed_option(%{options_schema: %{"title" => "string"}}) == nil
      assert Feeds.feed_option(nil) == nil

      assert :not_a_feed_widget =
               Feeds.widget_data(%{options_schema: %{}}, organization.id, %{})

      assert {:ok, nil} = Feeds.widget_data(widget, organization.id, %{})
      assert {:ok, nil} = Feeds.widget_data(widget, organization.id, nil)

      assert {:ok, %{data: %{"entries" => [%{"title" => "a"}]}, version: 2}} =
               Feeds.widget_data(widget, organization.id, %{"feed" => feed.id})

      other = organization_fixture(%{network_id: organization.network_id, name: "Other org"})

      assert {:error, :feed_not_found} =
               Feeds.widget_data(widget, other.id, %{"feed" => feed.id})
    end

    test "playlists deliver feed data to devices", %{
      organization: organization,
      feed: feed,
      widget: widget,
      playlist: playlist
    } do
      {:ok, _item} =
        Castmill.Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 10_000, %{
          "feed" => feed.id
        })

      %{items: [item]} = Castmill.Resources.get_playlist(playlist.id)
      assert %{"entries" => [%{"title" => "a"}], "updated_at" => _} = item.config.data
      refute Map.has_key?(item, :integration_error)

      assert Feeds.usage_counts(organization.id, [feed.id, Ecto.UUID.generate()]) == %{
               feed.id => 1
             }

      assert [%{id: playlist_id, items: 1}] = Feeds.used_by(organization.id, feed)
      assert playlist_id == playlist.id
      assert [%{"usage_count" => 1}] = Feeds.list_feeds(organization.id)[:data]

      {:ok, _} = Feeds.delete_feed(feed)
      %{items: [item]} = Castmill.Resources.get_playlist(playlist.id)
      assert item.integration_error == "The selected data feed no longer exists"
    end

    test "playlists show defaults when no feed is selected", %{widget: widget, playlist: playlist} do
      {:ok, _} =
        Castmill.Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 10_000, %{})

      %{items: [item]} = Castmill.Resources.get_playlist(playlist.id)
      refute Map.has_key?(item, :integration_error)
    end

    test "choices list the organization's feeds", %{organization: organization, feed: feed} do
      {:ok, other} = Feeds.create_feed(organization.id, %{name: "Alarms", description: "Fire"})

      assert {:ok, %{items: [alarms, posts], next: nil}} =
               Feeds.choices(organization.id, %{})

      assert alarms == %{value: other.id, label: "Alarms", description: "Fire"}
      assert posts == %{value: feed.id, label: "Posts"}

      assert {:ok, %{items: [%{label: "Posts"}]}} =
               Feeds.choices(organization.id, %{"query" => "pos"})

      # Selected feeds come first, even when they don't match the search.
      assert {:ok, %{items: [%{label: "Alarms"}, %{label: "Posts"}]}} =
               Feeds.choices(organization.id, %{"query" => "pos", "values" => [other.id, "x"]})

      Castmill.Quotas.add_quota_to_organization(organization.id, :feeds, 100)
      for n <- 1..50, do: {:ok, _} = Feeds.create_feed(organization.id, %{name: "F#{n}"})

      assert {:ok, %{items: page, next: "50"}} = Feeds.choices(organization.id, %{})
      assert length(page) == 50

      assert {:ok, %{items: [_, _], next: nil}} =
               Feeds.choices(organization.id, %{"cursor" => "50"})
    end
  end
end
