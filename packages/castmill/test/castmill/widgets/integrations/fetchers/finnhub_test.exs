defmodule Castmill.Widgets.Integrations.Fetchers.FinnhubTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.Fetchers.Finnhub

  describe "fetch/2" do
    test "returns error when API key is missing" do
      credentials = %{}
      options = %{"symbols" => "AAPL"}

      assert {:error, :missing_api_key, ^credentials} = Finnhub.fetch(credentials, options)
    end

    test "returns error when API key is empty" do
      credentials = %{"api_key" => ""}
      options = %{"symbols" => "AAPL"}

      assert {:error, :missing_api_key, ^credentials} = Finnhub.fetch(credentials, options)
    end
  end

  describe "symbol parsing" do
    # We test this indirectly through the module's behavior
    # The actual symbol parsing is private, but we can verify it works through integration tests
  end

  describe "data transformation" do
    # These are internal functions, tested through integration tests
    # or we can test them if we expose them as public functions
  end
end
