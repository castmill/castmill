defmodule Castmill.Feeds.MediaTest do
  # Not async: the HTTP client and storage are configured through the app env.
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import ExUnit.CaptureLog
  import Mox

  alias Castmill.Feeds
  alias Castmill.Feeds.{Feed, FeedMedia, Media}
  alias Castmill.Feeds.MediaStorage.Fake, as: Storage
  alias Castmill.Repo
  alias Castmill.SafeHttp.FakeClient
  alias Castmill.Workers.{FeedMediaCleanup, FeedMediaDownloader}

  setup :verify_on_exit!

  @a "https://cdn.example.com/a.png"
  @b "https://cdn.example.com/b.png"

  setup do
    FakeClient.install()
    Storage.install()
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    Castmill.Quotas.add_quota_to_organization(organization.id, :storage, 100)

    {:ok, feed} =
      Feeds.create_feed(organization.id, %{
        name: "Posts",
        keep: 2,
        media_fields: [
          %{"path" => "image", "mode" => "copy"},
          %{"path" => "link", "mode" => "link"}
        ]
      })

    png = Image.new!(4, 3, color: :red) |> Image.write!(:memory, suffix: ".png")
    FakeClient.stub(@a, FakeClient.ok(png, [{"Content-Type", "image/png"}]))
    {:ok, organization: organization, feed: feed, png: png}
  end

  defp media(feed), do: Repo.all(from(m in FeedMedia, where: m.feed_id == ^feed.id))
  defp entries(feed), do: feed |> reload() |> Feeds.data() |> Map.fetch!("entries")
  defp reload(feed), do: Repo.get!(Feed, feed.id)

  defp downloads do
    receive do
      {:safe_http_get, url, headers, _options} -> [{url, headers} | downloads()]
    after
      0 -> []
    end
  end

  describe "copying" do
    test "copies media on receipt and swaps the stored URL in", %{feed: feed, png: png} do
      assert {:ok, %{entries: [entry], media: [status], version: version}} =
               Feeds.append_entries(feed, [%{"title" => "One", "image" => @a, "link" => @b}])

      # Downloads run inline in tests, so the media is ready in the response.
      assert status["status"] == "ready"
      assert status["original_url"] == @a
      assert entry["image"] == @a
      assert version == 2

      assert [%FeedMedia{status: "ready"} = m] = media(feed)
      assert m.content_type == "image/png"
      assert {m.width, m.height, m.size} == {4, 3, byte_size(png)}
      assert m.url == "https://cdn.test/" <> m.storage_key
      assert m.storage_key =~ ~r"^#{feed.organization_id}/feeds/#{feed.id}/#{m.id}\.png$"
      assert Storage.files()[m.storage_key] == {png, "image/png"}

      assert [stored] = entries(feed)
      assert stored["image"] == m.url
      assert stored["image_original"] == @a
      # Link fields are never copied.
      assert stored["link"] == @b
      assert reload(feed).version == 3

      assert [{@a, headers}] = downloads()
      assert {"Accept", accept} = List.keyfind(headers, "Accept", 0)
      assert accept =~ "image/*"
    end

    test "stores a URL once per feed", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "One", "image" => @a}])

      {:ok, %{media: [%{"status" => "ready"}]}} =
        Feeds.append_entries(feed, [%{"title" => "Two", "image" => @a}])

      assert [_] = media(feed)
      assert [_] = downloads()
      assert Enum.all?(entries(feed), &(&1["image_original"] == @a))
    end

    test "shares the file of identical content", %{feed: feed, png: png} do
      FakeClient.stub(@b, FakeClient.ok(png, [{"Content-Type", "image/png"}]))
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "One", "image" => @a}])
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "Two", "image" => @b}])

      assert [first, second] = Enum.sort_by(media(feed), & &1.inserted_at)
      assert first.storage_key == second.storage_key
      assert map_size(Storage.files()) == 1
      assert Media.feed_storage(feed.id) == byte_size(png)

      # Removing one keeps the shared file; removing both deletes it.
      [newest, _] = entries(feed)
      {:ok, _} = Feeds.delete_entry(feed, newest["id"])
      assert map_size(Storage.files()) == 1
      {:ok, _} = Feeds.clear(feed)
      assert Storage.files() == %{}
      assert media(feed) == []
    end

    test "copies document feeds with nested and array paths", %{
      organization: organization,
      png: png
    } do
      FakeClient.stub(@b, FakeClient.ok(png, []))

      {:ok, feed} =
        Feeds.create_feed(organization.id, %{
          name: "Doc",
          mode: "document",
          media_fields: [%{"path" => "post.photos[].url"}, %{"path" => "gallery[]"}]
        })

      capture_log(fn ->
        {:ok, %{media: statuses}} =
          Feeds.replace_data(feed, %{
            "post" => %{"photos" => [%{"url" => @a}]},
            "gallery" => [@b, "https://nowhere.test/x.png"]
          })

        send(self(), {:statuses, statuses})
      end)

      assert_received {:statuses, statuses}

      assert Enum.map(statuses, & &1["status"]) == ["ready", "ready", "failed"]

      document = reload(feed).document

      assert [%{"url" => "https://cdn.test/" <> _, "url_original" => @a}] =
               document["post"]["photos"]

      assert ["https://cdn.test/" <> _, "https://nowhere.test/x.png"] = document["gallery"]
      assert document["gallery_original"] == [@b, "https://nowhere.test/x.png"]
    end

    test "only copies the first media URLs of an entry", %{organization: organization} do
      {:ok, feed} =
        Feeds.create_feed(organization.id, %{
          name: "Many",
          media_fields: [%{"path" => "images[]"}]
        })

      urls = for i <- 1..25, do: "https://nowhere.test/#{i}.png"
      capture_log(fn -> {:ok, _} = Feeds.append_entries(feed, [%{"images" => urls}]) end)
      assert length(media(feed)) == 20
    end
  end

  describe "failures" do
    test "keeps the original URL when the download fails, and can retry", %{feed: feed, png: png} do
      FakeClient.stub(@b, {:ok, %{status_code: 404, headers: [], body: ""}})

      log =
        capture_log(fn ->
          {:ok, %{media: [%{"status" => "failed"}]}} =
            Feeds.append_entries(feed, [%{"title" => "One", "image" => @b}])
        end)

      # Logs only show the host.
      assert log =~ "cdn.example.com"
      refute log =~ @b

      assert [%FeedMedia{status: "failed", failure_reason: "not_found"} = m] = media(feed)
      assert [%{"image" => @b} = entry] = entries(feed)
      refute Map.has_key?(entry, "image_original")

      FakeClient.stub(@b, FakeClient.ok(png, []))
      assert {:ok, %FeedMedia{}} = Media.retry(feed, m.id)
      assert [%FeedMedia{status: "ready"}] = media(feed)
      assert [%{"image_original" => @b}] = entries(feed)

      assert Media.retry(feed, m.id) == {:error, :not_found}
      assert Media.retry(feed, "nope") == {:error, :not_found}
    end

    test "rejects content that is not an image or a video", %{feed: feed} do
      FakeClient.stub(@b, FakeClient.ok("<html>login</html>", [{"Content-Type", "text/html"}]))

      capture_log(fn -> Feeds.append_entries(feed, [%{"image" => @b}]) end)
      assert [%FeedMedia{status: "failed", failure_reason: "unsupported_type"}] = media(feed)
    end

    test "rejects files above the size limit", %{feed: feed} do
      previous = Application.get_env(:castmill, Media)
      Application.put_env(:castmill, Media, max_file_bytes: 10)
      on_exit(fn -> Application.put_env(:castmill, Media, previous || []) end)

      capture_log(fn -> Feeds.append_entries(feed, [%{"image" => @a}]) end)
      assert [%FeedMedia{status: "failed", failure_reason: "too_large"}] = media(feed)
      assert Media.max_file_bytes(feed.organization_id) == 10
    end

    test "applies the organization's upload limit", %{organization: organization} do
      Castmill.Quotas.add_quota_to_organization(organization.id, :max_upload_size, 1)
      assert Media.max_file_bytes(organization.id) == 1024 * 1024
    end

    test "fails when the storage quota is used up", %{organization: organization, feed: feed} do
      Repo.update_all(
        from(q in Castmill.Quotas.QuotasOrganizations,
          where: q.organization_id == ^organization.id and q.resource == :storage
        ),
        set: [max: 0]
      )

      capture_log(fn -> Feeds.append_entries(feed, [%{"image" => @a}]) end)
      assert [%FeedMedia{status: "failed", failure_reason: "quota_exceeded"}] = media(feed)
      assert Storage.files() == %{}
    end

    test "fails when storing fails", %{feed: feed} do
      Storage.fail(:unavailable)
      capture_log(fn -> Feeds.append_entries(feed, [%{"image" => @a}]) end)
      assert [%FeedMedia{status: "failed", failure_reason: "storage_failed"}] = media(feed)
    end

    test "retries transient errors until the last attempt", %{feed: feed} do
      FakeClient.stub(@b, {:ok, %{status_code: 503, headers: [], body: ""}})
      capture_log(fn -> Feeds.append_entries(feed, [%{"image" => @b}]) end)
      [m] = media(feed)

      Repo.update_all(from(x in FeedMedia, where: x.id == ^m.id),
        set: [status: "pending", failure_reason: nil]
      )

      job = BullMQ.Job.new("feed_media", "download", %{"media_id" => m.id}, attempts: 4)
      assert FeedMediaDownloader.process(job) == {:error, :server_error}
      assert [%FeedMedia{status: "pending"}] = media(feed)

      capture_log(fn ->
        assert FeedMediaDownloader.process(%{job | attempts_made: 3}) == :ok
      end)

      assert [%FeedMedia{status: "failed", failure_reason: "server_error"}] = media(feed)
    end

    test "ignores media that are no longer pending" do
      assert Media.download(Ecto.UUID.generate()) == :ok
    end
  end

  describe "lifecycle" do
    test "deletes media when entries leave the keep window", %{feed: feed, png: png} do
      FakeClient.stub(@b, FakeClient.ok(png <> "x", []))
      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "1", "image" => @a}])
      [%{storage_key: key}] = media(feed)

      {:ok, _} = Feeds.append_entries(feed, [%{"title" => "2"}, %{"title" => "3", "image" => @b}])

      assert_received {:feed_media_deleted, ^key}
      assert [%FeedMedia{original_url: @b}] = media(feed)
    end

    test "replacing an entry by external id releases its old media", %{feed: feed, png: png} do
      FakeClient.stub(@b, FakeClient.ok(png <> "x", []))
      {:ok, _} = Feeds.append_entries(feed, [%{"external_id" => "p1", "image" => @a}])
      {:ok, _} = Feeds.append_entries(feed, [%{"external_id" => "p1", "image" => @b}])

      assert [%FeedMedia{original_url: @b}] = media(feed)
      assert [%{"image_original" => @b}] = entries(feed)
    end

    test "restores originals when a media field stops being copied", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])
      [%{storage_key: key}] = media(feed)

      {:ok, updated} =
        Feeds.update_feed(feed, %{media_fields: [%{"path" => "image", "mode" => "link"}]})

      assert updated.version == 4
      assert [%{"image" => @a} = entry] = entries(feed)
      refute Map.has_key?(entry, "image_original")
      assert media(feed) == []
      assert_received {:feed_media_deleted, ^key}

      # Copying again reuses nothing and downloads again.
      {:ok, _} = Feeds.update_feed(updated, %{media_fields: [%{"path" => "image"}]})
      assert [%{"image_original" => @a}] = entries(feed)
    end

    test "deleting a feed deletes its files", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])
      [%{storage_key: key, id: id}] = media(feed)

      {:ok, _} = Feeds.delete_feed(feed)
      assert_received {:feed_media_deleted, ^key}
      assert Repo.get(FeedMedia, id) == nil
    end

    test "a media referenced again before its purge keeps its file", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])
      [m] = media(feed)
      Repo.update_all(from(x in FeedMedia, where: x.id == ^m.id), set: [status: "deleting"])

      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])
      assert [%FeedMedia{status: "ready", id: id}] = media(feed)
      assert id == m.id
      assert [_] = downloads()

      # A failed one stays failed; one without a result is downloaded again.
      Repo.update_all(from(x in FeedMedia, where: x.id == ^m.id),
        set: [status: "deleting", storage_key: nil, failure_reason: "not_found"]
      )

      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])
      assert [%FeedMedia{status: "failed"}] = media(feed)

      Repo.update_all(from(x in FeedMedia, where: x.id == ^m.id),
        set: [status: "deleting", failure_reason: nil]
      )

      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])
      assert [%FeedMedia{status: "ready"}] = media(feed)
    end

    test "the daily cleanup purges leftovers and re-queues lost downloads", %{feed: feed} do
      capture_log(fn ->
        {:ok, _} =
          Feeds.append_entries(feed, [%{"image" => @a}, %{"image" => @b, "title" => "x"}])
      end)

      [ready] = Enum.filter(media(feed), &(&1.status == "ready"))

      old = DateTime.add(DateTime.utc_now(), -2, :hour)

      Repo.update_all(from(x in FeedMedia, where: x.id == ^ready.id), set: [status: "deleting"])

      Repo.update_all(from(x in FeedMedia, where: x.original_url == ^@b),
        set: [status: "pending", updated_at: old]
      )

      orphan =
        Repo.insert!(%FeedMedia{
          organization_id: feed.organization_id,
          original_url: "https://x.test/o.png",
          url_hash: "o",
          status: "ready",
          storage_key: "orphan-key"
        })

      capture_log(fn ->
        assert FeedMediaCleanup.process(BullMQ.Job.new("maintenance", "feed_media_cleanup", %{})) ==
                 :ok
      end)

      assert_received {:feed_media_deleted, "orphan-key"}
      assert Repo.get(FeedMedia, orphan.id) == nil
      assert Repo.get(FeedMedia, ready.id) == nil
      # The re-queued download ran inline (and failed: no stub for @b).
      assert [%FeedMedia{original_url: @b, status: "failed"}] = media(feed)
      assert {:ok, _} = FeedMediaCleanup.ensure_scheduled()
    end

    test "logs storage errors when deleting files", %{feed: feed} do
      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])
      Storage.fail(:unavailable)
      assert capture_log(fn -> Feeds.clear(feed) end) =~ "Deleting"
    end
  end

  describe "reads" do
    test "lists media with entry counts and counts storage", %{
      organization: organization,
      feed: feed,
      png: png
    } do
      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}, %{"image" => @a, "title" => "2"}])

      assert [item] = Media.list_media(feed)
      assert item.original_host == "cdn.example.com"
      assert item.entries == 2
      assert item.status == "ready"
      refute Map.has_key?(item, :original_url)

      assert Media.storage_used(organization.id) == byte_size(png)

      assert Castmill.Quotas.get_quota_used_for_organization(organization.id, :storage) ==
               byte_size(png)
    end
  end

  describe "videos" do
    test "reads video metadata with ffprobe", %{feed: feed} do
      previous = Application.get_env(:castmill, :system_cmd)
      Application.put_env(:castmill, :system_cmd, Castmill.Workers.SystemCmdMock)

      on_exit(fn ->
        if previous,
          do: Application.put_env(:castmill, :system_cmd, previous),
          else: Application.delete_env(:castmill, :system_cmd)
      end)

      expect(Castmill.Workers.SystemCmdMock, :cmd, fn "ffprobe", _args, _opts ->
        {~s({"streams":[{"width":1280,"height":720}],"format":{"duration":"12.5"}}), 0}
      end)

      FakeClient.stub(
        @b,
        FakeClient.ok(<<0, 0, 0, 0x18, "ftypisom", 0, 0>>, [{"Content-Type", "video/mp4"}])
      )

      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @b}])

      assert [%FeedMedia{status: "ready", content_type: "video/mp4"} = m] = media(feed)
      assert {m.width, m.height, m.duration} == {1280, 720, 12.5}

      expect(Castmill.Workers.SystemCmdMock, :cmd, fn "ffprobe", _args, _opts -> {"", 1} end)
      FakeClient.stub(@a, FakeClient.ok(<<0x1A, 0x45, 0xDF, 0xA3, 1>>, []))
      {:ok, _} = Feeds.append_entries(feed, [%{"image" => @a}])

      assert %FeedMedia{status: "ready", duration: nil} =
               Enum.find(media(feed), &(&1.original_url == @a))
    end
  end

  describe "default storage" do
    test "stores and deletes files in the local media directory" do
      key = "test-#{Ecto.UUID.generate()}/feeds/f/m.png"
      path = Path.join([Castmill.Workers.Helpers.static_dir(), "medias", key])
      on_exit(fn -> File.rm_rf!(Path.dirname(Path.dirname(Path.dirname(path)))) end)

      Application.delete_env(:castmill, :feed_media_storage)

      assert {:ok, url} = Castmill.Feeds.MediaStorage.put(key, "data", "image/png")
      assert String.ends_with?(url, "/medias/" <> key)
      assert File.read!(path) == "data"

      assert Castmill.Feeds.MediaStorage.delete(key) == :ok
      refute File.exists?(path)
      assert Castmill.Feeds.MediaStorage.delete(key) == :ok
    end
  end

  defmodule FakeAws do
    @moduledoc false
    def request(method, url, _body, _headers, _opts) do
      send(self(), {:aws, method, URI.parse(url).path})

      case Process.get(:aws_status, 200) do
        200 -> {:ok, %{status_code: 200, headers: [], body: ""}}
        status -> {:ok, %{status_code: status, headers: [], body: "<Error/>"}}
      end
    end
  end

  describe "S3 storage" do
    setup do
      previous = %{
        storage: Application.get_env(:castmill, :file_storage),
        client: Application.get_env(:ex_aws, :http_client),
        s3: Application.get_env(:ex_aws, :s3),
        bucket: System.get_env("AWS_S3_BUCKET")
      }

      Application.delete_env(:castmill, :feed_media_storage)
      Application.put_env(:castmill, :file_storage, :s3)
      Application.put_env(:ex_aws, :http_client, FakeAws)

      Application.put_env(
        :ex_aws,
        :s3,
        Keyword.merge(previous.s3 || [], access_key_id: "test", secret_access_key: "test")
      )

      System.put_env("AWS_S3_BUCKET", "media-bucket")

      on_exit(fn ->
        Application.put_env(:castmill, :file_storage, previous.storage)
        restore(:ex_aws, :http_client, previous.client)
        restore(:ex_aws, :s3, previous.s3)

        if previous.bucket,
          do: System.put_env("AWS_S3_BUCKET", previous.bucket),
          else: System.delete_env("AWS_S3_BUCKET")
      end)
    end

    defp restore(app, key, nil), do: Application.delete_env(app, key)
    defp restore(app, key, value), do: Application.put_env(app, key, value)

    test "puts and deletes objects in the media bucket" do
      key = "org/feeds/f/m.png"

      assert {:ok, url} = Castmill.Feeds.MediaStorage.put(key, "data", "image/png")
      assert url =~ "media-bucket/" <> key
      assert_received {:aws, :put, "/media-bucket/" <> ^key}

      assert Castmill.Feeds.MediaStorage.delete(key) == :ok
      assert_received {:aws, :delete, "/media-bucket/" <> ^key}

      Process.put(:aws_status, 403)
      assert {:error, _} = Castmill.Feeds.MediaStorage.put(key, "data", "image/png")
      assert {:error, _} = Castmill.Feeds.MediaStorage.delete(key)
    end
  end
end
