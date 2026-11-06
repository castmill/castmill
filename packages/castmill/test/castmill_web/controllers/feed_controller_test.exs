defmodule CastmillWeb.FeedControllerTest do
  use CastmillWeb.ConnCase, async: false

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.{Feeds, Organizations}

  setup %{conn: conn} do
    Castmill.RateLimiter.clear()
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    {:ok, conn: put_req_header(conn, "accept", "application/json"), organization: organization}
  end

  defp authenticate(conn, organization, role) do
    user = user_fixture(%{organization_id: organization.id})
    {:ok, _} = Organizations.add_user(organization.id, user.id, role)
    secret = "token-" <> Ecto.UUID.generate()
    access_token_fixture(%{secret: secret, user_id: user.id, is_root: false})
    put_req_header(conn, "authorization", "Bearer " <> secret)
  end

  defp feeds_path(organization, suffix \\ ""),
    do: "/dashboard/organizations/#{organization.id}/feeds#{suffix}"

  test "manages feeds", %{conn: conn, organization: organization} do
    conn = authenticate(conn, organization, :editor)

    assert %{"data" => %{"id" => id, "name" => "Posts", "entry_count" => 0} = created} =
             conn
             |> post(feeds_path(organization), %{"feed" => %{"name" => "Posts", "keep" => 5}})
             |> json_response(201)

    assert created["endpoints"]["append"] =~ "/api/v1/feeds/#{id}/entries"
    assert created["used_by"] == []

    assert %{"errors" => %{"name" => _}} =
             conn
             |> post(feeds_path(organization), %{"feed" => %{"name" => "Posts"}})
             |> json_response(422)

    assert %{"count" => 1, "data" => [%{"id" => ^id}]} =
             conn |> get(feeds_path(organization)) |> json_response(200)

    assert %{"data" => %{"keep" => 3}} =
             conn
             |> patch(feeds_path(organization, "/#{id}"), %{"feed" => %{"keep" => 3}})
             |> json_response(200)

    assert %{"data" => %{"name" => "Posts"}} =
             conn |> get(feeds_path(organization, "/#{id}")) |> json_response(200)

    assert conn |> delete(feeds_path(organization, "/#{id}")) |> response(204)
    assert conn |> get(feeds_path(organization, "/#{id}")) |> json_response(404)
  end

  test "reports the quota", %{conn: conn, organization: organization} do
    Castmill.Quotas.add_quota_to_organization(organization.id, :feeds, 0)

    assert %{"error" => "quota_exceeded"} =
             conn
             |> authenticate(organization, :admin)
             |> post(feeds_path(organization), %{"feed" => %{"name" => "Posts"}})
             |> json_response(403)
  end

  test "sends test entries and manages entries", %{conn: conn, organization: organization} do
    {:ok, feed} = Feeds.create_feed(organization.id, %{name: "Posts"})
    {:ok, document} = Feeds.create_feed(organization.id, %{name: "Hours", mode: "document"})
    conn = authenticate(conn, organization, :member)

    assert %{"data" => %{"entries" => [%{"id" => entry_id, "title" => "Hello"}]}, "version" => 2} =
             conn
             |> post(feeds_path(organization, "/#{feed.id}/test-entry"), %{
               "entry" => %{"title" => "Hello"}
             })
             |> json_response(200)

    assert %{"data" => %{"document" => %{"open" => "9"}}} =
             conn
             |> post(feeds_path(organization, "/#{document.id}/test-entry"), %{
               "document" => %{"open" => "9"}
             })
             |> json_response(200)

    assert %{"error" => "expected an entry or a document"} =
             conn
             |> post(feeds_path(organization, "/#{document.id}/test-entry"), %{"entry" => %{}})
             |> json_response(422)

    assert %{"error" => "The entry is too large"} =
             conn
             |> post(feeds_path(organization, "/#{feed.id}/test-entry"), %{
               "entry" => %{"t" => String.duplicate("x", Feeds.max_entry_bytes())}
             })
             |> json_response(422)

    assert %{"data" => %{"entries" => [_]}} =
             conn |> get(feeds_path(organization, "/#{feed.id}/entries")) |> json_response(200)

    assert conn
           |> delete(feeds_path(organization, "/#{feed.id}/entries/#{entry_id}"))
           |> response(204)

    assert conn |> delete(feeds_path(organization, "/#{feed.id}/entries")) |> response(204)
  end

  test "shows token secrets once", %{conn: conn, organization: organization} do
    {:ok, feed} = Feeds.create_feed(organization.id, %{name: "Posts"})
    conn = authenticate(conn, organization, :editor)

    assert %{"data" => %{"id" => token_id, "name" => "Make", "hint" => hint}, "secret" => secret} =
             conn
             |> post(feeds_path(organization, "/#{feed.id}/tokens"), %{"name" => "Make"})
             |> json_response(201)

    assert String.ends_with?(secret, hint)

    assert %{"data" => [token]} =
             conn |> get(feeds_path(organization, "/#{feed.id}/tokens")) |> json_response(200)

    refute Map.has_key?(token, "secret")
    refute Map.has_key?(token, "secret_hash")

    assert %{"data" => %{"revoked_at" => revoked_at}} =
             conn
             |> delete(feeds_path(organization, "/#{feed.id}/tokens/#{token_id}"))
             |> json_response(200)

    assert revoked_at

    assert conn
           |> delete(feeds_path(organization, "/#{feed.id}/tokens/#{Ecto.UUID.generate()}"))
           |> json_response(404)
  end

  test "checks roles and organizations", %{conn: conn, organization: organization} do
    {:ok, feed} = Feeds.create_feed(organization.id, %{name: "Posts"})
    guest = authenticate(conn, organization, :guest)

    assert guest |> get(feeds_path(organization)) |> json_response(200)
    assert guest |> get(feeds_path(organization, "/#{feed.id}")) |> json_response(200)

    assert guest
           |> post(feeds_path(organization), %{"feed" => %{"name" => "X"}})
           |> json_response(403)

    assert guest
           |> post(feeds_path(organization, "/#{feed.id}/tokens"), %{})
           |> json_response(403)

    assert guest |> delete(feeds_path(organization, "/#{feed.id}")) |> json_response(403)

    other = organization_fixture(%{network_id: organization.network_id, name: "Other org"})
    admin = authenticate(build_conn(), other, :admin)
    assert admin |> get(feeds_path(other, "/#{feed.id}")) |> json_response(404)
    assert admin |> get(feeds_path(organization)) |> json_response(403)
  end

  test "answers 404 for feeds of other organizations", %{conn: conn, organization: organization} do
    conn = authenticate(conn, organization, :admin)
    missing = Ecto.UUID.generate()

    for {method, suffix} <- [
          {:patch, ""},
          {:delete, ""},
          {:get, "/entries"},
          {:post, "/test-entry"},
          {:delete, "/entries"},
          {:delete, "/entries/#{missing}"},
          {:get, "/tokens"},
          {:post, "/tokens"},
          {:delete, "/tokens/#{missing}"}
        ] do
      conn =
        dispatch(conn, @endpoint, method, feeds_path(organization, "/#{missing}#{suffix}"), %{})

      assert json_response(conn, 404), "#{method} #{suffix}"
    end
  end

  test "explains invalid test entries", %{conn: conn, organization: organization} do
    {:ok, typed} =
      Feeds.create_feed(organization.id, %{
        name: "Typed",
        schema: %{"title" => %{"type" => "number"}}
      })

    conn = authenticate(conn, organization, :admin)
    path = feeds_path(organization, "/#{typed.id}/test-entry")

    assert %{"error" => message} =
             conn |> post(path, %{"entry" => %{"title" => "x"}}) |> json_response(422)

    assert message =~ "not a number"

    assert %{"error" => "external_id must be a string or an integer"} =
             conn
             |> post(path, %{"entry" => %{"title" => 1, "external_id" => [1]}})
             |> json_response(422)

    assert %{"errors" => _} =
             conn
             |> patch(feeds_path(organization, "/#{typed.id}"), %{"feed" => %{"keep" => 0}})
             |> json_response(422)
  end

  describe "widgets showing feeds" do
    setup %{organization: organization} do
      {:ok, feed} = Feeds.create_feed(organization.id, %{name: "Posts"})
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "a"}])

      widget =
        widget_fixture(%{
          is_system: true,
          options_schema: %{"feed" => %{"type" => "string", "choices" => %{"list" => "feeds"}}}
        })

      {:ok, feed: feed, widget: widget}
    end

    test "lists feeds as choices", %{conn: conn, organization: organization, widget: widget} do
      assert %{"items" => [%{"label" => "Posts"}], "next" => nil} =
               conn
               |> authenticate(organization, :editor)
               |> post(
                 "/dashboard/organizations/#{organization.id}/widgets/#{widget.id}/choices/feed",
                 %{}
               )
               |> json_response(200)
    end

    test "previews and widget data read the feed", %{
      conn: conn,
      organization: organization,
      feed: feed,
      widget: widget
    } do
      conn = authenticate(conn, organization, :admin)
      prefetch = "/dashboard/organizations/#{organization.id}/widgets/#{widget.id}/prefetch-data"

      assert %{"data" => %{"entries" => [%{"title" => "a"}]}, "version" => 2} =
               conn
               |> post(prefetch, %{"options" => %{"feed" => feed.id}})
               |> json_response(200)

      assert %{"data" => nil, "status" => "no_feed"} =
               conn |> post(prefetch, %{"options" => %{}}) |> json_response(200)

      assert %{"status" => "error"} =
               conn
               |> post(prefetch, %{"options" => %{"feed" => Ecto.UUID.generate()}})
               |> json_response(200)

      playlist = playlist_fixture(%{organization_id: organization.id})

      {:ok, item} =
        Castmill.Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 10_000, %{
          "feed" => feed.id
        })

      data_path = "/dashboard/widget-configs/#{item.widget_config_id}/data"

      assert %{"data" => %{"entries" => [_]}, "version" => 2} =
               conn |> get(data_path) |> json_response(200)

      assert conn |> get(data_path, %{"version" => "2"}) |> response(304)
    end
  end
end
