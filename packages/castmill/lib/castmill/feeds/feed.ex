defmodule Castmill.Feeds.Feed do
  @moduledoc """
  An organization resource that external systems write data to and widgets read
  from. See agents/systems/DATA-FEEDS.md.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @modes ~w(list document)
  @media_modes ~w(copy link)
  # e.g. "image", "post.photo", "attachments[].url"
  @media_path ~r/^[A-Za-z0-9_-]+(\[\])?(\.[A-Za-z0-9_-]+(\[\])?)*$/

  @derive {Jason.Encoder,
           only: [
             :id,
             :organization_id,
             :name,
             :description,
             :mode,
             :keep,
             :schema,
             :media_fields,
             :version,
             :data_updated_at,
             :inserted_at,
             :updated_at
           ]}
  schema "feeds" do
    field(:name, :string)
    field(:description, :string)
    field(:mode, :string, default: "list")
    field(:keep, :integer, default: 10)
    field(:schema, :map)
    field(:media_fields, {:array, :map}, default: [])
    field(:document, :map)
    field(:version, :integer, default: 1)
    field(:data_updated_at, :utc_datetime_usec)

    belongs_to(:organization, Castmill.Organizations.Organization, type: :binary_id)
    has_many(:entries, Castmill.Feeds.FeedEntry)
    has_many(:tokens, Castmill.Feeds.FeedToken)

    timestamps()
  end

  def modes, do: @modes

  @doc false
  def changeset(feed, attrs) do
    feed
    |> cast(attrs, [:name, :description, :mode, :keep, :schema, :media_fields])
    |> update_change(:name, &String.trim/1)
    |> validate_required([:name, :mode, :keep])
    |> validate_length(:name, max: 120)
    |> validate_length(:description, max: 2_000)
    |> validate_inclusion(:mode, @modes)
    |> validate_number(:keep, greater_than_or_equal_to: 1, less_than_or_equal_to: 100)
    |> validate_entry_schema()
    |> validate_media_fields()
    |> unique_constraint([:organization_id, :name], error_key: :name)
    |> check_constraint(:mode, name: :feeds_mode_check)
    |> check_constraint(:keep, name: :feeds_keep_check)
  end

  @doc false
  def create_changeset(feed, organization_id, attrs) do
    feed
    |> changeset(attrs)
    |> put_change(:organization_id, organization_id)
    |> validate_required([:organization_id])
  end

  defp validate_entry_schema(changeset) do
    validate_change(changeset, :schema, fn :schema, schema ->
      case Castmill.Widgets.Schema.validate_schema(schema) do
        {:ok, _} -> []
        {:error, message} -> [schema: message]
      end
    end)
  end

  defp validate_media_fields(changeset) do
    validate_change(changeset, :media_fields, fn :media_fields, fields ->
      cond do
        length(fields) > 20 ->
          [media_fields: "can have at most 20 fields"]

        not Enum.all?(fields, &valid_media_field?/1) ->
          [
            media_fields:
              ~s(must be objects like {"path": "image", "mode": "copy"}; mode is copy or link)
          ]

        true ->
          paths = Enum.map(fields, &media_path/1)

          if length(Enum.uniq(paths)) == length(paths),
            do: [],
            else: [media_fields: "paths must be unique"]
      end
    end)
  end

  defp media_path(field), do: field["path"] || field[:path]

  defp valid_media_field?(field) when is_map(field) do
    path = media_path(field)
    mode = field["mode"] || field[:mode] || "copy"
    allowed = ["path", "mode", :path, :mode]

    is_binary(path) and String.length(path) <= 200 and Regex.match?(@media_path, path) and
      mode in @media_modes and Enum.all?(Map.keys(field), &(&1 in allowed))
  end

  defp valid_media_field?(_field), do: false
end
