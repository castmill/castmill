defmodule Castmill.Workers.FeedMediaCleanup do
  @moduledoc """
  Daily BullMQ job that removes feed media no longer referenced (or left by
  deleted feeds) and re-queues lost downloads. See `Castmill.Feeds.Media.cleanup/0`.
  """

  require Logger

  alias Castmill.Feeds.Media
  alias Castmill.Workers.BullMQHelper

  @queue "maintenance"
  @job "feed_media_cleanup"
  @every_ms 24 * 60 * 60 * 1000

  def process(%BullMQ.Job{}) do
    result = Media.cleanup()
    Logger.info("[FeedMediaCleanup] #{inspect(result)}")
    :ok
  end

  @doc "Creates (or keeps) the daily schedule. Called at startup on worker nodes."
  def ensure_scheduled do
    BullMQHelper.upsert_scheduler(@queue, @job, %{every: @every_ms}, @job, %{}, attempts: 1)
  end
end
