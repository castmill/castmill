defmodule Castmill.StorageCleanups.StorageCleanup do
  @moduledoc "A stored object waiting to be deleted (see `Castmill.StorageCleanups`)."
  use Castmill.Schema
  import Ecto.Changeset

  @kinds ~w(file feed_media widget_assets)

  schema "storage_cleanups" do
    field :kind, :string
    field :data, :map
    field :attempts, :integer, default: 0
    field :last_error, :string

    timestamps()
  end

  @doc false
  def changeset(cleanup, attrs) do
    cleanup
    |> cast(attrs, [:kind, :data, :attempts, :last_error])
    |> validate_required([:kind, :data])
    |> validate_inclusion(:kind, @kinds)
  end
end
