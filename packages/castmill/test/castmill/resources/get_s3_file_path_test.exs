defmodule Castmill.Resources.GetS3FilePathTest do
  use ExUnit.Case, async: false

  alias Castmill.Resources

  # ---------------------------------------------------------------------------
  # get_s3_file_path/1 — local dev mode (no :media_public_base_url)
  # ---------------------------------------------------------------------------

  describe "get_s3_file_path/1 without :media_public_base_url (local dev)" do
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

    test "extracts bucket from first path segment (MinIO-style URL)" do
      uri = "http://localhost:9000/my-bucket/org123/media456/file.jpg"

      {bucket, object_path} = Resources.get_s3_file_path(uri)

      assert bucket == "my-bucket"
      assert object_path == "org123/media456/file.jpg"
    end

    test "handles S3-style URIs with port in host" do
      uri = "https://s3.amazonaws.com:443/castmill-media/org/media/thumb.png"

      {bucket, object_path} = Resources.get_s3_file_path(uri)

      assert bucket == "castmill-media"
      assert object_path == "org/media/thumb.png"
    end

    test "preserves deeply nested object paths" do
      uri = "http://localhost:9000/data/org/123/media/456/transcoded/preview.jpg"

      {bucket, object_path} = Resources.get_s3_file_path(uri)

      assert bucket == "data"
      assert object_path == "org/123/media/456/transcoded/preview.jpg"
    end

    test "handles R2 API endpoint URLs" do
      uri = "https://abc123.r2.cloudflarestorage.com:443/castmill-media-stage/org/media/file.mp4"

      {bucket, object_path} = Resources.get_s3_file_path(uri)

      assert bucket == "castmill-media-stage"
      assert object_path == "org/media/file.mp4"
    end
  end

  # ---------------------------------------------------------------------------
  # get_s3_file_path/1 — production mode (with :media_public_base_url)
  # ---------------------------------------------------------------------------

  describe "get_s3_file_path/1 with :media_public_base_url (production CDN)" do
    setup do
      previous_base = Application.get_env(:castmill, :media_public_base_url)
      previous_env = System.get_env("AWS_S3_BUCKET")

      Application.put_env(:castmill, :media_public_base_url, "https://cdn.castmill.dev")
      System.put_env("AWS_S3_BUCKET", "castmill-media-stage")

      on_exit(fn ->
        if previous_base do
          Application.put_env(:castmill, :media_public_base_url, previous_base)
        else
          Application.delete_env(:castmill, :media_public_base_url)
        end

        if previous_env do
          System.put_env("AWS_S3_BUCKET", previous_env)
        else
          System.delete_env("AWS_S3_BUCKET")
        end
      end)

      :ok
    end

    test "uses AWS_S3_BUCKET env var as bucket name" do
      uri = "https://cdn.castmill.dev/org123/media456/file.jpg"

      {bucket, _object_path} = Resources.get_s3_file_path(uri)

      assert bucket == "castmill-media-stage"
    end

    test "uses full path as object key (no bucket in path)" do
      uri = "https://cdn.castmill.dev/org123/media456/file.jpg"

      {_bucket, object_path} = Resources.get_s3_file_path(uri)

      assert object_path == "org123/media456/file.jpg"
    end

    test "strips leading slash from object path" do
      uri = "https://cdn.castmill.dev/org/media/transcoded/preview.jpg"

      {_bucket, object_path} = Resources.get_s3_file_path(uri)

      refute String.starts_with?(object_path, "/")
      assert object_path == "org/media/transcoded/preview.jpg"
    end

    test "handles deeply nested paths" do
      uri = "https://cdn.castmill.dev/org/123/media/456/thumbnail.jpg"

      {bucket, object_path} = Resources.get_s3_file_path(uri)

      assert bucket == "castmill-media-stage"
      assert object_path == "org/123/media/456/thumbnail.jpg"
    end

    test "ignores CDN hostname — bucket always from env var" do
      uri_cdn = "https://cdn.castmill.dev/org/media/file.mp4"
      uri_other = "https://other.example.com/org/media/file.mp4"

      {bucket_cdn, path_cdn} = Resources.get_s3_file_path(uri_cdn)
      {bucket_other, path_other} = Resources.get_s3_file_path(uri_other)

      assert bucket_cdn == bucket_other
      assert path_cdn == path_other
    end
  end
end
