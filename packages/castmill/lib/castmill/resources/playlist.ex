defmodule Castmill.Resources.Playlist do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "playlists" do
    field(:name, :string)
    field(:status, Ecto.Enum, values: [:draft, :live])

    # Settings will hold stuff like
    # volume, loop, aspect ratio, auto_zoom,
    field(:settings, :map)

    belongs_to(:organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID
    )

    many_to_many(
      :items,
      Castmill.Widgets.WidgetConfig,
      join_through: "playlists_items",
      on_replace: :delete
    )

    timestamps()
  end

  @doc false
  def changeset(playlist, attrs) do
    playlist
    |> cast(attrs, [:name, :settings, :organization_id])
    |> validate_required([:name, :organization_id])
  end

  @doc """
  A bare query with no named binding, used where you need a pinned query
  or want to avoid compile-time binding conflicts.
  """
  def bare_query do
    from(m in __MODULE__)
  end

  def base_query() do
    from(playlist in Castmill.Resources.Playlist, as: :playlist)
  end
end

defimpl Jason.Encoder, for: Castmill.Resources.Playlist do
  def encode(%Castmill.Resources.Playlist{} = playlist, opts) do
    items =
      case playlist.items do
        %Ecto.Association.NotLoaded{} -> []
        items -> items
      end

    map = %{
      id: playlist.id,
      name: playlist.name,
      items: items,
      settings: playlist.settings,
      status: playlist.status,
      inserted_at: playlist.inserted_at,
      updated_at: playlist.updated_at
    }

    Jason.Encode.map(map, opts)
  end
end
