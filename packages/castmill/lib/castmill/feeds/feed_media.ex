defmodule Castmill.Feeds.FeedMedia do
  @moduledoc """
  A copy of a media file (image or video) referenced by a feed's entries. See
  "Media in entries" in agents/systems/DATA-FEEDS.md.

  Statuses: `pending` (download queued), `ready` (stored; entries use `url`),
  `failed` (entries keep the original URL) and `deleting` (no longer
  referenced; the file is being removed).
  """
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "feed_media" do
    field(:original_url, :string)
    field(:url_hash, :string)
    field(:status, :string, default: "pending")
    field(:failure_reason, :string)
    field(:content_hash, :string)
    field(:storage_key, :string)
    field(:url, :string)
    field(:content_type, :string)
    field(:size, :integer)
    field(:width, :integer)
    field(:height, :integer)
    field(:duration, :float)

    belongs_to(:feed, Castmill.Feeds.Feed)
    belongs_to(:organization, Castmill.Organizations.Organization)

    timestamps(type: :utc_datetime_usec)
  end

  def hash_url(url), do: :crypto.hash(:sha256, url) |> Base.encode16(case: :lower)

  @doc "The original URL's host; logs and the dashboard never show full original URLs."
  def original_host(%__MODULE__{original_url: url}), do: URI.parse(url).host
end
