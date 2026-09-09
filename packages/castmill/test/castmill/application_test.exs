defmodule Castmill.ApplicationTest do
  use ExUnit.Case, async: true

  alias Castmill.Application, as: App

  describe "normalize_event_queues/1" do
    test "maps a bare queue atom to the default transcoder handler" do
      assert App.normalize_event_queues([:video_transcoder, :image_transcoder]) == [
               {:video_transcoder, Castmill.Workers.TranscoderEventsHandler},
               {:image_transcoder, Castmill.Workers.TranscoderEventsHandler}
             ]
    end

    test "keeps an explicit {queue, handler} tuple so other workers can plug in" do
      assert App.normalize_event_queues([{:widget_upload, MyApp.WidgetEventsHandler}]) == [
               {:widget_upload, MyApp.WidgetEventsHandler}
             ]
    end

    test "supports mixing bare atoms and explicit handlers" do
      assert App.normalize_event_queues([
               :video_transcoder,
               {:widget_upload, MyApp.WidgetEventsHandler}
             ]) == [
               {:video_transcoder, Castmill.Workers.TranscoderEventsHandler},
               {:widget_upload, MyApp.WidgetEventsHandler}
             ]
    end
  end

  describe "listener_event_queues/2" do
    test "web+worker listens to completion queues it does not process locally" do
      config = [
        queues: [email: [concurrency: 5], maintenance: [concurrency: 2]],
        completion_event_queues: [:video_transcoder, :image_transcoder]
      ]

      assert App.listener_event_queues(:web_worker, config) == [
               {:video_transcoder, Castmill.Workers.TranscoderEventsHandler},
               {:image_transcoder, Castmill.Workers.TranscoderEventsHandler}
             ]
    end

    test "web+worker does not listen to queues it processes locally" do
      config = [
        queues: [
          email: [concurrency: 5],
          video_transcoder: [concurrency: 10],
          image_transcoder: [concurrency: 10]
        ],
        completion_event_queues: [:video_transcoder, :image_transcoder]
      ]

      assert App.listener_event_queues(:web_worker, config) == []
    end

    test "preserves handlers while excluding a locally processed queue" do
      config = [
        queues: [video_transcoder: [concurrency: 10]],
        completion_event_queues: [
          :video_transcoder,
          {:widget_upload, MyApp.WidgetEventsHandler}
        ]
      ]

      assert App.listener_event_queues(:web_worker, config) == [
               {:widget_upload, MyApp.WidgetEventsHandler}
             ]
    end

    test "web mode listens even when queues are present in config" do
      config = [
        queues: [video_transcoder: [concurrency: 10]],
        completion_event_queues: [:video_transcoder]
      ]

      assert App.listener_event_queues(:web, config) == [
               {:video_transcoder, Castmill.Workers.TranscoderEventsHandler}
             ]
    end

    test "worker-only mode does not start completion listeners" do
      config = [
        queues: [video_transcoder: [concurrency: 10]],
        completion_event_queues: [:video_transcoder, :image_transcoder]
      ]

      assert App.listener_event_queues(:worker, config) == []
    end
  end
end
