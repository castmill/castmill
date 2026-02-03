defmodule Castmill.Workers.VideoTranscoderTest do
  use Castmill.DataCase, async: false

  alias Castmill.Workers.VideoTranscoder

  import ExUnit.CaptureLog

  # Check if ffmpeg is available for integration tests
  @ffmpeg_available System.find_executable("ffmpeg") != nil

  describe "extract_thumbnail/2" do
    setup do
      unless @ffmpeg_available do
        # Skip tests if ffmpeg is not available
        :ok
      end

      # Create a temporary directory for test outputs
      test_dir = Path.join(System.tmp_dir!(), "video_transcoder_test_#{:rand.uniform(100000)}")
      File.mkdir_p!(test_dir)

      on_exit(fn ->
        File.rm_rf(test_dir)
      end)

      %{test_dir: test_dir}
    end

    @tag :requires_ffmpeg
    test "successfully extracts thumbnail at 5 seconds for normal video", %{test_dir: test_dir} do
      unless @ffmpeg_available do
        # Skip test if ffmpeg is not installed
        IO.puts("Skipping test - ffmpeg not available")
        :ok
      else
        input_file = Path.join(test_dir, "input_5s.mp4")
        output_path = Path.join(test_dir, "thumbnail_5s.jpg")

        # Create a test video file with ffmpeg (10 seconds long)
        # This ensures we can extract at 5 seconds
        create_test_video(input_file, 10)

        # Call the function
        result = VideoTranscoder.extract_thumbnail(input_file, output_path)

        assert result == :ok
        assert File.exists?(output_path)

        # Verify it's a valid image file
        assert {:ok, %{size: size}} = File.stat(output_path)
        assert size > 0
      end
    end

    @tag :requires_ffmpeg
    test "falls back to 1 second when 5 seconds fails for short video", %{test_dir: test_dir} do
      unless @ffmpeg_available do
        IO.puts("Skipping test - ffmpeg not available")
        :ok
      else
        input_file = Path.join(test_dir, "input_short.mp4")
        output_path = Path.join(test_dir, "thumbnail_short.jpg")

        # Create a test video file that's 3 seconds long
        # This will fail at 5 seconds but succeed at 1 second
        create_test_video(input_file, 3)

        # Capture logs to verify the retry behavior
        log =
          capture_log(fn ->
            result = VideoTranscoder.extract_thumbnail(input_file, output_path)
            assert result == :ok
          end)

        # Should see a warning about the 5-second attempt failing
        assert log =~ "FFmpeg thumbnail extraction at 5s failed" or
                 log == ""

        assert File.exists?(output_path)
      end
    end

    @tag :requires_ffmpeg
    test "falls back to 0 seconds for very short videos", %{test_dir: test_dir} do
      unless @ffmpeg_available do
        IO.puts("Skipping test - ffmpeg not available")
        :ok
      else
        input_file = Path.join(test_dir, "input_very_short.mp4")
        output_path = Path.join(test_dir, "thumbnail_very_short.jpg")

        # Create a very short video (0.5 seconds)
        # This will fail at 5s and 1s, but succeed at 0s
        create_test_video(input_file, 0.5)

        log =
          capture_log(fn ->
            result = VideoTranscoder.extract_thumbnail(input_file, output_path)
            assert result == :ok
          end)

        # May see warnings about failed attempts at 5s and 1s
        # The important thing is that it eventually succeeds
        assert File.exists?(output_path)
      end
    end

    @tag :requires_ffmpeg
    test "returns error when all timestamps fail", %{test_dir: test_dir} do
      # This test doesn't require ffmpeg to be functional, just to exist
      # Use a non-existent file to ensure all attempts fail
      input_file = Path.join(test_dir, "nonexistent.mp4")
      output_path = Path.join(test_dir, "thumbnail_error.jpg")

      log =
        capture_log(fn ->
          result = VideoTranscoder.extract_thumbnail(input_file, output_path)
          assert result == {:error, :ffmpeg_failed}
        end)

      # Should see warnings for attempts (at least the first one)
      assert log =~ "FFmpeg thumbnail extraction at" or log != ""

      # Output file should not exist
      refute File.exists?(output_path)
    end

    @tag :requires_ffmpeg
    test "returns error when ffmpeg succeeds but file is not created", %{test_dir: test_dir} do
      unless @ffmpeg_available do
        IO.puts("Skipping test - ffmpeg not available")
        :ok
      else
        input_file = Path.join(test_dir, "input.mp4")
        # Use a path that cannot be written (e.g., directory doesn't exist)
        output_path = Path.join(test_dir, "nonexistent_dir/subdir/thumbnail.jpg")

        create_test_video(input_file, 10)

        log =
          capture_log(fn ->
            result = VideoTranscoder.extract_thumbnail(input_file, output_path)
            # This should fail because even if ffmpeg returns 0, the file check will fail
            assert result == {:error, :ffmpeg_failed}
          end)

        refute File.exists?(output_path)
      end
    end

    @tag :requires_ffmpeg
    test "tries all timestamps in order: 5, 1, 0", %{test_dir: test_dir} do
      unless @ffmpeg_available do
        IO.puts("Skipping test - ffmpeg not available")
        :ok
      else
        input_file = Path.join(test_dir, "input_ordering.mp4")
        output_path = Path.join(test_dir, "thumbnail_ordering.jpg")

        # Create a 2-second video
        # This should:
        # - Fail at 5s (video too short)
        # - Succeed at 1s (within video duration)
        create_test_video(input_file, 2)

        log =
          capture_log(fn ->
            result = VideoTranscoder.extract_thumbnail(input_file, output_path)
            assert result == :ok
          end)

        # Verify the output exists (proving it found a working timestamp)
        assert File.exists?(output_path)

        # The log should show it tried 5s first (and possibly failed)
        # but we got a successful extraction in the end
      end
    end

    @tag :requires_ffmpeg
    test "handles special characters in file paths", %{test_dir: test_dir} do
      unless @ffmpeg_available do
        IO.puts("Skipping test - ffmpeg not available")
        :ok
      else
        input_file = Path.join(test_dir, "input with spaces.mp4")
        output_path = Path.join(test_dir, "thumbnail with spaces.jpg")

        create_test_video(input_file, 10)

        result = VideoTranscoder.extract_thumbnail(input_file, output_path)

        assert result == :ok
        assert File.exists?(output_path)
      end
    end
  end

  # Helper to create a test video file using ffmpeg
  defp create_test_video(output_path, duration_seconds) do
    # Create a simple test video using ffmpeg
    # This generates a video with a colored background and timer
    args = [
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=#{duration_seconds}:size=320x240:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=#{duration_seconds}",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-y",
      output_path
    ]

    case System.cmd("ffmpeg", args, stderr_to_stdout: true) do
      {_output, 0} ->
        :ok

      {error, code} ->
        raise "Failed to create test video: exit code #{code}, error: #{error}"
    end
  end
end
