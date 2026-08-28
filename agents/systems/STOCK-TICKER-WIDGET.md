# Stock Ticker Widget

## Overview

The Stock Ticker widget displays a continuously scrolling ticker of real-time stock quotes. It features:

- **Real-time data** from Finnhub API (free tier available)
- **Smooth horizontal scrolling** using the Scroller component
- **Conditional color coding**: green for gains, red for losses, gray for unchanged
- **Customizable appearance**: colors, fonts, speeds, and layout
- **Organization-wide API key sharing** for simplified credential management

## Architecture

### Components Used

The Stock Ticker uses the new **Scroller** component introduced for generic continuous scrolling:

```
Stock Ticker Widget
├── Group (container)
│   ├── Group (optional header)
│   │   └── Text (header text)
│   └── Scroller (ticker content)
│       └── Group (per-item template)
│           ├── Text (symbol)
│           ├── Text (price)
│           └── Group (change indicators)
│               ├── Text (arrow)
│               ├── Text (change amount)
│               └── Text (change %)
```

### SwitchBinding for Conditional Styles

The widget uses **SwitchBinding** for dynamic color styling based on data values:

```json
{
  "color": {
    "switch": {
      "key": "$.changeDirection",
      "cases": {
        "up": { "key": "options.positive_color", "default": "#00C853" },
        "down": { "key": "options.negative_color", "default": "#FF1744" },
        "default": { "key": "options.neutral_color", "default": "#9E9E9E" }
      }
    }
  }
}
```

## Data Integration

### Finnhub API

- **Endpoint**: `https://finnhub.io/api/v1/quote`
- **Poll Interval**: 30 seconds
- **Rate Limit**: 60 requests/minute (free tier)
- **Authentication**: API key (query parameter)

### Data Flow

1. Widget configuration stores comma-separated stock symbols
2. Backend fetcher polls Finnhub for each symbol
3. Response transformed to widget data schema
4. Players receive cached data via standard widget data endpoint
5. Player renders scrolling ticker with conditional styles

### Data Schema

```elixir
%{
  "quotes" => [
    %{
      "symbol" => "AAPL",
      "price" => 175.50,
      "priceFormatted" => "$175.50",
      "change" => 2.35,
      "changeFormatted" => "+2.35",
      "changePercent" => 1.36,
      "changePercentFormatted" => "(+1.36%)",
      "changeDirection" => "up",    # "up", "down", or "neutral"
      "changeArrow" => "▲",         # "▲", "▼", or "─"
      "high" => 177.00,
      "low" => 173.50,
      "open" => 174.00,
      "previousClose" => 173.15
    },
    ...
  ],
  "lastUpdated" => 1703001600,
  "marketStatus" => "open"  # "open", "closed", "pre-market", "after-hours"
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `symbols` | string | AAPL,GOOGL,MSFT,AMZN,TSLA | Comma-separated stock symbols |
| `background` | color | #1a1a2e | Widget background |
| `symbol_color` | color | #ffffff | Stock symbol text color |
| `price_color` | color | #ffffff | Price text color |
| `positive_color` | color | #00C853 | Color for gains (green) |
| `negative_color` | color | #FF1744 | Color for losses (red) |
| `neutral_color` | color | #9E9E9E | Color for unchanged (gray) |
| `scroll_direction` | string | left | Scroll direction: "left" or "right" |
| `scroll_speed` | number | 6 | Scroll speed (em/second) |
| `item_gap` | string | 3em | Gap between stock items |
| `show_header` | boolean | false | Show header bar |
| `header_text` | string | MARKET UPDATE | Header text |

## Integration Setup

### Credential Schema

The widget uses organization-wide credentials with API key authentication:

```elixir
%{
  "auth_type" => "api_key",
  "fields" => %{
    "api_key" => %{
      "type" => "string",
      "required" => true,
      "label" => "Finnhub API Key",
      "description" => "Your Finnhub API key. Get one free at https://finnhub.io/register",
      "sensitive" => true,
      "input_type" => "password"
    }
  }
}
```

### Discriminator Configuration

Uses `widget_option` discriminator on the `symbols` field:
- Widgets with the same symbols share cached data
- Different symbol combinations get separate data caches
- Reduces API calls when multiple displays show the same stocks

## Files

### Backend

| File | Purpose |
|------|---------|
| `priv/repo/migrations/20251219130000_add_stock_ticker_widget.exs` | Widget migration |
| `lib/castmill/widgets/integrations/fetchers/finnhub.ex` | Finnhub API fetcher |
| `test/castmill/widgets/integrations/fetchers/finnhub_test.exs` | Fetcher tests |
| `priv/static/widgets/stock-ticker/icon.svg` | Widget icon (64x64) |
| `priv/static/widgets/stock-ticker/icon-small.svg` | Small icon (24x24) |

### Player (TypeScript)

| File | Purpose |
|------|---------|
| `packages/player/src/widgets/template/scroller.tsx` | Generic Scroller component |
| `packages/player/src/widgets/template/binding.ts` | SwitchBinding support |

## Usage Example

1. **Get Finnhub API Key**: Register at https://finnhub.io/register
2. **Configure Organization Credentials**: Add API key in organization settings
3. **Create Widget**: Select Stock Ticker, configure symbols and appearance
4. **Add to Playlist**: Widget displays with live stock data

## Limitations

- Free Finnhub tier limited to 60 calls/minute (supports ~20 symbols efficiently)
- Maximum 20 symbols per widget to avoid rate limiting
- Data updates every 30 seconds (configurable in integration)
- Market status detection is simplified (US markets only, no holiday awareness)

## Future Enhancements

- [ ] Support for additional stock APIs (Alpha Vantage, Yahoo Finance)
- [ ] Cryptocurrency support
- [ ] Market holiday calendar integration
- [ ] Historical data visualization
- [ ] Custom number formatting (currency, decimal places)
- [ ] Vertical ticker mode
