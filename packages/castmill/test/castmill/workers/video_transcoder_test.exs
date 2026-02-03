defmodule Castmill.Workers.VideoTranscoderTest do
  use Castmill.DataCase, async: true

  alias Castmill.Workers.VideoTranscoder
  alias Castmill.Workers.SystemCmdMock

  import ExUnit.CaptureLog
  import Mox

  # Tell ExUnit to verify mocks on exit
  setup :verify_on_exit!

  describe "extract_thumbnail/2" do
    setup do
      # Create a temporary directory for test outputs
      # Use unique integer to avoid collisions in concurrent test runs
      test_dir =
        Path.join(
          System.tmp_dir!(),
          "video_transcoder_test_#{System.unique_integer([:positive])}"
        )

      File.mkdir_p!(test_dir)

      on_exit(fn ->
        File.rm_rf(test_dir)
      end)

      %{test_dir: test_dir}
    end

    test "successfully extracts thumbnail at 5 seconds for normal video", %{test_dir: test_dir} do
      input_file = Path.join(test_dir, "input_5s.mp4")
      output_path = Path.join(test_dir, "thumbnail_5s.jpg")

      # Mock FFmpeg to succeed on first attempt (5 seconds)
      expect(SystemCmdMock, :cmd, fn "ffmpeg", args, _opts ->
        # Verify it's trying timestamp 5 first
        assert "-ss" in args
        timestamp_index = Enum.find_index(args, &(&1 == "-ss"))
        assert Enum.at(args, timestamp_index + 1) == "5"

        # Create the output file to simulate successful extraction
        File.write!(output_path, "fake thumbnail data")
        {"", 0}
      end)

      result = VideoTranscoder.extract_thumbnail(input_file, output_path, SystemCmdMock)

      assert result == :ok
      assert File.exists?(output_path)
      assert {:ok, %{size: size}} = File.stat(output_path)
      assert size > 0
    end

    test "falls back to 1 second when 5 seconds fails for short video", %{test_dir: test_dir} do
      input_file = Path.join(test_dir, "input_short.mp4")
      output_path = Path.join(test_dir, "thumbnail_short.jpg")

      # Mock FFmpeg to fail at 5s, succeed at 1s
      expect(SystemCmdMock, :cmd, 2, fn "ffmpeg", args, _opts ->
        timestamp_index = Enum.find_index(args, &(&1 == "-ss"))
        timestamp = Enum.at(args, timestamp_index + 1)

        case timestamp do
          "5" ->
            # Fail at 5 seconds
            {"Error: Invalid timestamp", 1}

          "1" ->
            # Succeed at 1 second
            File.write!(output_path, "fake thumbnail data")
            {"", 0}
        end
      end)

      log =
        capture_log(fn ->
          result = VideoTranscoder.extract_thumbnail(input_file, output_path, SystemCmdMock)
          assert result == :ok
        end)

      # Should see a warning about the 5-second attempt failing
      assert log =~ "FFmpeg thumbnail extraction at 5s failed"
      assert File.exists?(output_path)
    end

    test "falls back to 0 seconds for very short videos", %{test_dir: test_dir} do
      input_file = Path.join(test_dir, "input_very_short.mp4")
      output_path = Path.join(test_dir, "thumbnail_very_short.jpg")

      # Mock FFmpeg to fail at 5s and 1s, succeed at 0s
      expect(SystemCmdMock, :cmd, 3, fn "ffmpeg", args, _opts ->
        timestamp_index = Enum.find_index(args, &(&1 == "-ss"))
        timestamp = Enum.at(args, timestamp_index + 1)

        case timestamp do
          "5" ->
            {"Error: Invalid timestamp", 1}

          "1" ->
            {"Error: Invalid timestamp", 1}

          "0" ->
            File.write!(output_path, "fake thumbnail data")
            {"", 0}
        end
      end)

      log =
        capture_log(fn ->
          result = VideoTranscoder.extract_thumbnail(input_file, output_path, SystemCmdMock)
          assert result == :ok
        end)

      # Should see warnings about failed attempts
      assert log =~ "FFmpeg thumbnail extraction at 5s failed"
      assert log =~ "FFmpeg thumbnail extraction at 1s failed"
      assert File.exists?(output_path)
    end

    test "returns error when all timestamps fail", %{test_dir: test_dir} do
      input_file = Path.join(test_dir, "nonexistent.mp4")
      output_path = Path.join(test_dir, "thumbnail_error.jpg")

      # Mock FFmpeg to fail for all timestamps
      expect(SystemCmdMock, :cmd, 3, fn "ffmpeg", _args, _opts ->
        {"Error: File not found", 1}
      end)

      log =
        capture_log(fn ->
          result = VideoTranscoder.extract_thumbnail(input_file, output_path, SystemCmdMock)
          assert result == {:error, :ffmpeg_failed}
        end)

      # Should see warnings for all attempts
      assert log =~ "FFmpeg thumbnail extraction at 5s failed"
      assert log =~ "FFmpeg thumbnail extraction at 1s failed"
      assert log =~ "FFmpeg thumbnail extraction at 0s failed"

      # Output file should not exist
      refute File.exists?(output_path)
    end

    test "returns error when ffmpeg succeeds but file is not created", %{test_dir: test_dir} do
      input_file = Path.join(test_dir, "input.mp4")
      output_path = Path.join(test_dir, "nonexistent_dir/subdir/thumbnail.jpg")

      # Mock FFmpeg to return success but don't create the file
      expect(SystemCmdMock, :cmd, 3, fn "ffmpeg", _args, _opts ->
        # Return success code but don't create file
        {"", 0}
      end)

      log =
        capture_log(fn ->
          result = VideoTranscoder.extract_thumbnail(input_file, output_path, SystemCmdMock)
          # This should fail because file check will fail for all timestamps
          assert result == {:error, :ffmpeg_failed}
        end)

      refute File.exists?(output_path)
    end

    test "tries all timestamps in order: 5, 1, 0", %{test_dir: test_dir} do
      input_file = Path.join(test_dir, "input_ordering.mp4")
      output_path = Path.join(test_dir, "thumbnail_ordering.jpg")

      timestamps_tried = []

      # Mock FFmpeg to track the order of timestamps tried
      expect(SystemCmdMock, :cmd, 2, fn "ffmpeg", args, _opts ->
        timestamp_index = Enum.find_index(args, &(&1 == "-ss"))
        timestamp = Enum.at(args, timestamp_index + 1)

        # Track which timestamp was tried
        Agent.update(:timestamp_tracker, fn list -> list ++ [timestamp] end)

        case timestamp do
          "5" ->
            # Fail at 5 seconds
            {"Error: Invalid timestamp", 1}

          "1" ->
            # Succeed at 1 second
            File.write!(output_path, "fake thumbnail data")
            {"", 0}
        end
      end)

      # Start agent to track timestamps
      {:ok, _pid} = Agent.start_link(fn -> [] end, name: :timestamp_tracker)

      log =
        capture_log(fn ->
          result = VideoTranscoder.extract_thumbnail(input_file, output_path, SystemCmdMock)
          assert result == :ok
        end)

      # Verify timestamps were tried in order
      tried = Agent.get(:timestamp_tracker, & &1)
      assert tried == ["5", "1"]

      Agent.stop(:timestamp_tracker)
      assert File.exists?(output_path)
    end

    test "handles special characters in file paths", %{test_dir: test_dir} do
      input_file = Path.join(test_dir, "input with spaces.mp4")
      output_path = Path.join(test_dir, "thumbnail with spaces.jpg")

      # Mock FFmpeg to succeed
      expect(SystemCmdMock, :cmd, fn "ffmpeg", args, _opts ->
        # Verify the paths with spaces are passed correctly
        assert input_file in args
        assert output_path in args

        File.write!(output_path, "fake thumbnail data")
        {"", 0}
      end)

      result = VideoTranscoder.extract_thumbnail(input_file, output_path, SystemCmdMock)

      assert result == :ok
      assert File.exists?(output_path)
    end
  end
end
