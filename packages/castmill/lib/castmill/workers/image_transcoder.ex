defmodule Castmill.Workers.ImageTranscoder do
  use Oban.Worker, queue: :image_transcoder
  alias Castmill.Repo
  alias Castmill.Workers.Helpers
  alias Castmill.Notifications.Events

  require Logger

  @file_sizes_and_contexts [
    {128, "thumbnail"},
    {640, "preview"},
    {1920, "poster"}
  ]

  @impl Oban.Worker
  def perform(%Oban.Job{args: args} = job) do
    dbg(job)

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

    extension =
      case args["mime_type"] do
        "image/png" -> ".png"
        _ -> ".jpg"
      end

    mimetype =
      if extension == ".png" do
        "image/png"
      else
        "image/jpeg"
      end

    # For every media we need to create several files, a thumbnail, a preview, and a poster. And we need to upload every image to S3 as well
    # We will use the Image library. We must start by creating a new file stream
    {:ok, stream} = Helpers.get_stream_from_uri(filepath)

    # Iterate through the file sizes and names
    Repo.transaction(fn ->
      {_final_progress, files_map, new_size} =
        Enum.reduce(@file_sizes_and_contexts, {0.0, %{}, 0}, fn {size, context},
                                                                {acc_progress, acc_map, acc_size} ->
          {uri, size} =
            Image.open!(stream)
            |> Image.thumbnail!(size)
            |> upload_image(organization_id, media_id, "#{context}#{extension}")

          {:ok, file} =
            Castmill.Files.create_file(%{
              media_id: media_id,
              name: "#{media_id}-#{context}",
              uri: uri,
              size: size,
              organization_id: organization_id,
              mimetype: mimetype
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

      # Get the full media record to access organization_id and name
      media = Castmill.Resources.get_media(media_id)

      # Only send notification for image files (not videos - video transcoder handles those)
      if media.mimetype && String.starts_with?(media.mimetype, "image/") do
        Logger.info(
          "Sending media upload notification for image: #{media.id}, org: #{media.organization_id}, name: #{media.name}"
        )

        # Send organization-wide notification (Media doesn't track user_id)
        result =
          Events.notify_media_uploaded(
            media.id,
            media.name,
            media.mimetype,
            # org-wide notification (no user_id in Media schema)
            nil,
            media.organization_id,
            # no role filter - all users in org will see it
            []
          )

        Logger.info("Notification result: #{inspect(result)}")
      end

      # Send a message to the medias observer channel to notify the user about the media progress
      Phoenix.PubSub.broadcast(Castmill.PubSub, "resource:media:#{media_id}", %{
        status: :ready,
        status_message: "100",
        files: files_map,
        size: new_size
      })
    end)
  end

  # Upload to local directory or S3 depending on the configuration
  defp upload_image(image, organization_id, media_id, filename) do
    dst_path = "#{organization_id}/#{media_id}"

    case Application.get_env(:castmill, :file_storage) do
      :local ->
        dest_dir = Path.join([Helpers.static_dir(), "medias", dst_path])
        File.mkdir_p!(dest_dir)

        dst_file = Path.join(dest_dir, filename)

        image
        |> Image.write!(dst_file)

        %{size: size} = File.stat!(dst_file)

        {"#{Helpers.get_endpoint_url()}/#{Path.join(["medias", dst_path, filename])}", size}

      :s3 ->
        bucket = System.get_env("AWS_S3_BUCKET")

        filepath = Path.join(dst_path, filename)

        {:ok, _response} =
          image
          |> Image.stream!(suffix: ".jpg", buffer_size: 5_242_880)
          |> ExAws.S3.upload(bucket, filepath)
          |> ExAws.request()

        # Get the size from the remote location
        {:ok, response} =
          ExAws.S3.head_object(bucket, filepath)
          |> ExAws.request()

        # headers is a list of tuples, we need to convert it to a map
        size =
          response
          |> Map.get(:headers)
          |> Enum.find(fn {key, _value} -> key == "Content-Length" end)
          |> case do
            nil -> {:error, "Content-Length header not found"}
            {"Content-Length", value} -> String.to_integer(value)
          end

        uri = Helpers.get_s3_uri(bucket, filepath)

        {uri, size}
    end
  end
end
