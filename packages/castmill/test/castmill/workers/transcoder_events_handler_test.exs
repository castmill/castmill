defmodule Castmill.Workers.TranscoderEventsHandlerTest do
  use ExUnit.Case, async: true

  alias Castmill.Workers.TranscoderEventsHandler

  setup do
    media_id = Ecto.UUID.generate()
    Phoenix.PubSub.subscribe(Castmill.PubSub, "resource:media:#{media_id}")
    {:ok, media_id: media_id}
  end

  describe "handle_event/3 :completed" do
    test "broadcasts the notification payload carried in the job return value", %{
      media_id: media_id
    } do
      returnvalue =
        Jason.encode!(%{
          "media_id" => media_id,
          "status" => "ready",
          "status_message" => "100",
          "files" => %{"thumbnail" => %{"id" => "file-1"}},
          "size" => 4242
        })

      assert {:ok, :state} =
               TranscoderEventsHandler.handle_event(
                 :completed,
                 %{"jobId" => "video_transcode:#{media_id}", "returnvalue" => returnvalue},
                 :state
               )

      assert_receive %{
        status: "ready",
        status_message: "100",
        files: %{"thumbnail" => %{"id" => "file-1"}},
        size: 4242
      }
    end

    test "accepts an already-decoded map return value", %{media_id: media_id} do
      assert {:ok, :state} =
               TranscoderEventsHandler.handle_event(
                 :completed,
                 %{
                   "returnvalue" => %{
                     "media_id" => media_id,
                     "status" => "ready",
                     "status_message" => "100",
                     "files" => %{},
                     "size" => 1
                   }
                 },
                 :state
               )

      assert_receive %{status: "ready", size: 1}
    end

    test "does not broadcast when the return value has no media_id", %{media_id: media_id} do
      assert {:ok, :state} =
               TranscoderEventsHandler.handle_event(
                 :completed,
                 %{"returnvalue" => "null"},
                 :state
               )

      refute_receive %{status: _}, 50

      # Also ignores structured return values that are missing a media id.
      assert {:ok, :state} =
               TranscoderEventsHandler.handle_event(
                 :completed,
                 %{"returnvalue" => Jason.encode!(%{"status" => "ready"})},
                 :state
               )

      refute_receive %{status: _}, 50
      # media_id in scope only to make the subscription topic meaningful
      _ = media_id
    end
  end

  describe "handle_event/3 :failed" do
    test "broadcasts a failure derived from the deterministic job id", %{media_id: media_id} do
      assert {:ok, :state} =
               TranscoderEventsHandler.handle_event(
                 :failed,
                 %{"jobId" => "video_transcode:#{media_id}", "failedReason" => "boom"},
                 :state
               )

      assert_receive %{status: :failed, status_message: "boom", files: nil, size: nil}
    end

    test "ignores failed events without a parseable job id" do
      assert {:ok, :state} =
               TranscoderEventsHandler.handle_event(
                 :failed,
                 %{"jobId" => "no-colon", "failedReason" => "boom"},
                 :state
               )

      refute_receive %{status: :failed}, 50
    end
  end

  test "ignores unrelated events" do
    assert {:ok, :state} =
             TranscoderEventsHandler.handle_event(:progress, %{"jobId" => "x"}, :state)
  end
end
