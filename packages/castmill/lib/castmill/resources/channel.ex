defmodule Castmill.Resources.Channel do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "channels" do
    field(:description, :string)
    field(:name, :string)
    field(:timezone, :string)

    belongs_to(:playlist, Castmill.Resources.Playlist, foreign_key: :default_playlist_id)

    belongs_to(:organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID
    )

    has_many(:entries, Castmill.Resources.ChannelEntry)

    timestamps()
  end

  @doc false
  def changeset(channel, attrs) do
    channel
    |> cast(attrs, [
      :name,
      :timezone,
      :default_playlist_id,
      :description,
      :organization_id
    ])
    |> validate_required([:name, :timezone, :organization_id])
    |> validate_timezone(:timezone)
    |> foreign_key_constraint(:default_playlist_id, name: :channels_default_playlist_id_fkey)
  end

  defp validate_timezone(changeset, field) do
    timezone = get_field(changeset, field)

    if timezone && not valid_timezone?(timezone) do
      add_error(changeset, field, "is not a valid timezone")
    else
      changeset
    end
  end

  # Helper function to check if a timezone is valid
  defp valid_timezone?(timezone) do
    case DateTime.shift_zone(DateTime.utc_now(), timezone) do
      {:ok, _} ->
        true

      {:error, err} ->
        IO.inspect("Invalid timezone: #{timezone} - #{inspect(err)}")
        false
    end
  end

  def base_query() do
    from(channel in Castmill.Resources.Channel, as: :channel)
  end
end

defimpl Jason.Encoder, for: Castmill.Resources.Channel do
  def encode(%Castmill.Resources.Channel{} = channel, opts) do
    entries =
      case channel.entries do
        %Ecto.Association.NotLoaded{} -> []
        entries -> entries
      end

    map = %{
      id: channel.id,
      name: channel.name,
      timezone: channel.timezone,
      default_playlist_id: channel.default_playlist_id,
      entries: entries
    }

    Jason.Encode.map(map, opts)
  end
end
