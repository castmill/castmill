defmodule Castmill.Feeds.FeedEntry do
  @moduledoc "An entry of a list feed."
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "feed_entries" do
    field(:external_id, :string)
    field(:data, :map)
    field(:received_at, :utc_datetime_usec)

    belongs_to(:feed, Castmill.Feeds.Feed)

    timestamps(type: :utc_datetime_usec)
  end

  @doc "The entry as widgets and API clients see it: its data plus id, received_at and external_id."
  def to_map(%__MODULE__{} = entry) do
    map =
      entry.data
      |> Map.put("id", entry.id)
      |> Map.put("received_at", DateTime.to_iso8601(entry.received_at))

    if entry.external_id, do: Map.put(map, "external_id", entry.external_id), else: map
  end
end
