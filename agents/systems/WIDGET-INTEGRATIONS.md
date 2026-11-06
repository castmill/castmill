# Widget Third-Party Integration System

## Overview

The Widget Third-Party Integration System provides a comprehensive mechanism for widgets to integrate with external services. It supports both organization-wide and widget-specific credentials, and implements PULL and PUSH data synchronization patterns.

## Architecture

### Core Concepts

1. **Widget Integration**: Defines how a widget type integrates with external services
2. **Integration Credentials**: Stores encrypted authentication credentials (organization or widget scope)
3. **PULL Mode**: Widgets request data from third-party services via Castmill backend
4. **PUSH Mode**: External services push data to widgets via webhooks

### Integration Scopes

#### Organization-Wide Credentials
Used when all widgets of a type share the same credentials:
- Weather widgets (one API key for all weather widgets)
- Stock ticker widgets (one API key for all stock widgets)

#### Widget-Specific Credentials
Used when each widget instance needs unique credentials:
- Social media feeds (OAuth per account)
- Custom data sources (unique API keys per widget)

## Database Schema

### widget_integrations

Defines integration capabilities for a widget type.

```elixir
schema "widget_integrations" do
  field :widget_id, references(:widgets)
  field :name, :string                    # Integration name (e.g., "openweather")
  field :description, :string
  
  # Integration type: "pull", "push", or "both"
  field :integration_type, :string
  
  # Credential scope: "organization" or "widget"
  field :credential_scope, :string
  
  # Configuration schema for the integration
  field :config_schema, :map
  
  # Credential schema (defines required credentials)
  field :credential_schema, :map
  
  # Pull configuration (if applicable)
  field :pull_endpoint, :string           # External API endpoint
  field :pull_interval_seconds, :integer  # How often to pull
  field :pull_config, :map                # Additional pull configuration
  
  # Push configuration (if applicable)
  field :push_webhook_path, :string       # Webhook path for this integration
  field :push_config, :map                # Additional push configuration
  
  field :is_active, :boolean, default: true
  
  timestamps()
end
```

### widget_integration_credentials

Stores encrypted credentials for integrations.

```elixir
schema "widget_integration_credentials" do
  field :widget_integration_id, references(:widget_integrations)
  
  # Organization-scoped credentials
  field :organization_id, references(:organizations), nullable: true
  
  # Widget-scoped credentials (for specific widget instance)
  field :widget_config_id, references(:widgets_config), nullable: true
  
  # Encrypted credentials (JSON encrypted with organization key)
  field :encrypted_credentials, :binary
  
  # Metadata about credentials (non-sensitive)
  field :metadata, :map
  
  # When credentials were last validated
  field :validated_at, :utc_datetime
  
  # Whether credentials are currently valid
  field :is_valid, :boolean, default: false
  
  timestamps()
end

# Constraint: Exactly one of organization_id or widget_config_id must be set
```

### widget_integration_data

Caches data from PULL or PUSH operations.

```elixir
schema "widget_integration_data" do
  field :widget_integration_id, references(:widget_integrations)
  field :widget_config_id, references(:widgets_config)
  
  # Cached data from integration
  field :data, :map
  
  # Version number (incremented on each update)
  field :version, :integer, default: 1
  
  # When data was last fetched/pushed
  field :fetched_at, :utc_datetime
  
  # When data should be refreshed (for PULL mode)
  field :refresh_at, :utc_datetime
  
  # Automatically scheduled when data is fetched. Every pull writes a future
  # refresh_at based on the integration's pull_interval_seconds. When players
  # request data and refresh_at is in the past, the backend immediately queues a
  # background poll (in addition to the regular scheduler) so stale caches are
  # refreshed on-demand.

  # HTTP status or error information
  field :status, :string
  field :error_message, :string
  
  timestamps()
end

### Stale Cache Detection

- `refresh_at` is computed every time new data is persisted (either by the
  IntegrationPoller or by an on-demand fetch). It represents the next time a
  background poll should occur.
- The IntegrationPoller periodically selects rows where `refresh_at <= now` and
  schedules pulls so that long-running players continue to receive updates even
  with no viewer activity.
- When a player (or preview in the dashboard) requests widget data and the
  cached record is already past `refresh_at`, the controller immediately enqueues
  a zero-delay poll for the matching discriminator. This keeps signage devices
  up to date even if the background worker is delayed, while still returning the
  last known data to avoid empty screens.
```

### Refresh Modes

Pull integrations have a `refresh_mode`:

- `scheduled` (default): the behavior described above, with repeatable polling every
  `pull_interval_seconds`.
- `on_demand`: no repeatable jobs. Data is refreshed only when it is read (device playlists, the
  widget data endpoint, dashboard previews) and older than `pull_interval_seconds`. Missing data is
  fetched synchronously, stale data is served while one deduplicated refresh is queued, and failing
  sources back off. Use it for sources with per-call costs or many rarely shown configurations
  (e.g. property listings). Widget packages set it with `"refresh_mode": "on_demand"` in their
  integration definition. See [INTEGRATION-ON-DEMAND-REFRESH.md](./INTEGRATION-ON-DEMAND-REFRESH.md).

All fetch paths build fetcher options with `Castmill.Widgets.Integrations.Refresh.fetch_options/3`:
item options may override only the `pull_config` keys that the widget declares in its
`options_schema` (e.g. a default `feed_url`), so integration settings such as service URLs can never
be redirected by a playlist item.

### Serve-Time Filtering (max_items)

Widget integrations support **serve-time filtering** to allow multiple widget instances
to share the same cached data while each displaying a different number of items:

```elixir
# In resources.ex and widget_integration_controller.ex
@default_max_items 10

defp apply_max_items_filter(data, widget_options) when is_map(data) do
  max_items = Map.get(widget_options, "max_items") || 
              Map.get(widget_options, :max_items) ||
              @default_max_items
  items = Map.get(data, "items")
  
  cond do
    is_nil(items) -> data
    is_list(items) and is_integer(max_items) and max_items > 0 ->
      Map.put(data, "items", Enum.take(items, max_items))
    true -> data
  end
end
```

**Key behaviors:**
- Fetchers (e.g., RSS) cache a large number of items (e.g., 100) to enable sharing
- Each widget instance specifies its own `max_items` in widget options
- Filtering happens at serve-time, not fetch-time
- Default is 10 items when not specified
- Items are assumed to be pre-sorted (newest first) from the fetcher

**Benefits:**
- Single cache entry shared by multiple widget instances with same feed URL
- Reduced API calls to third-party services
- Flexible per-widget display configuration

## Integration Flows

### PULL Mode Flow

1. **Widget Instance Created**
   - Widget config created with integration settings
   - Credentials validated (organization or widget scope)
   
2. **Initial Data Fetch**
   - Backend pulls data from third-party API
   - Encrypts response and stores in widget_integration_data
   - Version number set to 1

3. **Player Requests Data**
   - Player polls Castmill API: `GET /api/widgets/:widget_config_id/data`
   - Returns cached data with version number
   
4. **Periodic Refresh & On-Demand Resync**
  - Background job checks `refresh_at` timestamps and queues polls when due
  - When a player requests data and `refresh_at` is already in the past, the
    request triggers an immediate polling job while still returning the last
    cached payload
  - Fresh data replaces the cache and increments the version number
  - Players detect version change and update automatically

5. **Player Polling**
   - Player includes current version in request
   - Server returns 304 Not Modified if version unchanged
   - Server returns new data if version changed

### Data Prefetching (Dashboard UX Optimization)

To improve perceived performance when adding widgets to playlists, the dashboard
implements a **prefetch mechanism** that warms up the integration data cache
before the widget is actually inserted.

#### How It Works

1. **User Drags Widget** → Dashboard immediately calls prefetch endpoint
2. **Prefetch Runs in Background** → While user configures widget options (if any)
3. **Widget Inserted** → Data already cached, appears instantly

#### Endpoint

```
POST /dashboard/organizations/:org_id/widgets/:widget_id/prefetch-data
```

**Request Body (optional):**
```json
{
  "options": {
    // Widget options for discriminator calculation
    // (for widget_option discriminator type)
  }
}
```

**Response:**
```json
{
  "data": { /* integration data */ },
  "status": "fetched|cached|error|credentials_required|no_integration",
  "version": 1,
  "fetched_at": "2026-01-16T10:30:00Z"
}
```

#### Benefits

- **No perceived delay** when adding widgets like HN, RSS feeds
- **Cache warming** happens in parallel with credential checks and modal display
- **Shared cache** benefits all widget instances using the same discriminator

#### Flow Diagram

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  User drags      │────▶│ prefetchWidgetData │────▶│ Cache populated  │
│  widget          │     │ (background)       │     │ with feed data   │
└──────────────────┘     └───────────────────┘     └──────────────────┘
         │                        │
         ▼                        │ (parallel)
┌──────────────────┐              │
│ Check credentials│◀─────────────┘
│ & show modal     │
└──────────────────┘
         │
         ▼
┌──────────────────┐     ┌───────────────────┐
│ User clicks      │────▶│ Insert widget     │
│ "Update"         │     │ (data already     │
└──────────────────┘     │  cached = FAST!)  │
                         └───────────────────┘
```

#### Implementation Details

- Triggered in `playlist-items.tsx` when `insertItem` is called
- Runs as a fire-and-forget promise that completes before `onInsertItem`
- Uses the same discriminator-based caching as regular data fetches
- Works best with `organization` discriminator type (all instances share data)

### PUSH Mode Flow

1. **Widget Instance Created**
   - Widget config created
   - Webhook URL generated: `https://castmill.io/api/webhooks/widgets/:integration_id/:widget_config_id`
   - User configures third-party service to push to webhook

2. **External Service Pushes Data**
   - POST to webhook endpoint with data
   - Webhook validates signature/credentials
   - Data stored in widget_integration_data
   - Version incremented

3. **Player Polling**
   - Same as PULL mode - player polls for latest version
   - Server returns new data when version changes

## Security

### Credential Encryption

Credentials are encrypted using organization-specific keys:

```elixir
# Generate organization encryption key (stored securely)
organization.encryption_key = :crypto.strong_rand_bytes(32)

# Encrypt credentials
encrypted = Castmill.Crypto.encrypt(
  credentials_json, 
  organization.encryption_key
)

# Decrypt for use in API calls
credentials = Castmill.Crypto.decrypt(
  encrypted_credentials,
  organization.encryption_key
)
```

### Webhook Security

PUSH webhooks support multiple authentication methods:

1. **Signature Verification**: Validate HMAC signature from third-party
2. **API Keys**: Require API key in header or query string
3. **IP Whitelisting**: Restrict to known third-party IPs

### Authorization

- Only organization admins can configure integrations
- Team members with widget permissions can use integrations
- Players can only access data for widgets they're authorized to display

## Add-on System Integration

### Integration Configuration Hook

Widget integrations extend the add-on system with configuration hooks:

```typescript
// In widget addon
export const integrationHooks = {
  // Render configuration UI
  renderConfig: (integration: WidgetIntegration) => JSX.Element,
  
  // Render credential input
  renderCredentials: (scope: 'organization' | 'widget') => JSX.Element,
  
  // Validate credentials
  validateCredentials: (credentials: any) => Promise<boolean>,
  
  // Test integration
  testIntegration: (credentials: any, config: any) => Promise<any>
}
```

### Dashboard UI Components

1. **Organization Integration Settings**
   - Path: `/org/:orgId/settings/integrations`
   - Configure organization-wide credentials
   - Enable/disable integrations

2. **Widget Integration Config**
   - Shown in widget creation/edit flow
   - Select integration type
   - Configure widget-specific credentials (if needed)
   - Test connection

3. **Integration Status Dashboard**
   - View integration health
   - Last sync times
   - Error logs
   - Credential validation status

## API Endpoints

### Integration Management

```
# List available integrations for a widget
GET /api/organizations/:org_id/widgets/:widget_id/integrations

# Get integration details
GET /api/organizations/:org_id/widget-integrations/:integration_id

# Create/update organization credentials
POST /api/organizations/:org_id/widget-integrations/:integration_id/credentials
PUT /api/organizations/:org_id/widget-integrations/:integration_id/credentials

# Create/update widget-specific credentials
POST /api/widgets-config/:config_id/credentials
PUT /api/widgets-config/:config_id/credentials

# Test integration
POST /api/organizations/:org_id/widget-integrations/:integration_id/test
```

### Data Access (for Players)

```
# Get widget data with version check
GET /api/widgets-config/:config_id/data?version=:current_version
Response: 304 Not Modified OR 200 with new data

# Force refresh (admin only)
POST /api/widgets-config/:config_id/refresh
```

### Webhooks (for PUSH mode)

```
# Generic webhook endpoint
POST /api/webhooks/widgets/:integration_id/:widget_config_id
Headers:
  X-Webhook-Signature: <signature>
  X-API-Key: <api_key>
Body: <integration-specific payload>
```

## Configuration Examples

### Weather Widget (Organization Credentials, PULL)

```json
{
  "widget_id": "weather-widget",
  "name": "openweather",
  "description": "OpenWeather API Integration",
  "integration_type": "pull",
  "credential_scope": "organization",
  "credential_schema": {
    "api_key": {
      "type": "string",
      "required": true,
      "label": "OpenWeather API Key",
      "sensitive": true
    }
  },
  "config_schema": {
    "units": {
      "type": "string",
      "enum": ["metric", "imperial"],
      "default": "metric"
    }
  },
  "pull_endpoint": "https://api.openweathermap.org/data/2.5/weather",
  "pull_interval_seconds": 1800,
  "pull_config": {
    "rate_limit": 60,
    "timeout": 5000
  }
}
```

### Social Feed Widget (Widget Credentials, PUSH)

```json
{
  "widget_id": "facebook-feed",
  "name": "facebook",
  "description": "Facebook Page Feed via Webhook",
  "integration_type": "push",
  "credential_scope": "widget",
  "credential_schema": {
    "page_id": {
      "type": "string",
      "required": true
    },
    "webhook_verify_token": {
      "type": "string",
      "required": true,
      "sensitive": true
    }
  },
  "push_webhook_path": "/facebook",
  "push_config": {
    "signature_header": "X-Hub-Signature",
    "verify_signature": true
  }
}
```

### RSS Feed Widget (No Credentials, PULL)

```json
{
  "widget_id": "rss-feed",
  "name": "rss",
  "description": "RSS Feed Integration",
  "integration_type": "pull",
  "credential_scope": "widget",
  "credential_schema": {},
  "config_schema": {
    "feed_url": {
      "type": "string",
      "required": true,
      "label": "RSS Feed URL"
    },
    "max_items": {
      "type": "number",
      "default": 10
    }
  },
  "pull_interval_seconds": 300
}
```

#### RSS Fetcher (`Castmill.Widgets.Integrations.Fetchers.Rss`)

The server-side fetcher used by news widgets (`fetcher: "rss"`, discriminator
`feed_url`). Helper modules live in `lib/castmill/widgets/integrations/rss/`.

- **Formats**: RSS 2.0/0.9x, RSS 1.0 (RDF), Atom 1.0/0.3 and JSON Feed 1.x.
  If `feed_url` points to an HTML page, the advertised
  `<link rel="alternate" type="application/rss+xml|atom+xml|feed+json">` feed is
  followed (one level). URLs without a scheme get `https://`; `feed://` is accepted.
- **Normalized output** (stored as integration data):
  - Feed: `feedTitle`, `feedDescription`, `feedLink`, `feedImage`,
    `feedLanguage`, `feedFormat` (`rss | rdf | atom | json`), `lastUpdated`, `items`.
  - Item: `id`, `title` (plain text, ≤300 chars), `description` (plain text,
    ≤500 chars; falls back to full content), `link`, `image` (also `imageUrl`),
    `author`, `categories` (≤10), `source`, `pubDate` (ISO 8601 UTC),
    `pubDateFormatted` (e.g. `Jan 1, 2025`). Missing values are empty strings.
  - Images are chosen from Media RSS (largest), thumbnails, image enclosures,
    `itunes:image`, Atom enclosure links, JSON Feed images and finally inline
    `<img>` tags (tracking pixels skipped). Relative URLs are made absolute and
    only `http(s)` URLs are kept.
  - Items are de-duplicated (guid/id/link), sorted newest first (undated last)
    and capped at 100 so `max_items` can be applied per widget.
- **Robustness**: handles BOMs, UTF-16, ISO-8859-1/Windows-1252, HTML entities
  in XML, CDATA HTML, double-escaped HTML, RFC 822/ISO 8601 dates with zones.
  `Rss.Html` parses HTML fields with Floki (runtime dependency, mochiweb
  backend) for HTML-to-text, `<img>` extraction and `<link>` autodiscovery, and
  decodes the full HTML5 named-entity set (including multi-code-point entities)
  in text and XML. Non-rendered content (comments, `script`, `style`,
  `noscript`, `iframe`, `template`) yields neither text nor images.
- **Security** (`Castmill.SafeHttp`, shared hardened HTTP client for
  user-supplied URLs, reusable for other untrusted downloads): http(s) only;
  every request and redirect hop (max 5) is checked against private/loopback/link-local/site-local/reserved IPv4/IPv6
  ranges (`:blocked_host`); responses are streamed and canceled at the 5 MB
  transfer limit, with an additional decompressed-body limit for gzip/deflate
  bomb protection (`:feed_too_large`); XML is parsed with a SAX parser after DOCTYPE
  removal (no DTD/entity expansion, no atom creation). Logs contain only the host.
  Dev sets `allow_private_hosts: true` in `config/dev.exs`.
- **Errors**: `{:error, reason, credentials}` with reasons such as
  `:missing_feed_url`, `:invalid_url`, `:blocked_host`, `:host_not_found`,
  `:not_found`, `:rate_limited`, `:server_error`, `:feed_too_large`,
  `:xml_parse_error`, `:unknown_feed_format`; `Castmill.Resources` turns these
  into user-facing messages.
- **Tests**: `test/castmill/widgets/integrations/fetchers/rss_test.exs`,
  `test/castmill/widgets/integrations/rss/` and `test/castmill/safe_http_test.exs`,
  using `Castmill.SafeHttp.FakeClient` (no network).

## Implementation Phases

### Phase 1: Core Infrastructure
- Database migrations
- Elixir context modules
- Credential encryption
- Basic API endpoints

### Phase 2: PULL Mode
- Background job for periodic pulls
- Version-based caching
- Player polling endpoints
- Error handling and retries

### Phase 3: PUSH Mode
- Webhook endpoints
- Signature verification
- Third-party adapters

### Phase 4: Dashboard UI
- Integration configuration components
- Credential management UI
- Status dashboard
- Testing interface

### Phase 5: Documentation & Examples
- Developer guide
- Integration examples
- Migration guide

## Future Considerations

### Advanced Features
- **Rate Limiting**: Per-integration rate limits
- **Quota Management**: Track API usage against plans
- **Caching Strategies**: Redis for high-frequency data
- **Fallback Data**: Serve stale data if API unavailable
- **Multi-tenancy**: Network-wide credentials
- **OAuth Flows**: Built-in OAuth 2.0 support
- **GraphQL Support**: Alternative to REST for integrations
- **Event Streaming**: WebSocket updates for real-time data

### Monitoring & Observability
- Integration health metrics
- Failed pull/push tracking
- Credential expiration alerts
- Rate limit monitoring
- Error aggregation and reporting

### Developer Experience
- SDK for creating custom integrations
- Integration marketplace
- Sandbox/testing environment
- Integration templates
- Automated testing tools
