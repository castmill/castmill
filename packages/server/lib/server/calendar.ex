defmodule Server.Calendar do
  use Ecto.Schema
  import Ecto.Changeset

  schema "calendars" do
    field :default_playlist_id, :string
    field :description, :string
    field :name, :string
    field :timezone, :string

    belongs_to :organization, Server.Organization

    has_many :calendar_entries , Server.CalendarEntry

    timestamps()
  end

  @doc false
  def changeset(calendar, attrs) do
    calendar
    |> cast(attrs, [:name, :timezone, :default_playlist_id, :description])
    |> validate_required([:name, :timezone, :default_playlist_id, :description])
  end
end
