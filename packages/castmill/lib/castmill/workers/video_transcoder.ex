defmodule Castmill.Workers.VideoTranscoder do
  require Logger

  alias Castmill.Repo
  alias Castmill.Resources
  alias Castmill.Resources.Media
  alias Castmill.Files
  alias Castmill.Workers.Helpers
  alias Castmill.Workers.BullMQHelper
  alias Castmill.Notifications.Events

  @file_sizes_and_contexts [
    {640, "preview"},
    {1920, "poster"}
  ]

  @queue "video_transcoder"

  @doc """
  Processes the video transcoding job.
  This is called by BullMQ worker.
  """
  def process(%BullMQ.Job{data: args}) do
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

    case get_input_file(input_uri) do
      {:ok, input_file} ->
        result =
          try do
            do_process(input_file, media_id, organization_id)
          rescue
            e ->
              stacktrace = __STACKTRACE__
              formatted_error = Exception.format(:error, e, stacktrace)

              Logger.error("Video transcoding failed: #{formatted_error}")

              {:error, exception_to_status_message(e)}
          after
            cleanup_downloaded_input_file(input_file, input_uri)
          end

        handle_process_result(media_id, result)

      {:error, reason} ->
        handle_process_result(media_id, {:error, reason})
    end
  end

  defp do_process(input_file, media_id, organization_id) do
    with {:ok, total_duration} <- get_video_duration(input_file),
         {:ok, transcoded_files_metadata, total_size} <-
           transcode_assets(input_file, media_id, organization_id, total_duration),
         {:ok, media_file_records} <-
           persist_transcoded_files(transcoded_files_metadata, media_id, organization_id) do
      notify_media_progress(media_id, 100.0, media_file_records, total_size, true)
      :ok
    end
  end

  defp transcode_assets(input_file, media_id, organization_id, total_duration) do
    total_duration = length(@file_sizes_and_contexts) * total_duration

    output_image_filename = "thumbnail.jpg"
    output_image_path = Path.join("/tmp", "#{media_id}_#{output_image_filename}")

    thumbnail_result =
      try do
        with :ok <- extract_thumbnail(input_file, output_image_path),
             {thumbnail_uri, thumbnail_size} <-
               upload_file(output_image_path, organization_id, media_id, output_image_filename) do
          {:ok, thumbnail_uri, thumbnail_size}
        else
          {:error, reason} -> {:error, "Thumbnail extraction failed: #{inspect(reason)}"}
        end
      after
        cleanup_temp_file(output_image_path)
      end

    with {:ok, thumbnail_uri, thumbnail_size} <- thumbnail_result do
      transcoded_files_metadata = %{"thumbnail" => {thumbnail_uri, thumbnail_size, "image/jpeg"}}

      Enum.reduce_while(
        @file_sizes_and_contexts,
        {:ok, 0.0, transcoded_files_metadata, thumbnail_size},
        fn {width, context}, {:ok, acc_progress, acc_files, acc_size} ->
          output_filename = "#{context}.mp4"
          output_path = Path.join("/tmp", "#{media_id}_#{output_filename}")

          step_result =
            try do
              case transcode_video(
                     input_file,
                     output_path,
                     width,
                     media_id,
                     total_duration,
                     acc_progress
                   ) do
                :ok ->
                  {uri, size} =
                    upload_file(output_path, organization_id, media_id, output_filename)

                  new_progress =
                    Float.floor(acc_progress + 100 / length(@file_sizes_and_contexts))

                  notify_media_progress(media_id, new_progress)

                  {:ok, new_progress,
                   Map.put(acc_files, context, {uri, size, "video/mp4"}), acc_size + size}

                {:error, reason} ->
                  {:error, "Transcoding failed: #{inspect(reason)}"}
              end
            after
              cleanup_temp_file(output_path)
            end

          case step_result do
            {:ok, new_progress, files, size} -> {:cont, {:ok, new_progress, files, size}}
            {:error, _} = error -> {:halt, error}
          end
        end
      )
      |> case do
        {:ok, _final_progress, files_metadata, size} -> {:ok, files_metadata, size}
        {:error, _} = error -> error
      end
    else
      {:error, _} = error -> error
    end
  end

  defp persist_transcoded_files(transcoded_files_metadata, media_id, organization_id) do
    Repo.transaction(fn ->
      Enum.reduce(transcoded_files_metadata, %{}, fn {context, {uri, size, mimetype}}, acc ->
        attrs = %{
          media_id: media_id,
          name: "#{media_id}-#{context}",
          uri: uri,
          size: size,
          organization_id: organization_id,
          mimetype: mimetype
        }

        with {:ok, file} <- Files.create_file(attrs),
             {:ok, _file_media} <- Files.add_file_to_media(file.id, media_id, context) do
          Map.put(acc, context, file)
        else
          {:error, %Ecto.Changeset{} = changeset} ->
            reason = "Failed to persist transcoded #{context} file"

            Logger.error(
              "#{reason} for media #{media_id}: #{format_changeset_errors(changeset)}"
            )

            Repo.rollback(reason)

          {:error, reason} ->
            formatted_reason = normalize_error_message(reason)

            Logger.error(
              "Failed to associate transcoded #{context} file for media #{media_id}: #{formatted_reason}"
            )

            Repo.rollback("Failed to associate transcoded #{context} file")
        end
      end)
    end)
    |> case do
      {:ok, media_file_records} -> {:ok, media_file_records}
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_input_file(input_uri) do
    {:ok, Helpers.get_file_from_uri(input_uri)}
  rescue
    e ->
      Logger.error("Failed to prepare input file for transcoding: #{Exception.message(e)}")
      {:error, exception_to_status_message(e)}
  end

  defp cleanup_downloaded_input_file(input_file, input_uri) do
    if input_file != input_uri && File.exists?(input_file) do
      File.rm(input_file)
    end
  end

  defp cleanup_temp_file(path) do
    if File.exists?(path) do
      File.rm(path)
    end
  end

  defp format_changeset_errors(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(fn {message, opts} ->
      Enum.reduce(opts, message, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> inspect()
  end

  defp handle_process_result(_media_id, :ok), do: :ok

  defp handle_process_result(media_id, {:error, reason}) do
    status_message = normalize_error_message(reason)

    {:ok, _media} =
      Resources.update_media(%Media{id: media_id}, %{
        status: :failed,
        status_message: status_message
      })

    Phoenix.PubSub.broadcast(Castmill.PubSub, "resource:media:#{media_id}", %{
      status: :failed,
      status_message: status_message,
      files: nil,
      size: nil
    })

    {:error, reason}
  end

  defp normalize_error_message(reason) when is_binary(reason), do: reason
  defp normalize_error_message(reason) when is_atom(reason), do: inspect(reason)
  defp normalize_error_message({:error, reason}), do: normalize_error_message(reason)
  defp normalize_error_message(reason) when is_exception(reason), do: Exception.message(reason)
  defp normalize_error_message(reason), do: inspect(reason)

  defp exception_to_status_message(%RuntimeError{message: message}) when is_binary(message),
    do: message

  defp exception_to_status_message(exception) do
    case Exception.message(exception) do
      "" -> inspect(exception)
      message -> message
    end
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

  @doc false
  # This function is made public for testing purposes only.
  # It extracts a thumbnail from a video file, trying multiple timestamps.
  def extract_thumbnail(input_file, output_path, system_cmd \\ nil) do
    system_cmd = system_cmd || system_cmd_module()

    # Try to extract at 5 seconds first, then at 1 second, then at 0 for very short videos
    timestamps = ["5", "1", "0"]

    Enum.reduce_while(timestamps, {:error, :ffmpeg_failed}, fn timestamp, _acc ->
      ffmpeg_args = [
        "-i",
        input_file,
        "-ss",
        timestamp,
        "-vframes",
        "1",
        "-q:v",
        "2",
        "-y",
        output_path
      ]

      case system_cmd.cmd("ffmpeg", ffmpeg_args, stderr_to_stdout: true) do
        {_output, 0} ->
          if File.exists?(output_path) do
            {:halt, :ok}
          else
            {:cont, {:error, :ffmpeg_failed}}
          end

        {output, _exit_code} ->
          Logger.warning("FFmpeg thumbnail extraction at #{timestamp}s failed: #{output}")
          {:cont, {:error, :ffmpeg_failed}}
      end
    end)
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

  # Timeout for receiving FFmpeg progress data. If no data is received within this
  # period, FFmpeg is assumed to have been killed (e.g., OOM on constrained containers).
  @ffmpeg_receive_timeout_ms 120_000

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
    after
      @ffmpeg_receive_timeout_ms ->
        # FFmpeg stopped sending data — likely OOM-killed or hung.
        # Try to kill the port to clean up, then fail the job.
        Logger.error(
          "FFmpeg timed out after #{@ffmpeg_receive_timeout_ms}ms with no output for media #{media_id}. " <>
            "The process may have been OOM-killed."
        )

        try do
          Port.close(port)
        catch
          _, _ -> :ok
        end

        {:error, :ffmpeg_timeout}
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

    # Verify source file exists before attempting upload
    unless File.exists?(local_path) do
      raise "Source file does not exist for upload: #{local_path} (#{filename})"
    end

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

  defp system_cmd_module do
    Application.get_env(:castmill, :system_cmd, Castmill.Workers.SystemCmd)
  end

  defp get_video_duration(input_file) do
    system_cmd = system_cmd_module()

    ffprobe_args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      input_file
    ]

    case system_cmd.cmd("ffprobe", ffprobe_args, stderr_to_stdout: true) do
      {duration_str, 0} ->
        case Float.parse(String.trim(duration_str)) do
          {duration, _rest} ->
            {:ok, duration}

          :error ->
            Logger.error("FFprobe returned an invalid duration: #{inspect(duration_str)}")
            {:error, "Could not determine video duration"}
        end

      {error_output, _exit_code} ->
        Logger.error("FFprobe error: #{error_output}")
        {:error, "Could not determine video duration"}
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

  @doc """
  Schedules a video transcoding job.
  """
  def schedule(media, filepath, mime_type \\ nil) do
    # Convert Ecto struct to plain map with string keys for BullMQ serialization
    media_map = media_to_map(media)

    args = %{
      "media" => media_map,
      "filepath" => filepath
    }

    # Add mime_type if provided (for compatibility)
    args = if mime_type, do: Map.put(args, "mime_type", mime_type), else: args

    BullMQHelper.add_job(
      @queue,
      "video_transcode",
      args,
      job_id: "video_transcode:#{media_map["id"]}"
    )
  end

  defp media_to_map(%Castmill.Resources.Media{} = media) do
    %{
      "id" => media.id,
      "organization_id" => media.organization_id,
      "name" => media.name,
      "mimetype" => media.mimetype,
      "status" => media.status
    }
  end

  defp media_to_map(media) when is_map(media), do: media
end
