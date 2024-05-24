defmodule Castmill.Resources.Calendar do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "calendars" do
    field(:description, :string)
    field(:name, :string)
    field(:timezone, :string)

    belongs_to(:playlist, Castmill.Resources.Playlist, foreign_key: :default_playlist_id)

    belongs_to(:organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID
    )

    belongs_to(:resource, Castmill.Resources.Resource, foreign_key: :resource_id)

    has_many(:entries, Castmill.Resources.CalendarEntry)

    timestamps()
  end

  @doc false
  def changeset(calendar, attrs) do
    calendar
    |> cast(attrs, [
      :name,
      :timezone,
      :default_playlist_id,
      :description,
      :organization_id,
      :resource_id
    ])
    |> validate_required([:name, :timezone, :organization_id])
    |> foreign_key_constraint(:default_playlist_id, name: :calendars_default_playlist_id_fkey)
  end

  def base_query() do
    from(calendar in Castmill.Resources.Calendar, as: :calendar)
  end
end

defimpl Jason.Encoder, for: Castmill.Resources.Calendar do
  def encode(%Castmill.Resources.Calendar{} = calendar, opts) do
    entries =
      case calendar.entries do
        %Ecto.Association.NotLoaded{} -> []
        entries -> entries
      end

    map = %{
      id: calendar.id,
      name: calendar.name,
      timezone: calendar.timezone,
      default_playlist_id: calendar.default_playlist_id,
      entries: entries
    }

    Jason.Encode.map(map, opts)
  end
end
