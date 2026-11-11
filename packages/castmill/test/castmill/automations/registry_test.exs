defmodule Castmill.Automations.RegistryTest do
  # Changes the application environment.
  use ExUnit.Case, async: false

  alias Castmill.Automations.{Registry, Rule}
  alias Castmill.Automations.Actions.Interrupt
  alias Castmill.Automations.Sources.Clock

  # A stub state source (e.g. a future "signal" source), proving that new
  # sources are plugins: no data model, engine or page change needed.
  defmodule StubSource do
    @behaviour Castmill.Automations.Source

    @impl true
    def type, do: "stub_signal"

    @impl true
    def conditions, do: [%{name: "received", kind: :event}, %{name: "active", kind: :state}]

    @impl true
    def validate_config(%{"key" => key}) when is_binary(key), do: {:ok, %{"key" => key}}
    def validate_config(_), do: {:error, "key is required"}

    @impl true
    def device_payload(config, _context), do: %{"key" => config["key"]}

    @impl true
    def required_capability, do: "stub_signal"
  end

  # A stub action that only supports state conditions (like a future
  # "switch_channel").
  defmodule StubAction do
    @behaviour Castmill.Automations.Action

    @impl true
    def type, do: "stub_switch"

    @impl true
    def validate_config(%{"channel_id" => id}) when is_integer(id),
      do: {:ok, %{"channel_id" => id}}

    def validate_config(_), do: {:error, "channel_id is required"}

    @impl true
    def supports(kind), do: kind == :state

    @impl true
    def referenced_resources(_config), do: %{}

    @impl true
    def required_capability, do: "stub_switch"
  end

  setup do
    sources = Application.get_env(:castmill, :automation_sources)
    actions = Application.get_env(:castmill, :automation_actions)

    on_exit(fn ->
      restore(:automation_sources, sources)
      restore(:automation_actions, actions)
    end)
  end

  defp restore(key, nil), do: Application.delete_env(:castmill, key)
  defp restore(key, value), do: Application.put_env(:castmill, key, value)

  defp register_stubs do
    Application.put_env(:castmill, :automation_sources, [Clock, StubSource])
    Application.put_env(:castmill, :automation_actions, [Interrupt, StubAction])
  end

  defp clock_rule(extra \\ %{}) do
    Map.merge(
      %{
        "when" => %{
          "source" => "clock",
          "condition" => "at",
          "config" => %{"schedule" => %{"type" => "hourly", "minute" => 8}}
        },
        "then" => %{"action" => "interrupt", "config" => %{"playlist_id" => 12}}
      },
      extra
    )
  end

  describe "registry" do
    test "registers clock and interrupt by default" do
      Application.delete_env(:castmill, :automation_sources)
      Application.delete_env(:castmill, :automation_actions)

      assert Registry.source("clock") == Clock
      assert Registry.action("interrupt") == Interrupt
      assert Registry.source("stub_signal") == nil
      assert Registry.source(nil) == nil
      assert Registry.action(1) == nil
      assert Registry.condition_kind(Clock, "at") == :event
      assert Registry.condition_kind(Clock, "nope") == nil

      assert %{
               sources: [%{type: "clock", conditions: [%{name: "at", kind: :event}]}],
               actions: [%{type: "interrupt", supports: [:event, :state]}]
             } = Registry.describe()
    end

    test "new sources and actions are plugins registered in the app env" do
      register_stubs()

      assert Registry.source("stub_signal") == StubSource
      assert Registry.action("stub_switch") == StubAction

      assert {:ok, rule} =
               Rule.validate(%{
                 "when" => %{
                   "source" => "stub_signal",
                   "condition" => "active",
                   "config" => %{"key" => "fire"}
                 },
                 "then" => %{"action" => "stub_switch", "config" => %{"channel_id" => 3}}
               })

      assert rule["when"] == %{
               "source" => "stub_signal",
               "condition" => "active",
               "config" => %{"key" => "fire"}
             }

      # The interrupt action supports state conditions too.
      assert {:ok, _} =
               Rule.validate(%{
                 "when" => %{
                   "source" => "stub_signal",
                   "condition" => "active",
                   "config" => %{"key" => "fire"}
                 },
                 "then" => %{"action" => "interrupt", "config" => %{"playlist_id" => 1}}
               })

      # The stub action does not support event conditions.
      assert {:error, message} =
               Rule.validate(%{
                 "when" => %{
                   "source" => "stub_signal",
                   "condition" => "received",
                   "config" => %{"key" => "fire"}
                 },
                 "then" => %{"action" => "stub_switch", "config" => %{"channel_id" => 3}}
               })

      assert message =~ "does not support event conditions"

      assert Rule.required_capabilities(rule) == %{source: "stub_signal", action: "stub_switch"}
      assert Rule.referenced_resources(rule) == %{}
    end
  end

  describe "rule validation" do
    test "normalizes a rule, assigning an id and defaults" do
      assert {:ok, rule} = Rule.validate(clock_rule())
      assert is_binary(rule["id"])
      assert rule["cooldown_seconds"] == 0

      assert rule["then"]["config"] == %{
               "playlist_id" => 12,
               "start" => "immediately",
               "max_wait_seconds" => 120,
               "plays" => 1,
               "priority" => "normal"
             }
    end

    test "keeps a valid id, accepts atom keys and fills the default condition" do
      assert {:ok, rule} =
               Rule.validate(%{
                 id: "rule-1",
                 when: %{source: "clock", config: %{schedule: %{type: "hourly", minute: 1}}},
                 then: %{action: "interrupt", config: %{playlist_id: "7"}},
                 cooldown_seconds: 300
               })

      assert rule["id"] == "rule-1"
      assert rule["when"]["condition"] == "at"
      assert rule["then"]["config"]["playlist_id"] == 7
      assert rule["cooldown_seconds"] == 300
    end

    test "reports errors with the rule position" do
      assert {:error, errors} =
               Rule.validate_rules([
                 clock_rule(),
                 clock_rule(%{"when" => %{"source" => "gps"}}),
                 clock_rule(%{"then" => %{"action" => "explode"}}),
                 clock_rule(%{"cooldown_seconds" => -1}),
                 clock_rule(%{"id" => "bad id!"}),
                 clock_rule(%{"when" => %{"source" => "clock", "condition" => "enter"}}),
                 clock_rule(%{"then" => %{"action" => "interrupt", "config" => %{}}}),
                 clock_rule(%{"when" => %{"source" => "clock", "config" => %{}}}),
                 %{"when" => nil},
                 "nope"
               ])

      assert [
               "rule 2: when.source 'gps' is not supported",
               "rule 3: then.action 'explode' is not supported",
               "rule 4: cooldown_seconds" <> _,
               "rule 5: id contains invalid characters",
               "rule 6: when.condition 'enter' is not supported by clock",
               "rule 7: then.config: playlist_id is required",
               "rule 8: when.config: " <> _,
               "rule 9: when.source is required",
               "rule 10: rule must be an object"
             ] = errors
    end

    test "rejects duplicate ids, too many rules and non-lists" do
      assert {:error, ["rule 2: duplicate rule id"]} =
               Rule.validate_rules([clock_rule(%{"id" => "a"}), clock_rule(%{"id" => "a"})])

      assert {:error, [message]} = Rule.validate_rules(List.duplicate(clock_rule(), 51))
      assert message =~ "at most 50"
      assert {:error, ["rules must be a list"]} = Rule.validate_rules(%{})
      assert {:ok, []} = Rule.validate_rules([])
    end

    test "lists referenced playlists" do
      {:ok, rules} =
        Rule.validate_rules([
          clock_rule(),
          clock_rule(%{"then" => %{"action" => "interrupt", "config" => %{"playlist_id" => 3}}}),
          clock_rule()
        ])

      assert Rule.referenced_playlist_ids(rules) == [12, 3]
      assert Rule.referenced_resources(%{}) == %{}
    end
  end

  describe "interrupt action" do
    test "validates its configuration" do
      assert Interrupt.supports(:event)
      assert Interrupt.supports(:state)
      assert Interrupt.type() == "interrupt"
      assert Interrupt.required_capability() == "interrupt"

      assert {:ok,
              %{
                "playlist_id" => 5,
                "start" => "after_current_item",
                "max_wait_seconds" => 30,
                "plays" => 3,
                "priority" => "high"
              }} =
               Interrupt.validate_config(%{
                 "playlist_id" => 5,
                 "start" => "after_current_item",
                 "max_wait_seconds" => 30,
                 "plays" => 3,
                 "priority" => "high"
               })

      for invalid <- [
            nil,
            %{},
            %{"playlist_id" => 0},
            %{"playlist_id" => "x"},
            %{"playlist_id" => 1, "start" => "later"},
            %{"playlist_id" => 1, "priority" => "urgent"},
            %{"playlist_id" => 1, "plays" => 0},
            %{"playlist_id" => 1, "plays" => 101},
            %{"playlist_id" => 1, "max_wait_seconds" => -1},
            %{"playlist_id" => 1, "max_wait_seconds" => 3601}
          ] do
        assert {:error, _} = Interrupt.validate_config(invalid), inspect(invalid)
      end

      assert Interrupt.referenced_resources(%{"playlist_id" => 5}) == %{playlists: [5]}
      assert Interrupt.referenced_resources(%{}) == %{playlists: []}
    end
  end
end
