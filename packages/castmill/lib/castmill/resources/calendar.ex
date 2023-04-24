defmodule Castmill.Resources.Calendar do
  use Ecto.Schema
  import Ecto.Changeset

  schema "calendars" do
    field :default_playlist_id, :string
    field :description, :string
    field :name, :string
    field :timezone, :string

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID
    belongs_to :resource, Castmill.Resources.Resource, foreign_key: :resource_id

    has_many :calendar_entries , Castmill.Resources.CalendarEntry

    timestamps()
  end

  @doc false
  def changeset(calendar, attrs) do
    calendar
    |> cast(attrs, [:name, :timezone, :default_playlist_id, :description, :organization_id, :resource_id])
    |> validate_required([:name, :timezone, :organization_id])
  end
end
