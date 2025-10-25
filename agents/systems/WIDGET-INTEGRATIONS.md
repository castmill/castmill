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
  
  # HTTP status or error information
  field :status, :string
  field :error_message, :string
  
  timestamps()
end
```

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
   
4. **Periodic Refresh**
   - Background job checks `refresh_at` timestamps
   - Pulls fresh data from third-party API
   - Increments version number
   - Players detect version change and update

5. **Player Polling**
   - Player includes current version in request
   - Server returns 304 Not Modified if version unchanged
   - Server returns new data if version changed

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
