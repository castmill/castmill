defmodule CastmillWeb.FeedApiControllerTest do
  use CastmillWeb.ConnCase, async: false

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.{Feeds, Organizations}

  setup %{conn: conn} do
    Castmill.RateLimiter.clear()
    previous = Application.get_env(:castmill, CastmillWeb.FeedApiController)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:castmill, CastmillWeb.FeedApiController, previous),
        else: Application.delete_env(:castmill, CastmillWeb.FeedApiController)

      Castmill.RateLimiter.clear()
    end)

    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    {:ok, feed} = Feeds.create_feed(organization.id, %{name: "Posts", keep: 2})
    {:ok, _token, secret} = Feeds.create_token(feed, %{"name" => "Make"})

    {:ok,
     conn: put_req_header(conn, "accept", "application/json"),
     organization: organization,
     feed: feed,
     secret: secret}
  end

  defp bearer(conn, secret), do: put_req_header(conn, "authorization", "Bearer " <> secret)

  defp member_secret(organization, role) do
    user = user_fixture(%{organization_id: organization.id})
    {:ok, _} = Organizations.add_user(organization.id, user.id, role)
    secret = "member-" <> Ecto.UUID.generate()
    access_token_fixture(%{secret: secret, user_id: user.id, is_root: false})
    secret
  end

  defp feed_path(feed, suffix \\ ""), do: "/api/v1/feeds/#{feed.id}#{suffix}"

  describe "feed tokens" do
    test "append entries, one or several", %{conn: conn, feed: feed, secret: secret} do
      conn = bearer(conn, secret)

      assert %{"entries" => [entry], "version" => 2, "feed_id" => feed_id} =
               conn |> post(feed_path(feed, "/entries"), %{"title" => "a"}) |> json_response(201)

      assert entry["title"] == "a"
      assert feed_id == feed.id

      assert %{"entries" => [%{"title" => "c"}, %{"title" => "b"}]} =
               conn
               |> post(feed_path(feed, "/entries"), %{
                 "entries" => [%{"title" => "b"}, %{"title" => "c"}]
               })
               |> json_response(201)

      assert %{"entries" => [%{"title" => "e"}, %{"title" => "d"}]} =
               conn
               |> put_req_header("content-type", "application/json")
               |> post(
                 feed_path(feed, "/entries"),
                 Jason.encode!([%{"title" => "d"}, %{"title" => "e"}])
               )
               |> json_response(201)

      assert %{"data" => %{"entries" => [%{"title" => "e"}, %{"title" => "d"}]}, "keep" => 2} =
               conn |> get(feed_path(feed)) |> json_response(200)
    end

    test "replace, delete and clear", %{conn: conn, feed: feed, secret: secret} do
      conn = bearer(conn, secret)

      assert %{"entries" => [%{"id" => id}]} =
               conn
               |> put(feed_path(feed, "/data"), %{"entries" => [%{"title" => "x"}]})
               |> json_response(200)

      assert conn |> delete(feed_path(feed, "/entries/#{id}")) |> response(204)

      assert %{"error" => "not_found"} =
               conn |> delete(feed_path(feed, "/entries/#{id}")) |> json_response(404)

      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "y"}])
      assert conn |> delete(feed_path(feed, "/entries")) |> response(204)
      assert %{"data" => %{"entries" => []}} = conn |> get(feed_path(feed)) |> json_response(200)
    end

    test "can't access other feeds or several feeds", %{
      conn: conn,
      organization: organization,
      feed: feed,
      secret: secret
    } do
      {:ok, other} = Feeds.create_feed(organization.id, %{name: "Other"})
      conn = bearer(conn, secret)

      assert %{"error" => "forbidden"} =
               conn |> post(feed_path(other, "/entries"), %{"a" => 1}) |> json_response(403)

      assert %{"error" => "forbidden"} =
               conn
               |> post("/api/v1/feeds/entries", %{"feeds" => [feed.id], "entry" => %{}})
               |> json_response(403)
    end

    test "revoked or unknown tokens are rejected", %{conn: conn, feed: feed, secret: secret} do
      [token] = Feeds.list_tokens(feed)
      {:ok, _} = Feeds.revoke_token(feed, token.id)

      for header <- ["Bearer " <> secret, "Bearer cmfeed_nope", "Bearer ", "Basic x"] do
        conn = conn |> put_req_header("authorization", header) |> get(feed_path(feed))
        assert %{"error" => "unauthorized"} = json_response(conn, 401)
        assert get_resp_header(conn, "www-authenticate") != []
      end

      assert %{"error" => "unauthorized"} = conn |> get(feed_path(feed)) |> json_response(401)
    end

    test "reports write errors", %{
      conn: conn,
      organization: organization,
      feed: feed,
      secret: secret
    } do
      conn = bearer(conn, secret)
      big = String.duplicate("x", Feeds.max_entry_bytes())

      assert %{"error" => "entry_too_large", "index" => 0} =
               conn |> post(feed_path(feed, "/entries"), %{"t" => big}) |> json_response(413)

      assert %{"error" => "too_many_entries"} =
               conn
               |> post(feed_path(feed, "/entries"), %{"entries" => List.duplicate(%{}, 101)})
               |> json_response(413)

      assert %{"error" => "invalid_entry"} =
               conn |> post(feed_path(feed, "/entries"), %{}) |> json_response(400)

      assert %{"error" => "invalid_entry", "index" => 0} =
               conn
               |> post(feed_path(feed, "/entries"), %{"external_id" => %{}})
               |> json_response(400)

      assert %{"error" => "invalid_entry"} =
               conn
               |> put_req_header("content-type", "application/json")
               |> post(feed_path(feed, "/entries"), Jason.encode!("text"))
               |> json_response(400)

      assert %{"error" => "invalid_entry"} =
               conn |> put(feed_path(feed, "/data"), %{"title" => "x"}) |> json_response(400)

      {:ok, typed} =
        Feeds.create_feed(organization.id, %{
          name: "Typed",
          mode: "document",
          schema: %{"open" => %{"type" => "string", "required" => true}}
        })

      {:ok, _, typed_secret} = Feeds.create_token(typed, %{})
      typed_conn = bearer(build_conn(), typed_secret)

      assert %{"error" => "schema_mismatch", "message" => message} =
               typed_conn
               |> put(feed_path(typed, "/data"), %{"close" => "x"})
               |> json_response(400)

      assert message =~ "open"

      assert %{"error" => "not_a_list_feed"} =
               typed_conn
               |> post(feed_path(typed, "/entries"), %{"open" => "x"})
               |> json_response(400)

      assert %{"document" => %{"open" => "9"}, "version" => 2} =
               typed_conn
               |> put(feed_path(typed, "/data"), %{"open" => "9"})
               |> json_response(200)
    end

    test "rate limits each token", %{conn: conn, feed: feed, secret: secret} do
      Application.put_env(:castmill, CastmillWeb.FeedApiController, token_limit_per_minute: 1)
      conn = bearer(conn, secret)

      assert conn |> get(feed_path(feed)) |> json_response(200)
      assert %{"error" => "rate_limited"} = conn |> get(feed_path(feed)) |> json_response(429)
    end

    test "rate limits each feed", %{
      conn: conn,
      organization: organization,
      feed: feed,
      secret: secret
    } do
      Application.put_env(:castmill, CastmillWeb.FeedApiController, feed_limit_per_minute: 1)

      assert conn |> bearer(secret) |> get(feed_path(feed)) |> json_response(200)

      assert %{"error" => "rate_limited"} =
               conn
               |> bearer(member_secret(organization, :admin))
               |> get(feed_path(feed))
               |> json_response(429)
    end
  end

  describe "member tokens" do
    test "write according to the member's role", %{
      conn: conn,
      organization: organization,
      feed: feed
    } do
      editor = bearer(conn, member_secret(organization, :editor))
      guest = bearer(build_conn(), member_secret(organization, :guest))

      assert editor |> post(feed_path(feed, "/entries"), %{"title" => "a"}) |> json_response(201)
      assert guest |> get(feed_path(feed)) |> json_response(200)

      assert %{"error" => "forbidden"} =
               guest |> post(feed_path(feed, "/entries"), %{"title" => "b"}) |> json_response(403)

      assert %{"error" => "not_found"} =
               editor |> get("/api/v1/feeds/#{Ecto.UUID.generate()}") |> json_response(404)

      outsider =
        organization_fixture(%{network_id: organization.network_id, name: "Outsider org"})

      assert %{"error" => "forbidden"} =
               build_conn()
               |> bearer(member_secret(outsider, :admin))
               |> get(feed_path(feed))
               |> json_response(403)
    end

    test "append the same entry to several feeds", %{
      conn: conn,
      organization: organization,
      feed: feed
    } do
      {:ok, other} = Feeds.create_feed(organization.id, %{name: "Other"})
      conn = bearer(conn, member_secret(organization, :admin))

      assert %{"feeds" => [%{"feed_id" => first}, %{"feed_id" => second}]} =
               conn
               |> post("/api/v1/feeds/entries", %{
                 "feeds" => [feed.id, other.id],
                 "entry" => %{"title" => "shared"}
               })
               |> json_response(201)

      assert {first, second} == {feed.id, other.id}

      assert %{"error" => "invalid_request"} =
               conn |> post("/api/v1/feeds/entries", %{"entry" => %{}}) |> json_response(400)

      assert %{"error" => "invalid_request"} =
               conn
               |> post("/api/v1/feeds/entries", %{"feeds" => [feed.id]})
               |> json_response(400)

      assert %{"error" => "not_found"} =
               conn
               |> post("/api/v1/feeds/entries", %{"feeds" => [1], "entry" => %{}})
               |> json_response(404)

      assert %{"error" => "invalid_request"} =
               conn
               |> post("/api/v1/feeds/entries", %{
                 "feeds" => List.duplicate(feed.id, 101),
                 "entry" => %{}
               })
               |> json_response(400)

      {:ok, typed} =
        Feeds.create_feed(organization.id, %{
          name: "Typed",
          schema: %{"title" => %{"type" => "number"}}
        })

      assert %{"error" => "schema_mismatch", "feed_id" => typed_id} =
               conn
               |> post("/api/v1/feeds/entries", %{
                 "feeds" => [feed.id, typed.id],
                 "entry" => %{"title" => "x"}
               })
               |> json_response(400)

      assert typed_id == typed.id

      {:ok, document} = Feeds.create_feed(organization.id, %{name: "Doc", mode: "document"})

      assert %{"error" => "not_a_list_feed"} =
               conn
               |> post("/api/v1/feeds/entries", %{"feeds" => [document.id], "entry" => %{}})
               |> json_response(400)
    end

    test "agent tokens are member tokens", %{conn: conn, organization: organization, feed: feed} do
      {:ok, _agent, secret} =
        Castmill.Agents.create_agent(organization.id, %{"name" => "Bot", "role" => "editor"})

      assert conn
             |> bearer(secret)
             |> post(feed_path(feed, "/entries"), %{"title" => "from agent"})
             |> json_response(201)

      assert %{"error" => "unauthorized"} =
               build_conn()
               |> bearer(Castmill.Agents.secret_prefix() <> "nope")
               |> get(feed_path(feed))
               |> json_response(401)
    end

    test "blocked users are rejected", %{conn: conn, organization: organization, feed: feed} do
      user = user_fixture(%{organization_id: organization.id})
      {:ok, _} = Organizations.add_user(organization.id, user.id, :admin)
      secret = "blocked-" <> Ecto.UUID.generate()
      access_token_fixture(%{secret: secret, user_id: user.id, is_root: false})

      user
      |> Castmill.Accounts.User.block_changeset(%{
        blocked_at: DateTime.utc_now(),
        blocked_reason: "Spam"
      })
      |> Castmill.Repo.update!()

      assert %{"error" => "forbidden"} =
               conn |> bearer(secret) |> get(feed_path(feed)) |> json_response(403)
    end
  end
end
