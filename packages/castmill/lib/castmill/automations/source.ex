defmodule Castmill.Automations.Source do
  @moduledoc """
  Behaviour for automation event sources (the "when" side of a rule).

  A source is evaluated on the device. The server validates its configuration
  and builds the payload devices need to evaluate it (`device_payload/2`).

  Each source declares the conditions it offers. A condition is either an
  `:event` (fires once per occurrence) or a `:state` (active while true).

  Register new sources with `config :castmill, :automation_sources, [...]`.
  See `agents/systems/AUTOMATIONS.md`.
  """

  @type kind :: :event | :state
  @type condition :: %{name: String.t(), kind: kind()}
  @type payload_context :: %{timezone: String.t(), from: DateTime.t(), to: DateTime.t()}

  @doc "Unique type name, e.g. \"clock\"."
  @callback type() :: String.t()

  @doc "Conditions offered by this source."
  @callback conditions() :: [condition()]

  @doc "Validates a rule configuration and returns it normalized (defaults applied)."
  @callback validate_config(config :: map()) :: {:ok, map()} | {:error, String.t()}

  @doc "Builds what a device needs to evaluate the rule."
  @callback device_payload(config :: map(), context :: payload_context()) :: map()

  @doc "Name that must appear in the device capabilities `automation_sources` list."
  @callback required_capability() :: String.t()

  @doc """
  Optional: the next `count` instants (at or after `from`) at which an event
  condition fires, used for previews and "next firing" information in the
  dashboard.
  """
  @callback upcoming(
              config :: map(),
              timezone :: String.t(),
              from :: DateTime.t(),
              count :: non_neg_integer()
            ) :: [DateTime.t()]

  @optional_callbacks upcoming: 4
end
