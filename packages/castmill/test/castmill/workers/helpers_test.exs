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
end
