defmodule Castmill.Widgets.Integrations.Fetchers.Finnhub do
  @moduledoc """
  Finnhub Stock API fetcher for Stock Ticker widget.

  Fetches real-time stock quotes from Finnhub API and transforms them to match
  the widget's data_schema with formatted values and change indicators.

  ## Features

  - Batch fetching of multiple stock symbols
  - Automatic formatting of prices and percentages
  - Change direction calculation (up/down/neutral)
  - Rate limiting awareness (60 calls/min on free tier)
  - Currency formatting with proper signs

  ## Required Credentials

  - `api_key`: Finnhub API key (free tier available)

  ## API Documentation

  - Quote endpoint: https://finnhub.io/docs/api/quote
  - Rate limits: https://finnhub.io/docs/api#rate-limits

  ## Data Transformation

  The fetcher transforms Finnhub's raw quote response:

      %{
        "c" => 175.50,      # Current price
        "d" => 2.35,        # Change
        "dp" => 1.36,       # Change percent
        "h" => 177.00,      # High
        "l" => 173.50,      # Low
        "o" => 174.00,      # Open
        "pc" => 173.15,     # Previous close
        "t" => 1703001600   # Timestamp
      }

  Into the widget's expected format:

      %{
        "symbol" => "AAPL",
        "price" => 175.50,
        "priceFormatted" => "$175.50",
        "change" => 2.35,
        "changeFormatted" => "+2.35",
        "changePercent" => 1.36,
        "changePercentFormatted" => "(+1.36%)",
        "changeDirection" => "up",
        "changeArrow" => "▲",
        ...
      }
  """
  @behaviour Castmill.Widgets.Integrations.Fetcher

  require Logger

  @api_base "https://finnhub.io/api/v1"

  @doc """
  Fetches stock quotes from Finnhub API.

  ## Parameters

  - `credentials`: Map containing `api_key`
  - `options`: Widget configuration options including `symbols` (comma-separated)

  ## Returns

  - `{:ok, data, credentials}`: Success with quotes array
  - `{:error, reason, credentials}`: Error with reason

  ## Examples

      iex> credentials = %{"api_key" => "your_finnhub_key"}
      iex> options = %{"symbols" => "AAPL,GOOGL,MSFT"}
      iex> Finnhub.fetch(credentials, options)
      {:ok, %{"quotes" => [...], "lastUpdated" => 1703001600}, credentials}
  """
  @impl true
  def fetch(credentials, options) do
    api_key = Map.get(credentials, "api_key")

    if !api_key || api_key == "" do
      {:error, :missing_api_key, credentials}
    else
      symbols =
        options
        |> Map.get("symbols", "AAPL,GOOGL,MSFT")
        |> parse_symbols()

      case fetch_quotes(symbols, api_key) do
        {:ok, quotes} ->
          data = %{
            "quotes" => quotes,
            "lastUpdated" => System.system_time(:second),
            "marketStatus" => determine_market_status()
          }

          {:ok, data, credentials}

        {:error, reason} ->
          Logger.error("Finnhub API error: #{inspect(reason)}")
          {:error, reason, credentials}
      end
    end
  end

  # ============================================================================
  # PRIVATE FUNCTIONS
  # ============================================================================

  defp parse_symbols(symbols_string) when is_binary(symbols_string) do
    symbols_string
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.map(&String.upcase/1)
    |> Enum.filter(&(&1 != ""))
    |> Enum.uniq()
    # Limit to 20 symbols to avoid rate limiting
    |> Enum.take(20)
  end

  defp parse_symbols(_), do: ["AAPL", "GOOGL", "MSFT"]

  defp fetch_quotes(symbols, api_key) do
    # Fetch quotes for each symbol
    # Note: Finnhub doesn't have a batch endpoint, so we fetch individually
    # In production, consider caching and staggering requests

    results =
      Enum.map(symbols, fn symbol ->
        case fetch_single_quote(symbol, api_key) do
          {:ok, quote_data} ->
            {:ok, transform_quote(symbol, quote_data)}

          {:error, reason} ->
            Logger.warning("Failed to fetch quote for #{symbol}: #{inspect(reason)}")
            {:error, symbol, reason}
        end
      end)

    # Collect successful quotes
    quotes =
      results
      |> Enum.filter(fn
        {:ok, _} -> true
        _ -> false
      end)
      |> Enum.map(fn {:ok, quote} -> quote end)

    if Enum.empty?(quotes) do
      {:error, :all_quotes_failed}
    else
      {:ok, quotes}
    end
  end

  defp fetch_single_quote(symbol, api_key) do
    url = "#{@api_base}/quote?symbol=#{URI.encode(symbol)}&token=#{api_key}"

    headers = [
      {"Accept", "application/json"},
      {"User-Agent", "Castmill/1.0"}
    ]

    case HTTPoison.get(url, headers, recv_timeout: 10_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, data} when is_map(data) ->
            # Check if we got valid data (c > 0 means valid quote)
            if Map.get(data, "c", 0) > 0 do
              {:ok, data}
            else
              {:error, :invalid_symbol}
            end

          {:ok, _} ->
            {:error, :invalid_response}

          {:error, _} ->
            {:error, :json_parse_error}
        end

      {:ok, %HTTPoison.Response{status_code: 401}} ->
        {:error, :unauthorized}

      {:ok, %HTTPoison.Response{status_code: 429}} ->
        {:error, :rate_limited}

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, {:http_error, status}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:network_error, reason}}
    end
  end

  defp transform_quote(symbol, quote_data) do
    # Extract values from Finnhub response
    current_price = Map.get(quote_data, "c", 0)
    change = Map.get(quote_data, "d", 0)
    change_percent = Map.get(quote_data, "dp", 0)
    high = Map.get(quote_data, "h", 0)
    low = Map.get(quote_data, "l", 0)
    open = Map.get(quote_data, "o", 0)
    previous_close = Map.get(quote_data, "pc", 0)

    # Determine direction
    direction = get_change_direction(change)

    %{
      "symbol" => symbol,
      "price" => current_price,
      "priceFormatted" => format_price(current_price),
      "change" => change,
      "changeFormatted" => format_change(change),
      "changePercent" => change_percent,
      "changePercentFormatted" => format_change_percent(change_percent),
      "changeDirection" => direction,
      "changeArrow" => get_change_arrow(direction),
      "high" => high,
      "low" => low,
      "open" => open,
      "previousClose" => previous_close
    }
  end

  defp get_change_direction(change) when change > 0, do: "up"
  defp get_change_direction(change) when change < 0, do: "down"
  defp get_change_direction(_), do: "neutral"

  defp get_change_arrow("up"), do: "▲"
  defp get_change_arrow("down"), do: "▼"
  defp get_change_arrow(_), do: "─"

  defp format_price(price) when is_number(price) do
    "$#{:erlang.float_to_binary(price / 1, decimals: 2)}"
  end

  defp format_price(_), do: "$0.00"

  defp format_change(change) when is_number(change) and change > 0 do
    "+#{:erlang.float_to_binary(change / 1, decimals: 2)}"
  end

  defp format_change(change) when is_number(change) and change < 0 do
    "#{:erlang.float_to_binary(change / 1, decimals: 2)}"
  end

  defp format_change(_), do: "0.00"

  defp format_change_percent(percent) when is_number(percent) and percent > 0 do
    "(+#{:erlang.float_to_binary(percent / 1, decimals: 2)}%)"
  end

  defp format_change_percent(percent) when is_number(percent) and percent < 0 do
    "(#{:erlang.float_to_binary(percent / 1, decimals: 2)}%)"
  end

  defp format_change_percent(_), do: "(0.00%)"

  defp determine_market_status do
    # Simple market status check based on US Eastern time
    # NYSE hours: 9:30 AM - 4:00 PM ET, Mon-Fri
    # This is a simplified check; production should use proper exchange calendars

    now = DateTime.utc_now()
    # Convert to Eastern Time (UTC-5 or UTC-4 during DST)
    # For simplicity, using UTC-5 (standard time)
    eastern_hour = rem(now.hour - 5 + 24, 24)
    day_of_week = Date.day_of_week(DateTime.to_date(now))

    cond do
      # Weekend
      day_of_week in [6, 7] ->
        "closed"

      # Pre-market (4 AM - 9:30 AM ET)
      eastern_hour >= 4 and eastern_hour < 9 ->
        "pre-market"

      eastern_hour == 9 and now.minute < 30 ->
        "pre-market"

      # Regular hours (9:30 AM - 4 PM ET)
      (eastern_hour == 9 and now.minute >= 30) or (eastern_hour >= 10 and eastern_hour < 16) ->
        "open"

      # After hours (4 PM - 8 PM ET)
      eastern_hour >= 16 and eastern_hour < 20 ->
        "after-hours"

      # Closed
      true ->
        "closed"
    end
  end
end
