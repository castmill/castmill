defmodule Server.CalendarEntry do
  use Ecto.Schema
  import Ecto.Changeset

  schema "calendar_entries" do
    field :end, :date
    field :repeat_weekly, :boolean, default: false
    field :start, :date

    timestamps()
  end

  @doc false
  def changeset(calendar_entry, attrs) do
    calendar_entry
    |> cast(attrs, [:start, :end, :repeat_weekly])
    |> validate_required([:start, :end, :repeat_weekly])
  end
end
