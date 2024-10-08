defmodule CastmillWeb.UploadController do
  use CastmillWeb, :controller
  alias ExAws.S3

  # 5 MB
  @chunk_size 5 * 1024 * 1024

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
    case upload_file(path, filename) do
      {:ok, destpath} ->
        # Extract the name from the filename without extension
        name = Path.basename(filename, Path.extname(filename))

        # Create media with the extracted mime_type
        {:ok, media} =
          Castmill.Resources.create_media(%{
            organization_id: organization_id,
            status: :uploading,
            name: name,
            path: filename,
            mimetype: mime_type
          })

        # Proceed with transcoding and job queuing
        case queue_transcoding_job(media, destpath, mime_type) do
          :ok ->
            :ok

          :unsupported_mime_type ->
            conn
            |> put_status(:bad_request)
            |> json(%{
              error: "Unsupported MIME type",
              message: "The MIME type is not supported"
            })
            |> halt()
        end

        # Return successful response
        conn
        |> put_status(:ok)
        |> json(media)

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "File upload failed", reason: inspect(reason)})
    end
  end

  defp queue_transcoding_job(media, destpath, mime_type) do
    job_args = %{media: media, filepath: destpath, mime_type: mime_type}

    cond do
      String.starts_with?(mime_type, "image/") ->
        job_args
        |> Castmill.Workers.ImageTranscoder.new()
        |> Oban.insert()

        :ok

      ## Either starts with video or is an ASF file ( "application/vnd.ms-asf" )
      String.starts_with?(mime_type, "video/") or mime_type == "application/vnd.ms-asf" ->
        job_args
        |> Castmill.Workers.VideoTranscoder.new()
        |> Oban.insert()

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
