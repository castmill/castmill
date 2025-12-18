defmodule Castmill.Resources.Playlist do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @behaviour Castmill.Behaviour.Filterable

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
    |> validate_aspect_ratio()
  end

  # Validates the aspect_ratio in settings if present
  defp validate_aspect_ratio(changeset) do
    settings = get_field(changeset, :settings)

    if settings && Map.has_key?(settings, "aspect_ratio") do
      aspect_ratio = Map.get(settings, "aspect_ratio")
      validate_aspect_ratio_value(changeset, aspect_ratio)
    else
      changeset
    end
  end

  defp validate_aspect_ratio_value(changeset, aspect_ratio) when is_map(aspect_ratio) do
    width = Map.get(aspect_ratio, "width")
    height = Map.get(aspect_ratio, "height")

    cond do
      # Both width and height must be present
      is_nil(width) or is_nil(height) ->
        add_error(changeset, :settings, "aspect_ratio must have both width and height")

      # Must be positive integers
      not is_integer(width) or not is_integer(height) or width <= 0 or height <= 0 ->
        add_error(changeset, :settings, "aspect_ratio width and height must be positive integers")

      # Prevent absurdly thin ratios (e.g., 100:1 or 1:100)
      width / height > 10 or height / width > 10 ->
        add_error(
          changeset,
          :settings,
          "aspect_ratio is too extreme (max ratio is 10:1)"
        )

      # Prevent unnecessarily large numbers (use GCD to simplify)
      width > 100 or height > 100 ->
        add_error(
          changeset,
          :settings,
          "aspect_ratio values must be 100 or less (use simplified ratios like 16:9)"
        )

      true ->
        changeset
    end
  end

  defp validate_aspect_ratio_value(changeset, _invalid) do
    add_error(
      changeset,
      :settings,
      "aspect_ratio must be a map with width and height fields"
    )
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

  @doc """
  Filter to exclude specific playlist IDs.
  Accepts comma-separated IDs string: "exclude_ids:1,2,3"
  """
  @impl Castmill.Behaviour.Filterable
  def apply_filter({"exclude_ids", ids_string}) when is_binary(ids_string) do
    ids =
      ids_string
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.filter(&(&1 != ""))
      |> Enum.map(fn id_str ->
        case Integer.parse(id_str) do
          {id, ""} -> id
          _ -> nil
        end
      end)
      |> Enum.filter(&(&1 != nil))

    if Enum.empty?(ids) do
      nil
    else
      dynamic([playlist: p], p.id not in ^ids)
    end
  end

  def apply_filter(_), do: nil
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
