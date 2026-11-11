defmodule Castmill.Automations.Automation do
  @moduledoc """
  An automation: an organization-scoped, ordered list of rules of the form
  "when an event happens, then do an action". See `Castmill.Automations` and
  `agents/systems/AUTOMATIONS.md`.
  """
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @behaviour Castmill.Behaviour.Filterable

  @derive {Jason.Encoder,
           only: [:id, :name, :enabled, :rules, :organization_id, :inserted_at, :updated_at]}

  schema "automations" do
    field(:name, :string)
    field(:enabled, :boolean, default: true)
    field(:rules, {:array, :map}, default: [])

    belongs_to(:organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID
    )

    has_many(:automations_devices, Castmill.Automations.AutomationsDevices,
      preload_order: [asc: :position]
    )

    has_many(:automations_channels, Castmill.Automations.AutomationsChannels,
      preload_order: [asc: :position]
    )

    timestamps()
  end

  @doc false
  def changeset(automation, attrs) do
    automation
    |> cast(attrs, [:name, :enabled, :organization_id])
    |> put_rules(attrs)
    |> validate_required([:name, :organization_id])
    |> validate_length(:name, min: 1, max: 255)
    |> foreign_key_constraint(:organization_id)
  end

  defp put_rules(changeset, attrs) do
    case fetch_rules(attrs) do
      :error ->
        changeset

      {:ok, rules} ->
        case Castmill.Automations.Rule.validate_rules(rules) do
          {:ok, rules} -> put_change(changeset, :rules, rules)
          {:error, errors} -> Enum.reduce(errors, changeset, &add_error(&2, :rules, &1))
        end
    end
  end

  defp fetch_rules(attrs) when is_map(attrs) do
    case attrs do
      %{"rules" => rules} -> {:ok, rules}
      %{rules: rules} -> {:ok, rules}
      _ -> :error
    end
  end

  def base_query do
    from(automation in __MODULE__, as: :automation)
  end

  def bare_query do
    from(automation in __MODULE__)
  end

  @impl Castmill.Behaviour.Filterable
  def apply_filter({"search", search}) when is_binary(search) and search != "" do
    search_term = "%#{search}%"
    dynamic([a], ilike(a.name, ^search_term))
  end

  def apply_filter(_), do: nil
end
