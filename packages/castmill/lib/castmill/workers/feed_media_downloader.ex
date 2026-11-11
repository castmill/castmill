defmodule Castmill.Workers.FeedMediaDownloader do
  @moduledoc """
  BullMQ worker that copies a feed media file (see `Castmill.Feeds.Media`).
  Transient errors are retried with exponential backoff; after the last attempt
  the media is marked `failed` and entries keep the original URL.
  """

  alias Castmill.Feeds.Media
  alias Castmill.Workers.BullMQHelper

  @queue "feed_media"
  @attempts 4
  @backoff_ms 30_000

  def enqueue(media_id) do
    BullMQHelper.add_job(@queue, "download", %{"media_id" => media_id},
      attempts: @attempts,
      backoff: %{type: :exponential, delay: @backoff_ms}
    )
  end

  def process(%BullMQ.Job{data: data} = job) do
    case Media.download(data["media_id"], final: not BullMQ.Job.should_retry?(job)) do
      :ok -> :ok
      {:retry, reason} -> {:error, reason}
    end
  end
end
