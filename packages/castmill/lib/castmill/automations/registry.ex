defmodule Castmill.Automations.Registry do
  @moduledoc """
  Registry of automation event sources and actions.

  Sources and actions are plugins: modules implementing
  `Castmill.Automations.Source` or `Castmill.Automations.Action`, listed in
  the application environment:

      config :castmill, :automation_sources, [Castmill.Automations.Sources.Clock]
      config :castmill, :automation_actions, [Castmill.Automations.Actions.Interrupt]

  Adding a type requires no change to the data model, the device engine or
  the dashboard pages.
  """

  @default_sources [Castmill.Automations.Sources.Clock]
  @default_actions [Castmill.Automations.Actions.Interrupt]

  @doc "All registered source modules."
  def sources, do: Application.get_env(:castmill, :automation_sources, @default_sources)

  @doc "All registered action modules."
  def actions, do: Application.get_env(:castmill, :automation_actions, @default_actions)

  @doc "Finds a source module by type."
  def source(type) when is_binary(type), do: Enum.find(sources(), &(&1.type() == type))
  def source(_type), do: nil

  @doc "Finds an action module by type."
  def action(type) when is_binary(type), do: Enum.find(actions(), &(&1.type() == type))
  def action(_type), do: nil

  @doc "Returns the kind (`:event` or `:state`) of a source condition, or nil."
  def condition_kind(source_module, condition) do
    source_module.conditions()
    |> Enum.find(&(&1.name == condition))
    |> case do
      nil -> nil
      %{kind: kind} -> kind
    end
  end

  @doc "JSON-friendly description of the registry for the dashboard."
  def describe do
    %{
      sources:
        Enum.map(sources(), fn source ->
          %{
            type: source.type(),
            conditions: Enum.map(source.conditions(), &%{name: &1.name, kind: &1.kind}),
            required_capability: source.required_capability()
          }
        end),
      actions:
        Enum.map(actions(), fn action ->
          %{
            type: action.type(),
            supports: Enum.filter([:event, :state], &action.supports/1),
            required_capability: action.required_capability()
          }
        end)
    }
  end
end
