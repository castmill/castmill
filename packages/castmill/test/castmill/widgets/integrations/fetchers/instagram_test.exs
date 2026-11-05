defmodule Castmill.Widgets.Integrations.Fetchers.InstagramTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.Fetchers.Instagram

  describe "fetch/2 – credential validation" do
    test "returns error when access_token is missing" do
      credentials = %{}
      options = %{}

      assert {:error, :missing_access_token, ^credentials} =
               Instagram.fetch(credentials, options)
    end

    test "returns error when access_token is empty string" do
      credentials = %{"access_token" => ""}
      options = %{}

      assert {:error, :missing_access_token, ^credentials} =
               Instagram.fetch(credentials, options)
    end
  end

  describe "fetch/2 – max_posts option parsing" do
    test "returns error with missing token regardless of max_posts" do
      assert {:error, :missing_access_token, _} =
               Instagram.fetch(%{}, %{"max_posts" => 5})
    end

    test "returns error with missing token when max_posts is a string" do
      assert {:error, :missing_access_token, _} =
               Instagram.fetch(%{}, %{"max_posts" => "20"})
    end

    test "returns error with missing token when max_posts exceeds maximum" do
      assert {:error, :missing_access_token, _} =
               Instagram.fetch(%{}, %{"max_posts" => 999})
    end
  end

  describe "token_action/2" do
    @now 1_700_000_000
    @day 24 * 60 * 60

    test "exchanges short-lived OAuth tokens stored under expires_at" do
      credentials = %{
        "access_token" => "short",
        "client_secret" => "secret",
        "expires_at" => @now + 3600
      }

      assert Instagram.token_action(credentials, @now) == :exchange
    end

    test "cannot exchange a short-lived token without the app secret" do
      credentials = %{"access_token" => "short", "expires_at" => @now + 3600}

      assert Instagram.token_action(credentials, @now) == :none
    end

    test "refreshes long-lived tokens that expire within 7 days" do
      credentials = %{
        "access_token" => "long",
        "expires_at" => @now + 3 * @day,
        "long_lived" => true
      }

      assert Instagram.token_action(credentials, @now) == :refresh
    end

    test "keeps long-lived tokens with plenty of time left" do
      credentials = %{"access_token" => "long", "expires_at" => @now + 50 * @day}

      assert Instagram.token_action(credentials, @now) == :none
    end

    test "honours the legacy token_expires_at key" do
      credentials = %{"access_token" => "long", "token_expires_at" => @now + @day}

      assert Instagram.token_action(credentials, @now) == :refresh
    end

    test "does nothing when the expiry is unknown" do
      assert Instagram.token_action(%{"access_token" => "token"}, @now) == :none
    end
  end

  describe "format_timestamp/1" do
    test "formats a valid ISO8601 timestamp" do
      assert Instagram.format_timestamp("2024-01-01T12:00:00+0000") == "Jan 1, 2024"
    end

    test "formats a February timestamp correctly" do
      assert Instagram.format_timestamp("2023-02-14T10:30:00+0000") == "Feb 14, 2023"
    end

    test "formats a December timestamp correctly" do
      assert Instagram.format_timestamp("2024-12-25T00:00:00+0000") == "Dec 25, 2024"
    end

    test "returns empty string for nil input" do
      assert Instagram.format_timestamp(nil) == ""
    end

    test "returns the original string for an invalid timestamp" do
      assert Instagram.format_timestamp("not-a-date") == "not-a-date"
    end

    test "returns empty string for a non-string non-nil input" do
      assert Instagram.format_timestamp(12345) == ""
    end
  end
end
