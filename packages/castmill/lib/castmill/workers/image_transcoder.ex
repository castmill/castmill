defmodule Castmill.Workers.ImageTranscoder do
  use Oban.Worker, queue: :image_transcoder
  alias Castmill.Repo

  @file_sizes_and_contexts [
    {128, "thumbnail"},
    {640, "preview"},
    {1920, "poster"}
  ]

  @impl Oban.Worker
  def perform(%Oban.Job{args: args} = job) do
    dbg(job)

    # Repo.transaction(fn ->
    media = args["media"]
    organization_id = media["organization_id"]
    media_id = media["id"]

    # Start by setting media status to transcoding
    {:ok, _media} =
      Castmill.Resources.update_media(%Castmill.Resources.Media{id: media_id}, %{
        status: :transcoding,
        status_message: "0"
      })

    # Can be a local file or a remote file, depending on the protocol, for example file:// or https://
    filepath = args["filepath"]

    # For every media we need to create several files, a thumbnail, a preview, and a poster. And we need to upload every image to S3 as well
    # We will use the Image library. We must start by creating a new file stream
    {:ok, stream} = stream_from_filepath(filepath)

    # Iterate through the file sizes and names
    Repo.transaction(fn ->
      {_final_progress, files_map, new_size} =
        Enum.reduce(@file_sizes_and_contexts, {0.0, %{}, 0}, fn {size, context},
                                                                {acc_progress, acc_map, acc_size} ->
          {uri, size} =
            Image.open!(stream)
            |> Image.thumbnail!(size)
            |> upload_image(organization_id, media_id, "#{context}.jpg")

          {:ok, file} =
            Castmill.Files.create_file(%{
              media_id: media_id,
              name: "#{media_id}-#{context}",
              uri: uri,
              size: size,
              organization_id: organization_id,
              mimetype: "image/jpeg"
            })

          Castmill.Files.add_file_to_media(file.id, media_id, context)

          new_progress = Float.floor(acc_progress + 100 / length(@file_sizes_and_contexts))

          # Update media status and broadcast progress
          {:ok, _media} =
            Castmill.Resources.update_media(%Castmill.Resources.Media{id: media_id}, %{
              status: :transcoding,
              status_message: "#{new_progress}"
            })

          Phoenix.PubSub.broadcast(Castmill.PubSub, "resource:media:#{media_id}", %{
            status_message: "#{new_progress}"
          })

          new_map = Map.put(acc_map, context, file)
          new_size = size + acc_size

          {new_progress, new_map, new_size}
        end)

      # Finalize by setting media status to ready
      {:ok, _media} =
        Castmill.Resources.update_media(%Castmill.Resources.Media{id: media_id}, %{
          status: :ready,
          status_message: "100"
        })

      # Send a message to the medias observer channel to notify the user about the media progress
      Phoenix.PubSub.broadcast(Castmill.PubSub, "resource:media:#{media_id}", %{
        status: :ready,
        status_message: "100",
        files: files_map,
        size: new_size
      })
    end)
  end

  defp stream_from_filepath(filepath) do
    case URI.parse(filepath) do
      %URI{scheme: "file"} = uri ->
        {:ok, File.stream!(uri.path, [], 8192)}

      # Assume that https and http are for S3 files
      %URI{scheme: "https", path: path} = _uri ->
        {:ok, ExAws.S3.download_file("tmp-upload-files", path, :memory) |> ExAws.stream!()}

      %URI{scheme: "http", path: path} = _uri ->
        {:ok, ExAws.S3.download_file("tmp-upload-files", path, :memory) |> ExAws.stream!()}

      _ ->
        {:error, :invalid_protocol}
    end
  end

  # Upload to local directory or S3 depending on the configuration
  defp upload_image(image, organization_id, media_id, filename) do
    dst_path = "#{organization_id}/#{media_id}"

    case Application.get_env(:castmill, :file_storage) do
      :local ->
        dest_dir = Path.join([static_dir(), "uploads", dst_path])
        File.mkdir_p!(dest_dir)

        dst_file = Path.join(dest_dir, filename)

        image
        |> Image.write!(dst_file)

        %{size: size} = File.stat!(dst_file)

        dbg(size)

        # TODO: This uri is not really correct as it should include a confifurable host!
        {"http://localhost:4000/#{Path.join(["uploads", dst_path, filename])}", size}

      :s3 ->
        image
        |> Image.stream!(suffix: ".jpg", buffer_size: 5_242_880)
        |> ExAws.S3.upload("medias", Path.join(dst_path, filename))
        |> ExAws.request()

        "https://castmill-medias.s3.amazonaws.com/#{dst_path}/#{filename}"
    end
  end

  defp static_dir do
    priv_dir = :code.priv_dir(:castmill) |> to_string()
    dbg(priv_dir)
    Path.join(priv_dir, "static")
  end
end
