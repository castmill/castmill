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
end
