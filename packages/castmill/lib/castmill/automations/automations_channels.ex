defmodule Castmill.Automations.AutomationsChannels do
  @moduledoc "Assignment of an automation to a channel, ordered by position."
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key false
  schema "automations_channels" do
    field(:position, :integer, default: 0)

    belongs_to(:automation, Castmill.Automations.Automation, primary_key: true)
    belongs_to(:channel, Castmill.Resources.Channel, primary_key: true)

    timestamps()
  end

  @doc false
  def changeset(assignment, attrs) do
    assignment
    |> cast(attrs, [:automation_id, :channel_id, :position])
    |> validate_required([:automation_id, :channel_id])
    |> unique_constraint([:automation_id, :channel_id], name: :automations_channels_pkey)
  end
end
