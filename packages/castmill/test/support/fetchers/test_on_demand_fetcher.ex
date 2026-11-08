defmodule Castmill.Widgets.Integrations.Fetchers.TestOnDemand do
  @moduledoc false
  # Test fetcher for on-demand refresh. Counts calls and can be told to fail,
  # through an Agent started by the test (see Castmill.Widgets.Integrations.RefreshTest).

  use Agent

  def start_link(_opts \\ []),
    do:
      Agent.start_link(fn -> %{calls: [], fail: nil, exception: nil, respond: nil, sleep: 0} end,
        name: __MODULE__
      )

  def fail_with(reason), do: Agent.update(__MODULE__, &%{&1 | fail: reason})
  def raise_with(reason), do: Agent.update(__MODULE__, &%{&1 | exception: reason})
  # Return this exact value instead of a normal result.
  def respond_with(value), do: Agent.update(__MODULE__, &%{&1 | respond: value})
  def sleep_for(ms), do: Agent.update(__MODULE__, &%{&1 | sleep: ms})
  def calls, do: Agent.get(__MODULE__, &Enum.reverse(&1.calls))

  def fetch(credentials, options) do
    %{fail: fail, exception: exception, calls: calls, respond: respond, sleep: sleep} =
      Agent.get_and_update(__MODULE__, fn state ->
        {state, %{state | calls: [options | state.calls]}}
      end)

    if sleep > 0, do: Process.sleep(sleep)

    cond do
      exception -> raise RuntimeError, exception
      respond -> respond
      fail -> {:error, fail, credentials}
      true -> {:ok, %{"value" => length(calls) + 1, "query" => options["query"]}, credentials}
    end
  end
end
