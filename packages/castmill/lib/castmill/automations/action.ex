defmodule Castmill.Automations.Action do
  @moduledoc """
  Behaviour for automation actions (the "then" side of a rule).

  Actions run on the device. The server validates their configuration, tells
  which condition kinds they support, and which resources they reference (for
  referential integrity, device access and preloading).

  Register new actions with `config :castmill, :automation_actions, [...]`.
  See `agents/systems/AUTOMATIONS.md`.
  """

  @doc "Unique type name, e.g. \"interrupt\"."
  @callback type() :: String.t()

  @doc "Validates an action configuration and returns it normalized (defaults applied)."
  @callback validate_config(config :: map()) :: {:ok, map()} | {:error, String.t()}

  @doc "Whether the action can be triggered by a condition of the given kind."
  @callback supports(kind :: Castmill.Automations.Source.kind()) :: boolean()

  @doc """
  Resources referenced by a (validated) configuration, grouped by type, e.g.
  `%{playlists: [12]}`.
  """
  @callback referenced_resources(config :: map()) :: %{optional(atom()) => [term()]}

  @doc "Name that must appear in the device capabilities `automation_actions` list."
  @callback required_capability() :: String.t()
end
