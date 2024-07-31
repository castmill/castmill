defmodule CastmillWeb.UploadController do
  use CastmillWeb, :controller
  alias ExAws.S3

  @chunk_size 8192

  def create(conn, %{
        "organization_id" => organization_id,
        "file" => %Plug.Upload{filename: filename, path: path}
      }) do
    {:ok, {_extension, mime_type}} = FileType.from_path(path)

    # Only allows images (all formats) and videos (all formats). Matches using globs, for example "image/*" or "video/*"
    unless matches?(mime_type, ["image/*", "video/*"]) do
      conn
      |> put_status(:bad_request)
      |> json(%{error: "Invalid file type", message: "Only images and videos are allowed"})
    end

    case upload_file(path, filename) do
      {:ok, destpath} ->
        # The media file has been uploaded successfully. Now we need to insert a media record in the database.
        # with status "uploaded", and the file path including protocol (for local file it would be file://filepath)
        # Extract name from the filename without extension
        name = Path.basename(filename, Path.extname(filename))

        {:ok, media} =
          Castmill.Resources.create_media(%{
            organization_id: organization_id,
            status: :uploading,
            name: name,
            path: filename,
            mimetype: mime_type
          })

        %{
          media: media,
          filepath: destpath
        }
        |> Castmill.Workers.ImageTranscoder.new()
        |> Oban.insert()

        conn
        |> put_status(:ok)
        |> json(media)

      {:error, reason} ->
        IO.inspect(reason)

        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "File upload failed", reason: inspect(reason)})
    end
  end

  defp upload_file(path, filename) do
    case Application.get_env(:castmill, :file_storage) do
      :local ->
        upload_to_local(path, get_temp_file())

      :s3 ->
        upload_to_s3(path, filename, "CHANGE_ME_TO_TMP_MEDIAS_BUCKET_NAME")
    end
  end

  defp upload_to_local(path, local_path) do
    case File.cp(path, local_path) do
      :ok -> {:ok, "file://#{local_path}"}
      {:error, reason} -> {:error, reason}
    end
  end

  defp upload_to_s3(path, filename, bucket_name) do
    File.stream!(path, [], @chunk_size)
    |> S3.upload(bucket_name, filename)
    |> ExAws.request()
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
