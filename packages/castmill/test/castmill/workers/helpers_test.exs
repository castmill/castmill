defmodule Castmill.Workers.HelpersTest do
  use ExUnit.Case, async: false

  alias Castmill.Workers.Helpers

  # ---------------------------------------------------------------------------
  # get_s3_uri/2
  # ---------------------------------------------------------------------------

  describe "get_s3_uri/2" do
    test "generates URI from ExAws :s3 config" do
      uri = Helpers.get_s3_uri("my-bucket", "org/media/preview.jpg")

      # Verify the URI contains the bucket and object path
      assert uri =~ "my-bucket/org/media/preview.jpg"
      assert String.starts_with?(uri, "http")
    end

    test "includes bucket as first path segment" do
      uri = Helpers.get_s3_uri("test-bucket", "123/456/thumb.jpg")

      parsed = URI.parse(uri)
      assert parsed.path =~ ~r{^/test-bucket/123/456/thumb\.jpg$}
    end
  end

  # ---------------------------------------------------------------------------
  # get_public_uri/2 — fallback mode (no :media_public_base_url)
  # ---------------------------------------------------------------------------

  describe "get_public_uri/2 without :media_public_base_url" do
    setup do
      previous = Application.get_env(:castmill, :media_public_base_url)
      Application.delete_env(:castmill, :media_public_base_url)

      on_exit(fn ->
        if previous do
          Application.put_env(:castmill, :media_public_base_url, previous)
        else
          Application.delete_env(:castmill, :media_public_base_url)
        end
      end)

      :ok
    end

    test "falls back to get_s3_uri when no base URL configured" do
      public = Helpers.get_public_uri("my-bucket", "org/media/preview.jpg")
      s3 = Helpers.get_s3_uri("my-bucket", "org/media/preview.jpg")

      assert public == s3
    end

    test "includes bucket in the path" do
      uri = Helpers.get_public_uri("castmill-media", "org123/media456/thumb.jpg")

      assert uri =~ "castmill-media/org123/media456/thumb.jpg"
    end
  end

  # ---------------------------------------------------------------------------
  # get_public_uri/2 — CDN mode (with :media_public_base_url)
  # ---------------------------------------------------------------------------

  describe "get_public_uri/2 with :media_public_base_url" do
    setup do
      previous = Application.get_env(:castmill, :media_public_base_url)

      on_exit(fn ->
        if previous do
          Application.put_env(:castmill, :media_public_base_url, previous)
        else
          Application.delete_env(:castmill, :media_public_base_url)
        end
      end)

      :ok
    end

    test "returns CDN URL without bucket in path" do
      Application.put_env(:castmill, :media_public_base_url, "https://cdn.castmill.dev")

      uri = Helpers.get_public_uri("castmill-media", "org123/media456/preview.jpg")

      assert uri == "https://cdn.castmill.dev/org123/media456/preview.jpg"
    end

    test "does not include bucket name in the CDN URL" do
      Application.put_env(:castmill, :media_public_base_url, "https://cdn.example.com")

      uri = Helpers.get_public_uri("my-bucket", "path/to/file.mp4")

      refute uri =~ "my-bucket"
      assert uri == "https://cdn.example.com/path/to/file.mp4"
    end

    test "trims trailing slash from base URL" do
      Application.put_env(:castmill, :media_public_base_url, "https://cdn.castmill.dev/")

      uri = Helpers.get_public_uri("bucket", "org/media/file.jpg")

      assert uri == "https://cdn.castmill.dev/org/media/file.jpg"
      # No double slash after the domain (scheme "://" is fine)
      refute String.contains?(uri, "dev//")
    end

    test "handles base URL without trailing slash" do
      Application.put_env(:castmill, :media_public_base_url, "https://cdn.castmill.dev")

      uri = Helpers.get_public_uri("bucket", "org/media/file.jpg")

      assert uri == "https://cdn.castmill.dev/org/media/file.jpg"
    end

    test "preserves nested object paths" do
      Application.put_env(:castmill, :media_public_base_url, "https://cdn.castmill.dev")

      uri = Helpers.get_public_uri("bucket", "org/123/media/456/thumbnail.jpg")

      assert uri == "https://cdn.castmill.dev/org/123/media/456/thumbnail.jpg"
    end

    test "bucket argument is ignored when CDN base URL is set" do
      Application.put_env(:castmill, :media_public_base_url, "https://cdn.castmill.dev")

      uri_a = Helpers.get_public_uri("bucket-a", "path/file.jpg")
      uri_b = Helpers.get_public_uri("bucket-b", "path/file.jpg")

      assert uri_a == uri_b
      assert uri_a == "https://cdn.castmill.dev/path/file.jpg"
    end
  end

  describe "get_media_base_url/0" do
    setup do
      previous = Application.get_env(:castmill, :media_public_base_url)

      on_exit(fn ->
        if previous do
          Application.put_env(:castmill, :media_public_base_url, previous)
        else
          Application.delete_env(:castmill, :media_public_base_url)
        end
      end)

      :ok
    end

    test "uses the configured public media origin" do
      Application.put_env(
        :castmill,
        :media_public_base_url,
        "http://192.168.68.57:4000/"
      )

      assert Helpers.get_media_base_url() == "http://192.168.68.57:4000"
    end

    test "falls back to the Phoenix endpoint URL" do
      Application.delete_env(:castmill, :media_public_base_url)

      assert Helpers.get_media_base_url() == Helpers.get_endpoint_url()
    end
  end

  describe "resolve_media_uri/2 with local storage" do
    setup do
      previous_storage = Application.get_env(:castmill, :file_storage)
      previous_base = Application.get_env(:castmill, :media_public_base_url)
      Application.put_env(:castmill, :file_storage, :local)

      on_exit(fn ->
        Application.put_env(:castmill, :file_storage, previous_storage)

        if previous_base do
          Application.put_env(:castmill, :media_public_base_url, previous_base)
        else
          Application.delete_env(:castmill, :media_public_base_url)
        end
      end)

      :ok
    end

    test "rebases previously stored local media on the current public origin" do
      Application.put_env(:castmill, :media_public_base_url, "http://192.168.1.5:4000/")
      stored = "http://localhost:4000/medias/org-1/media-2/preview.mp4"

      assert Helpers.resolve_media_uri(stored, "org-1") ==
               "http://192.168.1.5:4000/medias/org-1/media-2/preview.mp4"
    end

    test "replaces an old public base path rather than duplicating it" do
      Application.put_env(:castmill, :media_public_base_url, "https://new.example.com/media-root")
      stored = "https://old.example.com/old-root/medias/org-1/media-2/preview.mp4"

      assert Helpers.resolve_media_uri(stored, "org-1") ==
               "https://new.example.com/media-root/medias/org-1/media-2/preview.mp4"
    end

    test "uses the current endpoint when no public base is configured" do
      Application.delete_env(:castmill, :media_public_base_url)
      stored = "http://192.168.1.5:4000/medias/org-1/media-2/poster.mp4"

      assert Helpers.resolve_media_uri(stored, "org-1") ==
               "#{Helpers.get_endpoint_url()}/medias/org-1/media-2/poster.mp4"
    end

    test "does not change unrelated or other-organization URLs" do
      Application.put_env(:castmill, :media_public_base_url, "https://cdn.example.com")

      assert Helpers.resolve_media_uri("https://external.example.com/video.mp4", "org-1") ==
               "https://external.example.com/video.mp4"

      assert Helpers.resolve_media_uri("https://old/medias/org-2/media/file.mp4", "org-1") ==
               "https://old/medias/org-2/media/file.mp4"
    end
  end

  describe "resolve_media_uri/2 with S3 storage" do
    setup do
      previous_storage = Application.get_env(:castmill, :file_storage)
      previous_base = Application.get_env(:castmill, :media_public_base_url)
      previous_bucket = System.get_env("AWS_S3_BUCKET")
      Application.put_env(:castmill, :file_storage, :s3)
      System.put_env("AWS_S3_BUCKET", "my-bucket")

      on_exit(fn ->
        Application.put_env(:castmill, :file_storage, previous_storage)

        if previous_base do
          Application.put_env(:castmill, :media_public_base_url, previous_base)
        else
          Application.delete_env(:castmill, :media_public_base_url)
        end

        if previous_bucket do
          System.put_env("AWS_S3_BUCKET", previous_bucket)
        else
          System.delete_env("AWS_S3_BUCKET")
        end
      end)

      :ok
    end

    test "rebases both legacy CDN and bucket URLs without adding a bucket to CDN paths" do
      Application.put_env(:castmill, :media_public_base_url, "https://new.example.com/")

      for stored <- [
            "https://old.example.com/org-1/media-2/preview.mp4",
            "http://localhost:9000/my-bucket/org-1/media-2/preview.mp4"
          ] do
        assert Helpers.resolve_media_uri(stored, "org-1") ==
                 "https://new.example.com/org-1/media-2/preview.mp4"
      end
    end

    test "replaces an old CDN path prefix" do
      Application.put_env(:castmill, :media_public_base_url, "https://new.example.com/new-root")

      assert Helpers.resolve_media_uri(
               "https://old.example.com/old-root/org-1/media-2/preview.mp4",
               "org-1"
             ) == "https://new.example.com/new-root/org-1/media-2/preview.mp4"
    end

    test "uses the current S3 endpoint when no public base is configured" do
      Application.delete_env(:castmill, :media_public_base_url)
      stored = "https://old.example.com/org-1/media-2/poster.mp4"

      assert Helpers.resolve_media_uri(stored, "org-1") ==
               Helpers.get_s3_uri("my-bucket", "org-1/media-2/poster.mp4")
    end

    test "serializes a previously stored CDN URL using the current public base" do
      Application.put_env(:castmill, :media_public_base_url, "https://new.example.com")

      file = %Castmill.Files.File{
        organization_id: "org-1",
        uri: "https://old.example.com/org-1/media-2/preview.mp4"
      }

      assert Jason.encode!(file) |> Jason.decode!() |> Map.fetch!("uri") ==
               "https://new.example.com/org-1/media-2/preview.mp4"
    end
  end

  describe "media JSON responses" do
    setup do
      previous_storage = Application.get_env(:castmill, :file_storage)
      previous_base = Application.get_env(:castmill, :media_public_base_url)
      Application.put_env(:castmill, :file_storage, :local)
      Application.put_env(:castmill, :media_public_base_url, "http://192.168.1.5:4000")

      on_exit(fn ->
        Application.put_env(:castmill, :file_storage, previous_storage)

        if previous_base do
          Application.put_env(:castmill, :media_public_base_url, previous_base)
        else
          Application.delete_env(:castmill, :media_public_base_url)
        end
      end)

      :ok
    end

    test "renders the current URL in nested media, standalone file, and file API responses" do
      file = %Castmill.Files.File{
        organization_id: "org-1",
        uri: "http://old-host:4000/medias/org-1/media-2/preview.mp4",
        name: "preview",
        size: 10,
        mimetype: "video/mp4"
      }

      expected = "http://192.168.1.5:4000/medias/org-1/media-2/preview.mp4"

      media = %Castmill.Resources.Media{
        files_medias: [%Castmill.Files.FilesMedias{context: "preview", file: file}]
      }

      assert Jason.encode!(file) |> Jason.decode!() |> Map.fetch!("uri") == expected

      assert Jason.encode!(media) |> Jason.decode!() |> get_in(["files", "preview", "uri"]) ==
               expected

      assert CastmillWeb.ResourceJSON.show(%{media: media})
             |> Jason.encode!()
             |> Jason.decode!()
             |> get_in(["data", "files", "preview", "uri"]) == expected

      assert CastmillWeb.FileJSON.show(%{file: file}).data.uri == expected
      assert file.uri == "http://old-host:4000/medias/org-1/media-2/preview.mp4"
    end
  end
end
