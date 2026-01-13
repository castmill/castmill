defmodule CastmillWeb.UploadController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias ExAws.S3
  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  # 5 MB
  @chunk_size 5 * 1024 * 1024

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, :create, %{"organization_id" => organization_id}) do
    if Organizations.has_access(organization_id, actor_id, "medias", :create) do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  def check_access(_actor_id, _action, _params) do
    {:ok, false}
  end

  plug(AuthorizeDash)

  def create(conn, %{
        "organization_id" => organization_id,
        "file" => %Plug.Upload{filename: filename, path: path}
      }) do
    case FileType.from_path(path) do
      {:ok, {_extension, mime_type}} ->
        # Only allows images (all formats) and videos (all formats). Matches using globs, for example "image/*" or "video/*"
        if matches?(mime_type, ["image/*", "video/*", "application/vnd.ms-asf"]) do
          process_file(conn, organization_id, filename, path, mime_type)
        else
          conn
          |> put_status(:bad_request)
          |> json(%{
            error: "Invalid file type",
            message: "Only images and videos are allowed"
          })
          |> halt()
        end

      # Continue processing if the file type is correct
      # You would place your logic here to handle the file upload as expected

      {:error, :unrecognized} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          error: "Unrecognized file type",
          message: "The file type could not be determined"
        })
        |> halt()
    end
  end

  defp process_file(conn, organization_id, filename, path, mime_type) do
    # Check storage quota before uploading
    file_size = File.stat!(path).size
    current_storage = Castmill.Quotas.get_quota_used_for_organization(organization_id, :storage)
    storage_quota = Castmill.Quotas.get_quota_for_organization(organization_id, "storage")

    if current_storage + file_size > storage_quota do
      conn
      |> put_status(:forbidden)
      |> json(%{
        error: "Storage quota exceeded",
        message: "Uploading this file would exceed your storage quota limit"
      })
      |> halt()
    else
      case upload_file(path, filename) do
        {:ok, destpath} ->
          # Extract the name from the filename without extension
          name = Path.basename(filename, Path.extname(filename))

          # Create media with the extracted mime_type - check media count quota
          case Castmill.Resources.create_media(%{
                 organization_id: organization_id,
                 status: :uploading,
                 name: name,
                 path: filename,
                 mimetype: mime_type
               }) do
            {:ok, media} ->
              # Proceed with transcoding and job queuing
              case queue_transcoding_job(media, destpath, mime_type) do
                :ok ->
                  # Return successful response
                  conn
                  |> put_status(:ok)
                  |> json(media)

                :unsupported_mime_type ->
                  conn
                  |> put_status(:bad_request)
                  |> json(%{
                    error: "Unsupported MIME type",
                    message: "The MIME type is not supported"
                  })
                  |> halt()
              end

            {:error, :quota_exceeded} ->
              conn
              |> put_status(:forbidden)
              |> json(%{
                error: "Media quota exceeded",
                message: "You have reached your media quota limit"
              })
              |> halt()

            {:error, _changeset} ->
              conn
              |> put_status(:bad_request)
              |> json(%{
                error: "Failed to create media",
                message: "An error occurred while creating the media"
              })
              |> halt()
          end

        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "File upload failed", reason: inspect(reason)})
      end
    end
  end

  defp queue_transcoding_job(media, destpath, mime_type) do
    cond do
      String.starts_with?(mime_type, "image/") ->
        Castmill.Workers.ImageTranscoder.schedule(media, destpath, mime_type)
        :ok

      ## Either starts with video or is an ASF file ( "application/vnd.ms-asf" )
      String.starts_with?(mime_type, "video/") or mime_type == "application/vnd.ms-asf" ->
        Castmill.Workers.VideoTranscoder.schedule(media, destpath, mime_type)
        :ok

      true ->
        # Return an atom to indicate unsupported MIME type
        :unsupported_mime_type
    end
  end

  defp upload_file(path, filename) do
    case Application.get_env(:castmill, :file_storage) do
      :local ->
        upload_to_local(path, get_temp_file())

      :s3 ->
        upload_to_s3(path, filename, System.get_env("AWS_S3_TMP_BUCKET"))
    end
  end

  defp upload_to_local(path, local_path) do
    case File.cp(path, local_path) do
      :ok -> {:ok, "file://#{local_path}"}
      {:error, reason} -> {:error, reason}
    end
  end

  defp upload_to_s3(path, filename, bucket_name) do
    case File.stream!(path, [], @chunk_size)
         |> S3.upload(bucket_name, filename)
         |> ExAws.request() do
      {:ok, _response} ->
        # Return a success message with the S3 path
        {:ok, "s3://#{bucket_name}/#{filename}"}

      {:error, reason} ->
        # Return the error as-is
        {:error, reason}
    end
  end

  def matches?(mime_type, patterns) do
    patterns
    |> Enum.map(&glob_to_regex/1)
    |> Enum.any?(fn regex ->
      Regex.match?(regex, mime_type)
    end)
  end

  defp glob_to_regex(pattern) do
    pattern
    |> String.replace(".", "\\.")
    |> String.replace("*", ".*")
    |> then(&Regex.compile!("^" <> &1 <> "$"))
  end

  defp get_temp_file() do
    temp_dir = System.tmp_dir!()
    file_name = UUID.uuid4() <> ".tmp"
    Path.join(temp_dir, file_name)
  end
end
