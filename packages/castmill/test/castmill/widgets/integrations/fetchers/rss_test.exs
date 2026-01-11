defmodule Castmill.Widgets.Integrations.Fetchers.RssTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.Fetchers.Rss

  describe "fetch/2" do
    test "returns error when feed_url is missing" do
      credentials = %{}
      options = %{}

      assert {:error, :missing_feed_url, ^credentials} = Rss.fetch(credentials, options)
    end

    test "returns error when feed_url is empty" do
      credentials = %{}
      options = %{"feed_url" => ""}

      assert {:error, :missing_feed_url, ^credentials} = Rss.fetch(credentials, options)
    end
  end
end
