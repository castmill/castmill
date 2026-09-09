defmodule Castmill.Resources.Layout do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @behaviour Castmill.Behaviour.Filterable

  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :description,
             :aspect_ratio,
             :zones,
             :is_system,
             :organization_id,
             :inserted_at,
             :updated_at
           ]}

  @doc """
  Layout schema for storing reusable layout configurations.

  A layout defines a visual arrangement of zones that can be used by widgets
  to display content. Each zone can be assigned a playlist.

  ## Fields
    - name: Human-readable name for the layout
    - description: Optional description of the layout
    - aspect_ratio: String like "16:9", "9:16", "4:3"
    - zones: Map containing the zones array with position/size data

  ## Zones Structure
  The zones field contains a map with a "zones" key that is an array of zone objects:
  ```
  %{
    "zones" => [
      %{
        "id" => "zone-1",
        "name" => "Zone 1",
        "rect" => %{"x" => 0, "y" => 0, "width" => 50, "height" => 100},
        "zIndex" => 1
      },
      ...
    ]
  }
  ```
  """

  schema "layouts" do
    field(:name, :string)
    field(:description, :string)
    field(:aspect_ratio, :string, default: "16:9")
    field(:zones, :map, default: %{"zones" => []})
    field(:is_system, :boolean, default: false)

    belongs_to(:organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID
    )

    timestamps()
  end

  @doc false
  def changeset(layout, attrs) do
    layout
    |> cast(attrs, [:name, :description, :aspect_ratio, :zones, :organization_id, :is_system])
    |> validate_required([:name])
    |> validate_organization_or_system()
    |> validate_aspect_ratio()
    |> validate_zones()
  end

  @doc """
  Returns the base query for layouts.
  Used by the generic resource listing functions.
  """
  def base_query() do
    from(layout in __MODULE__, as: :resource)
  end

  @doc """
  Returns a query that includes both organization-specific layouts and system layouts.
  This overrides the standard where_org_id behavior to include is_system layouts.
  """
  def where_org_id_or_system(query, nil), do: query
  def where_org_id_or_system(query, ""), do: query

  def where_org_id_or_system(query, org_id) do
    from(l in query,
      where: l.organization_id == ^org_id or l.is_system == true
    )
  end

  # Validates the aspect_ratio format (should be like "16:9")
  defp validate_aspect_ratio(changeset) do
    aspect_ratio = get_field(changeset, :aspect_ratio)

    if aspect_ratio do
      case parse_aspect_ratio(aspect_ratio) do
        {:ok, _width, _height} ->
          changeset

        :error ->
          add_error(changeset, :aspect_ratio, "must be in format 'width:height' (e.g., '16:9')")
      end
    else
      changeset
    end
  end

  defp parse_aspect_ratio(ratio) when is_binary(ratio) do
    case String.split(ratio, ":") do
      [w, h] ->
        with {width, ""} <- Integer.parse(w),
             {height, ""} <- Integer.parse(h),
             true <- width > 0 and height > 0 do
          {:ok, width, height}
        else
          _ -> :error
        end

      _ ->
        :error
    end
  end

  defp parse_aspect_ratio(_), do: :error

  # Validates the zones structure
  defp validate_zones(changeset) do
    zones = get_field(changeset, :zones)

    cond do
      is_nil(zones) ->
        changeset

      not is_map(zones) ->
        add_error(changeset, :zones, "must be a map")

      not Map.has_key?(zones, "zones") ->
        add_error(changeset, :zones, "must contain a 'zones' key")

      not is_list(zones["zones"]) ->
        add_error(changeset, :zones, "'zones' must be a list")

      not validate_zone_list(zones["zones"]) ->
        add_error(
          changeset,
          :zones,
          "each zone must have id, name, rect (with x, y, width, height), and zIndex"
        )

      true ->
        changeset
    end
  end

  defp validate_zone_list(zones) when is_list(zones) do
    Enum.all?(zones, &valid_zone?/1)
  end

  defp validate_zone_list(_), do: false

  defp valid_zone?(zone) when is_map(zone) do
    has_id = is_binary(zone["id"])
    has_name = is_binary(zone["name"])
    has_z_index = is_number(zone["zIndex"])

    has_rect =
      is_map(zone["rect"]) and
        is_number(zone["rect"]["x"]) and
        is_number(zone["rect"]["y"]) and
        is_number(zone["rect"]["width"]) and
        is_number(zone["rect"]["height"])

    has_id and has_name and has_z_index and has_rect
  end

  defp valid_zone?(_), do: false

  # Validates that a layout has either an organization_id or is a system layout
  defp validate_organization_or_system(changeset) do
    is_system = get_field(changeset, :is_system, false)
    organization_id = get_field(changeset, :organization_id)

    cond do
      is_system ->
        # System layouts don't need an organization
        changeset

      is_nil(organization_id) ->
        add_error(changeset, :organization_id, "is required for non-system layouts")

      true ->
        changeset
    end
  end

  # Filterable implementation
  @impl Castmill.Behaviour.Filterable
  def apply_filter({"search", search}) when is_binary(search) and search != "" do
    search_term = "%#{search}%"
    dynamic([l], ilike(l.name, ^search_term) or ilike(l.description, ^search_term))
  end

  def apply_filter({"aspect_ratio", aspect_ratio})
      when is_binary(aspect_ratio) and aspect_ratio != "" do
    dynamic([l], l.aspect_ratio == ^aspect_ratio)
  end

  def apply_filter(_), do: nil

  @doc """
  Converts the layout to a format suitable for the player.
  Returns the zones in the format expected by the widget.
  """
  def to_player_format(%__MODULE__{} = layout) do
    %{
      "aspectRatio" => layout.aspect_ratio,
      "zones" => layout.zones["zones"] || []
    }
  end
end
