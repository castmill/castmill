defmodule Castmill.Workers.VideoTranscoder do
  use Oban.Worker, queue: :video_transcoder
  alias Castmill.Repo
  alias Castmill.Resources
  alias Castmill.Resources.Media
  alias Castmill.Files
  alias Castmill.Workers.Helpers
  alias Castmill.Notifications.Events

  require Logger

  @file_sizes_and_contexts [
    {640, "preview"},
    {1920, "poster"}
  ]

  @impl Oban.Worker
  def perform(%Oban.Job{args: args} = job) do
    dbg(job)

    media = args["media"]
    organization_id = media["organization_id"]
    media_id = media["id"]

    # Start by setting media status to :transcoding with progress 0%
    {:ok, _media} =
      Resources.update_media(%Media{id: media_id}, %{
        status: :transcoding,
        status_message: "0"
      })

    # Input file path or URL
    input_uri = args["filepath"]

    # Handle input file or download if it's a remote URL
    input_file = Helpers.get_file_from_uri(input_uri)
    {:ok, total_duration} = get_video_duration(input_file)

    total_duration = length(@file_sizes_and_contexts) * total_duration

    try do
      # Process within a transaction
      # Extract thumbnail image at 5 seconds
      output_image_filename = "thumbnail.jpg"
      output_image_path = Path.join("/tmp", "#{media_id}_#{output_image_filename}")

      {transcoded_files_metadata, total_size} =
        case extract_thumbnail(input_file, output_image_path) do
          :ok ->
            # Upload the image file
            {uri, size} =
              upload_file(output_image_path, organization_id, media_id, output_image_filename)

            # Clean up temporary file
            File.rm(output_image_path)

            # Update accumulated files and size
            transcoded_files_metadata = %{"thumbnail" => {uri, size, "image/jpeg"}}

            {transcoded_files_metadata, size}

          {:error, reason} ->
            raise "Thumbnail extraction failed: #{inspect(reason)}"
        end

      # Initialize progress and file map
      {_final_progress, transcoded_files_metadata, total_size} =
        Enum.reduce(
          @file_sizes_and_contexts,
          {0.0, transcoded_files_metadata, total_size},
          fn {width, context}, {acc_progress, acc_files, acc_size} ->
            # Output file paths
            output_filename = "#{context}.mp4"
            output_path = Path.join("/tmp", "#{media_id}_#{output_filename}")

            # Transcode video
            case transcode_video(
                   input_file,
                   output_path,
                   width,
                   media_id,
                   total_duration,
                   acc_progress
                 ) do
              :ok ->
                # Upload the video file
                {uri, size} = upload_file(output_path, organization_id, media_id, output_filename)

                # Update progress
                new_progress =
                  Float.floor(acc_progress + 100 / length(@file_sizes_and_contexts))

                notify_media_progress(media_id, new_progress)

                # Clean up temporary file
                File.rm(output_path)

                # Update accumulated files and size
                new_transcoded_files_metadata =
                  Map.put(acc_files, context, {uri, size, "video/mp4"})

                new_total_size = acc_size + size

                {new_progress, new_transcoded_files_metadata, new_total_size}

              {:error, reason} ->
                raise "Transcoding failed: #{inspect(reason)}"
            end
          end
        )

      # Update database in one transaction, adding the new files according to the files_map
      {:ok, media_file_records} =
        Repo.transaction(fn ->
          Enum.reduce(transcoded_files_metadata, %{}, fn {context, {uri, size, mimetype}}, acc ->
            # Create a File record in the database
            {:ok, file} =
              Files.create_file(%{
                media_id: media_id,
                name: "#{media_id}-#{context}",
                uri: uri,
                size: size,
                organization_id: organization_id,
                mimetype: mimetype
              })

            # Associate the file with the media
            Files.add_file_to_media(file.id, media_id, context)

            # Accumulate the file record in the result map
            Map.put(acc, context, file)
          end)
        end)

      notify_media_progress(media_id, 100.0, media_file_records, total_size, true)
    rescue
      e ->
        # Capture and format the error and stack trace
        stacktrace = __STACKTRACE__
        formatted_error = Exception.format(:error, e, stacktrace)

        # Log the full error and stack trace
        Logger.error("Video transcoding failed: #{formatted_error}")

        {:ok, _media} =
          Resources.update_media(%Media{id: media_id}, %{
            status: :error,
            status_message: "Error: #{inspect(e)}"
          })

        {:error, e}
    after
      # Clean up temporary input file if it was downloaded
      if input_file != input_uri && File.exists?(input_file) do
        File.rm(input_file)
      end
    end

    :ok
  end

  defp transcode_video(input_file, output_path, width, media_id, total_duration, acc_progress) do
    # Build FFmpeg command
    ffmpeg_args = [
      "-i",
      input_file,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-vf",
      "scale=#{width}:-2",
      "-movflags",
      "+faststart",
      "-y",
      output_path
    ]

    # Run FFmpeg command and capture progress
    run_ffmpeg_with_progress(ffmpeg_args, media_id, total_duration, acc_progress)
  end

  defp extract_thumbnail(input_file, output_path) do
    ffmpeg_args = [
      "-i",
      input_file,
      "-ss",
      "5",
      "-vframes",
      "1",
      "-q:v",
      "2",
      "-y",
      output_path
    ]

    # Run FFmpeg command
    case System.cmd("ffmpeg", ffmpeg_args, stderr_to_stdout: true) do
      {_output, 0} ->
        :ok

      {output, _exit_code} ->
        Logger.error("FFmpeg error: #{output}")
        {:error, :ffmpeg_failed}
    end
  end

  defp run_ffmpeg_with_progress(args, media_id, total_duration, acc_progress) do
    # Append progress output to the FFmpeg arguments
    ffmpeg_args = args ++ ["-progress", "pipe:1", "-nostats"]

    port =
      Port.open(
        {:spawn_executable, ffmpeg_path()},
        [
          :binary,
          {:args, ffmpeg_args},
          :exit_status,
          :stderr_to_stdout
        ]
      )

    listen_for_progress(port, media_id, total_duration, acc_progress)
  end

  defp listen_for_progress(port, media_id, total_duration, acc_progress) do
    receive do
      {^port, {:data, data}} ->
        data
        |> parse_progress_output()
        |> maybe_broadcast_progress(media_id, total_duration, acc_progress)

        listen_for_progress(port, media_id, total_duration, acc_progress)

      {^port, {:exit_status, exit_status}} ->
        Logger.info("FFmpeg exited with status: #{exit_status}")

        if exit_status == 0 do
          :ok
        else
          {:error, :ffmpeg_failed}
        end
    end
  end

  defp parse_progress_output(data) do
    data
    |> String.split("\n")
    |> Enum.reduce(%{}, fn line, acc ->
      case String.split(line, "=") do
        [key, value] -> Map.put(acc, key, value)
        _ -> acc
      end
    end)
  end

  defp maybe_broadcast_progress(progress_map, media_id, total_duration, acc_progress) do
    if Map.has_key?(progress_map, "out_time_ms") do
      out_time_str = progress_map["out_time_ms"]

      case Integer.parse(out_time_str) do
        {out_time_ms, _} ->
          # Convert to seconds
          current_time = out_time_ms / 1_000_000

          progress = calculate_progress(current_time, total_duration, acc_progress)

          # TODO: only broadcast if progress has changed

          # Update media status and broadcast progress
          {:ok, _media} =
            Resources.update_media(%Media{id: media_id}, %{
              status_message: "#{progress}"
            })

          Phoenix.PubSub.broadcast(Castmill.PubSub, "resource:media:#{media_id}", %{
            status_message: "#{progress}"
          })

        :error ->
          # Ignore invalid values like "N/A" and do nothing
          :ok
      end
    end
  end

  defp calculate_progress(current_time, total_duration, acc_progress) do
    progress = min(current_time / total_duration * 100 + acc_progress, 100.0)
    Float.round(progress, 0)
  end

  defp upload_file(local_path, organization_id, media_id, filename) do
    dst_path = "#{organization_id}/#{media_id}/#{filename}"

    case Application.get_env(:castmill, :file_storage) do
      :local ->
        dest_dir =
          Path.join([Helpers.static_dir(), "medias", "#{organization_id}", "#{media_id}"])

        File.mkdir_p!(dest_dir)
        dst_file = Path.join(dest_dir, filename)
        File.cp!(local_path, dst_file)
        %{size: size} = File.stat!(dst_file)

        # Generate URI for the uploaded file
        uri =
          "#{Helpers.get_endpoint_url()}/#{Path.join(["medias", "#{organization_id}", "#{media_id}", filename])}"

        {uri, size}

      :s3 ->
        Helpers.upload_to_s3(local_path, dst_path)
    end
  end

  defp ffmpeg_path do
    System.find_executable("ffmpeg") || "/usr/bin/ffmpeg"
  end

  defp get_video_duration(input_file) do
    ffprobe_args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      input_file
    ]

    case System.cmd("ffprobe", ffprobe_args) do
      {duration_str, 0} ->
        duration_str
        |> String.trim()
        |> String.to_float()
        |> then(&{:ok, &1})

      {error_output, _exit_code} ->
        Logger.error("FFprobe error: #{error_output}")
        {:error, :ffprobe_failed}
    end
  end

  defp notify_media_progress(
         media_id,
         progress,
         media_file_records \\ nil,
         total_size \\ nil,
         send_notification \\ false
       ) do
    # Update media status and broadcast progress
    status = if progress == 100.0, do: :ready, else: :transcoding

    {:ok, _media} =
      Resources.update_media(%Media{id: media_id}, %{
        status: status,
        status_message: "#{progress}"
      })

    # Send notification only when explicitly requested (final 100% with files)
    if send_notification && progress == 100.0 do
      # Get the full media record to access organization_id, name, and mimetype
      media = Resources.get_media(media_id)

      Logger.info(
        "Sending media upload notification for media: #{media.id}, org: #{media.organization_id}, name: #{media.name}"
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

    Phoenix.PubSub.broadcast(Castmill.PubSub, "resource:media:#{media_id}", %{
      status_message: "#{progress}",
      status: status,
      files: media_file_records,
      size: total_size
    })
  end
end
