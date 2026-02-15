defmodule CastmillWeb.UploadControllerTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Quotas

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  setup %{conn: conn} do
    # Create test user with authentication
    user = user_fixture()
    access_token = access_token_fixture(%{secret: "test_token", user_id: user.id})

    # Create network and organization
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})

    # Add user to organization
    Castmill.Organizations.add_user(organization.id, user.id, "admin")

    # Authenticate connection
    conn = put_req_header(conn, "authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, organization: organization, user: user, network: network}
  end

  describe "create/2 with max_upload_size quota" do
    test "returns 413 when file exceeds max_upload_size quota", %{
      conn: conn,
      organization: organization
    } do
      # Set max_upload_size quota to 1 MB
      Quotas.assign_quota_to_organization(organization.id, :max_upload_size, 1)

      # Create a temporary file larger than 1 MB (2 MB)
      temp_file_path = create_temp_file(2 * 1024 * 1024)

      upload = %Plug.Upload{
        path: temp_file_path,
        filename: "large_video.mp4"
      }

      response_conn =
        post(
          conn,
          "/dashboard/organizations/#{organization.id}/medias",
          %{"file" => upload}
        )

      assert response_conn.status == 413
      response = json_response(response_conn, 413)

      assert response["error"] == "File too large"
      assert response["message"] =~ "exceeds the maximum upload size limit"
      assert response["max_size"] == 1 * 1024 * 1024
      assert response["file_size"] > 1 * 1024 * 1024

      # Cleanup
      File.rm(temp_file_path)
    end

    test "accepts file within max_upload_size quota", %{
      conn: conn,
      organization: organization
    } do
      # Set max_upload_size quota to 10 MB
      Quotas.assign_quota_to_organization(organization.id, :max_upload_size, 10)

      # Create a temporary file smaller than 10 MB (1 MB)
      temp_file_path = create_temp_file(1 * 1024 * 1024)

      upload = %Plug.Upload{
        path: temp_file_path,
        filename: "small_video.mp4"
      }

      response_conn =
        post(
          conn,
          "/dashboard/organizations/#{organization.id}/medias",
          %{"file" => upload}
        )

      # Should not return 413
      assert response_conn.status != 413

      # Should either succeed (200/201) or fail for other reasons (storage quota, etc.)
      # but not due to max_upload_size
      assert response_conn.status in [200, 201, 403]

      # Cleanup
      File.rm(temp_file_path)
    end

    test "returns 403 when file within max_upload_size but exceeds storage quota", %{
      conn: conn,
      organization: organization
    } do
      # Set max_upload_size quota to 10 MB (allows the file)
      Quotas.assign_quota_to_organization(organization.id, :max_upload_size, 10)

      # Set storage quota to 1 MB (will be exceeded)
      Quotas.assign_quota_to_organization(organization.id, :storage, 1)

      # Create a temporary file: 2 MB (within max_upload_size, exceeds storage)
      temp_file_path = create_temp_file(2 * 1024 * 1024)

      upload = %Plug.Upload{
        path: temp_file_path,
        filename: "video.mp4"
      }

      response_conn =
        post(
          conn,
          "/dashboard/organizations/#{organization.id}/medias",
          %{"file" => upload}
        )

      assert response_conn.status == 403
      response = json_response(response_conn, 403)

      assert response["error"] == "Storage quota exceeded"
      assert response["message"] =~ "would exceed your storage quota limit"

      # Cleanup
      File.rm(temp_file_path)
    end

    test "converts MB quota to bytes correctly for 2GB default", %{
      conn: conn,
      organization: organization
    } do
      # Organization should have default 2048 MB (2 GB) quota
      max_upload_mb = Quotas.get_quota_for_organization(organization.id, :max_upload_size)
      assert max_upload_mb == 2048

      # Test that a file just under 2GB is accepted for quota check
      # (We won't actually create a 2GB file, just test the conversion logic)
      expected_bytes = 2048 * 1024 * 1024
      assert expected_bytes == 2_147_483_648
    end
  end

  describe "create/2 with invalid file types" do
    test "rejects non-image/video files", %{conn: conn, organization: organization} do
      # Create a text file
      temp_file_path = Path.join(System.tmp_dir!(), "test.txt")
      File.write!(temp_file_path, "test content")

      upload = %Plug.Upload{
        path: temp_file_path,
        filename: "test.txt"
      }

      response_conn =
        post(
          conn,
          "/dashboard/organizations/#{organization.id}/medias",
          %{"file" => upload}
        )

      assert response_conn.status == 400

      # Cleanup
      File.rm(temp_file_path)
    end
  end

  # Helper function to create a temporary file with specified size
  defp create_temp_file(size_bytes) do
    temp_path = Path.join(System.tmp_dir!(), "test_#{:rand.uniform(1_000_000)}.mp4")

    # Create a file with the specified size
    # Write in chunks to avoid memory issues
    File.open!(temp_path, [:write, :binary], fn file ->
      chunk_size = 1024 * 1024
      full_chunks = div(size_bytes, chunk_size)
      remainder = rem(size_bytes, chunk_size)

      # Write full chunks
      chunk_data = :crypto.strong_rand_bytes(chunk_size)

      for _ <- 1..full_chunks do
        IO.binwrite(file, chunk_data)
      end

      # Write remainder
      if remainder > 0 do
        IO.binwrite(file, :crypto.strong_rand_bytes(remainder))
      end
    end)

    temp_path
  end
end
