# Widget Integration Developer Guide

This guide explains how to create widgets that integrate with third-party services using the Castmill Widget Integration System.

## Table of Contents

1. [Overview](#overview)
2. [Integration Types](#integration-types)
3. [Credential Scopes](#credential-scopes)
4. [Creating an Integration](#creating-an-integration)
5. [PULL Mode Integration](#pull-mode-integration)
6. [PUSH Mode Integration](#push-mode-integration)
7. [Player Implementation](#player-implementation)
8. [Testing](#testing)
9. [Examples](#examples)

## Overview

The Widget Integration System provides a standardized way for widgets to connect with external services. It handles:

- **Credential Management**: Secure storage and encryption of API keys and credentials
- **Data Fetching**: Automated PULL of data from third-party APIs
- **Webhook Handling**: PUSH of data from third-party services
- **Version Control**: Efficient polling with version-based caching
- **Error Handling**: Graceful degradation when services are unavailable

## Integration Types

### PULL Mode

The backend periodically fetches data from a third-party API and caches it. Players receive updates via WebSocket channels when new data is available.

**Use Cases:**
- Weather data
- Stock prices
- RSS feeds
- Social media feeds with API access

**Pros:**
- Centralized rate limiting
- Efficient for multiple players
- Can cache and serve stale data
- Real-time updates via WebSocket

**Cons:**
- Delayed updates (limited by pull interval)
- Backend resource usage

### PUSH Mode

Third-party services push data to a webhook when it changes. Players receive updates via WebSocket channels.

**Use Cases:**
- Real-time event notifications
- Social media webhooks
- Form submissions
- IoT sensor data

**Pros:**
- Real-time updates via WebSocket
- No polling of third-party APIs
- Event-driven architecture

**Cons:**
- Requires third-party to support webhooks
- Need to configure webhook URLs externally

### BOTH Mode

**Note**: This mode is not recommended. Each widget integration should use either PULL or PUSH mode, not both. Choose the mode that best fits your use case:
- Use **PULL** when you need to periodically fetch data from an API
- Use **PUSH** when third-party services can notify you of changes via webhooks

## Credential Scopes

### Organization-Wide Credentials

All widgets of this type in the organization share the same credentials.

**Best For:**
- Public APIs with organization-level keys
- Services with per-organization billing
- Simple configuration

**Example:** Weather widgets - one API key for all weather displays

### Widget-Specific Credentials

Each widget instance has its own credentials.

**Best For:**
- User-specific content (social media accounts)
- Per-location configurations
- OAuth integrations

**Example:** Facebook feed - each widget shows a different page

## Creating an Integration

### Understanding Widget Templates

Castmill widgets are defined using JSON templates with schemas. A widget has:

1. **Template**: JSON structure defining the widget's UI layout
2. **Options Schema**: Defines configuration options (e.g., location, refresh interval)
3. **Data Schema**: Defines the structure of data consumed by the widget

When creating an integration, you need to ensure the integration's data output matches the widget's `data_schema`.

**Example Weather Widget**:

```json
{
  "name": "Weather Widget",
  "template": {
    "type": "container",
    "components": [
      {"type": "text", "field": "temperature"},
      {"type": "text", "field": "condition"}
    ]
  },
  "options_schema": {
    "latitude": {"type": "number", "required": true},
    "longitude": {"type": "number", "required": true},
    "units": {"type": "string", "default": "metric"}
  },
  "data_schema": {
    "temperature": {"type": "number", "required": true},
    "condition": {"type": "string", "required": true},
    "location": {"type": "string"}
  }
}
```

The integration must provide data matching the `data_schema`:

```json
{
  "temperature": 72,
  "condition": "sunny",
  "location": "Stockholm"
}
```

### Step 1: Define the Integration

Create the integration definition in the database:

```elixir
# In a migration or seed file
alias Castmill.Widgets.Integrations

{:ok, weather_widget} = Castmill.Widgets.get_widget_by_slug("weather")

{:ok, integration} = Integrations.create_integration(%{
  widget_id: weather_widget.id,
  name: "openweather",
  description: "OpenWeather API Integration",
  integration_type: "pull",
  credential_scope: "organization",
  
  # Define required credentials
  credential_schema: %{
    "api_key" => %{
      "type" => "string",
      "required" => true,
      "label" => "API Key",
      "sensitive" => true,
      "help" => "Get your API key from openweathermap.org"
    }
  },
  
  # Define integration configuration
  config_schema: %{
    "units" => %{
      "type" => "string",
      "enum" => ["metric", "imperial"],
      "default" => "metric",
      "label" => "Temperature Units"
    }
  },
  
  # PULL configuration
  pull_endpoint: "https://api.openweathermap.org/data/2.5/weather",
  pull_interval_seconds: 1800, # 30 minutes
  pull_config: %{
    "rate_limit" => 60,
    "timeout" => 5000
  }
})
```

### Step 2: Create Dashboard UI Components

Create configuration components in the dashboard addon:

```tsx
// packages/castmill/lib/castmill/addons/widgets/components/weather-integration-config.tsx

import { Component, createSignal } from 'solid-js';
import { useI18n } from '../../../dashboard/src/i18n';

interface IntegrationConfigProps {
  integration: any;
  credentials?: any;
  onSave: (credentials: any) => Promise<void>;
}

export const WeatherIntegrationConfig: Component<IntegrationConfigProps> = (props) => {
  const { t } = useI18n();
  const [apiKey, setApiKey] = createSignal(props.credentials?.api_key || '');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      await props.onSave({ api_key: apiKey() });
    } catch (err) {
      setError(t('integrations.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="integration-config">
      <h3>{t('integrations.openweather.title')}</h3>
      <p>{t('integrations.openweather.description')}</p>
      
      <div class="form-group">
        <label for="api-key">{t('integrations.openweather.apiKey')}</label>
        <input
          id="api-key"
          type="password"
          value={apiKey()}
          onInput={(e) => setApiKey(e.currentTarget.value)}
          placeholder={t('integrations.openweather.apiKeyPlaceholder')}
        />
        <small>{t('integrations.openweather.apiKeyHelp')}</small>
      </div>
      
      {error() && <div class="alert alert-error">{error()}</div>}
      
      <button 
        onClick={handleSave} 
        disabled={saving() || !apiKey()}
      >
        {saving() ? t('common.saving') : t('common.save')}
      </button>
    </div>
  );
};
```

## PULL Mode Integration

### Backend Implementation

For PULL mode integrations, you need to implement a data fetcher that:
1. Fetches data from the third-party API
2. Transforms it to match the widget's `data_schema`
3. Caches the result
4. Broadcasts updates to connected players via WebSocket

The system provides a simplified integration API. You don't need to write the full worker implementation - just define how to fetch and transform the data.

**Integration Definition**:

```elixir
# packages/castmill/lib/castmill/widgets/integrations/fetchers/openweather.ex

defmodule Castmill.Widgets.Integrations.Fetchers.OpenWeather do
  @moduledoc """
  Fetches weather data from OpenWeather API.
  Transforms data to match the weather widget's data schema.
  """
  
  @behaviour Castmill.Widgets.Integrations.Fetcher
  
  @impl true
  def fetch(credentials, options) do
    # Build API URL using widget options and credentials
    url = build_url(credentials["api_key"], options)
    
    # Fetch from third-party API
    case HTTPoison.get(url) do
      {:ok, %{status_code: 200, body: body}} ->
        # Transform API response to match widget data_schema
        case Jason.decode(body) do
          {:ok, response} ->
            {:ok, transform_response(response, options)}
          {:error, _} ->
            {:error, "Invalid JSON response"}
        end
        
      {:ok, %{status_code: status}} ->
        {:error, "HTTP #{status}"}
        
      {:error, reason} ->
        {:error, reason}
    end
  end
  
  defp build_url(api_key, options) do
    params = %{
      "lat" => options["latitude"],
      "lon" => options["longitude"],
      "units" => options["units"] || "metric",
      "appid" => api_key
    }
    
    query = URI.encode_query(params)
    "https://api.openweathermap.org/data/2.5/weather?#{query}"
  end
  
  defp transform_response(api_response, _options) do
    # Transform OpenWeather API response to widget data_schema
    %{
      "temperature" => api_response["main"]["temp"],
      "condition" => api_response["weather"] |> List.first() |> Map.get("main"),
      "location" => api_response["name"],
      "humidity" => api_response["main"]["humidity"],
      "wind_speed" => api_response["wind"]["speed"]
    }
  end
end
```

**Fetcher Behaviour** (defined by the system):

```elixir
# packages/castmill/lib/castmill/widgets/integrations/fetcher.ex

defmodule Castmill.Widgets.Integrations.Fetcher do
  @moduledoc """
  Behaviour for integration data fetchers.
  
  Implement this behaviour to create a custom integration.
  The system handles scheduling, caching, and WebSocket broadcasts.
  """
  
  @callback fetch(credentials :: map(), options :: map()) ::
    {:ok, data :: map()} | {:error, reason :: any()}
end
```

**How It Works**:

1. Integration developer implements the `Fetcher` behaviour
2. System automatically:
   - Schedules periodic fetches based on `pull_interval_seconds`
   - Caches the result in `widget_integration_data`
   - Increments the version number
   - Broadcasts to WebSocket channel `widget_data:#{widget_config_id}`
   - All connected players receive the update instantly

**Registration**:

```elixir
# Register your fetcher when creating the integration
{:ok, integration} = Integrations.create_integration(%{
  widget_id: "weather-widget",
  name: "openweather",
  integration_type: "pull",
  credential_scope: "organization",
  pull_endpoint: "https://api.openweathermap.org/data/2.5/weather",
  pull_interval_seconds: 1800,
  pull_config: %{
    "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.OpenWeather"
  }
})
```

## PUSH Mode Integration

### Webhook Handler

When a webhook receives data, it should:
1. Validate the webhook signature
2. Transform the payload to match the widget's `data_schema`
3. Cache the result
4. Broadcast updates to connected players via WebSocket

Implement custom webhook handlers for different integrations:

```elixir
# packages/castmill/lib/castmill/widgets/integrations/webhook_handlers/facebook.ex

defmodule Castmill.Widgets.Integrations.WebhookHandlers.Facebook do
  @moduledoc """
  Handles Facebook Page webhook events.
  Transforms data to match widget data_schema.
  """
  
  @doc """
  Verifies Facebook webhook signature.
  """
  def verify_signature(body, signature, credentials) do
    expected = :crypto.mac(:hmac, :sha256, credentials["webhook_secret"], body)
    |> Base.encode16(case: :lower)
    
    signature_value = String.replace(signature, "sha256=", "")
    
    Plug.Crypto.secure_compare(signature_value, expected)
  end
  
  @doc """
  Transforms Facebook webhook payload to widget data format.
  Must match the widget's data_schema.
  """
  def transform_payload(payload) do
    # Extract relevant data from Facebook webhook
    entry = List.first(payload["entry"] || [])
    changes = List.first(entry["changes"] || [])
    value = changes["value"]
    
    # Transform to match widget data_schema
    %{
      "message" => value["message"],
      "created_time" => value["created_time"],
      "from" => value["from"],
      "permalink_url" => value["permalink_url"]
    }
  end
end
```

### WebSocket Broadcasting

When the webhook controller receives data, it broadcasts to the WebSocket channel:

```elixir
# In widget_integration_controller.ex

def receive_webhook(conn, %{
  "integration_id" => integration_id,
  "widget_config_id" => widget_config_id
} = params) do
  with {:ok, integration} <- get_integration_or_error(integration_id),
       :ok <- verify_webhook_signature(conn, integration, params),
       {:ok, data} <- extract_webhook_data(params, integration),
       now <- DateTime.utc_now(),
       {:ok, integration_data} <-
         Integrations.upsert_integration_data(%{
           widget_integration_id: integration.id,
           widget_config_id: widget_config_id,
           data: data,
           fetched_at: now,
           status: "success"
         }) do
    
    # Broadcast to WebSocket channel
    CastmillWeb.Endpoint.broadcast(
      "widget_data:#{widget_config_id}",
      "data_updated",
      %{
        version: integration_data.version,
        data: integration_data.data
      }
    )
    
    conn
    |> put_status(:ok)
    |> json(%{
      success: true,
      version: integration_data.version,
      received_at: now
    })
  else
    {:error, :invalid_signature} ->
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Invalid webhook signature"})
      
    {:error, reason} ->
      conn
      |> put_status(:bad_request)
      |> json(%{error: reason})
  end
end
```

## Player Implementation

### WebSocket-Based Updates

Players receive updates via WebSocket channels, not polling. Polling is only used when a device comes back online:

```typescript
// packages/player/src/widgets/integrated-widget.ts

import { Widget } from './widget';
import { Socket } from 'phoenix';

export class IntegratedWidget extends Widget {
  private currentVersion: number = 0;
  private socket?: Socket;
  private channel?: any;
  private reconnectJitter: number = Math.random() * 5000; // 0-5 seconds jitter
  
  constructor(
    protected widgetConfigId: string,
    protected apiBase: string = '/api',
    protected wsUrl: string = 'ws://localhost:4000/socket'
  ) {
    super();
  }
  
  async load(): Promise<void> {
    // Initial data fetch (on first load or after being offline)
    await this.fetchData();
    
    // Connect to WebSocket for real-time updates
    this.connectWebSocket();
  }
  
  private async fetchData(): Promise<void> {
    try {
      const url = `${this.apiBase}/widget-configs/${this.widgetConfigId}/data`;
      const params = this.currentVersion > 0 
        ? `?version=${this.currentVersion}` 
        : '';
      
      const response = await fetch(url + params);
      
      if (response.status === 304) {
        // Data unchanged
        console.log('Widget data unchanged');
        return;
      }
      
      if (response.ok) {
        const result = await response.json();
        
        this.currentVersion = result.version;
        this.updateWidgetData(result.data);
        
        console.log(`Widget data updated to version ${this.currentVersion}`);
      } else {
        console.error('Failed to fetch widget data:', response.status);
        this.handleError(response.status);
      }
    } catch (error) {
      console.error('Widget data fetch error:', error);
      this.handleError(error);
    }
  }
  
  private connectWebSocket(): void {
    // Connect to Phoenix WebSocket
    this.socket = new Socket(this.wsUrl, {
      params: { token: this.getAuthToken() }
    });
    
    this.socket.connect();
    
    // Join the widget-specific channel
    this.channel = this.socket.channel(`widget_data:${this.widgetConfigId}`, {});
    
    this.channel.on('data_updated', (payload: any) => {
      if (payload.version > this.currentVersion) {
        this.currentVersion = payload.version;
        this.updateWidgetData(payload.data);
        console.log(`Widget data pushed via WebSocket, version ${this.currentVersion}`);
      }
    });
    
    this.channel.join()
      .receive('ok', () => {
        console.log('Joined widget data channel');
      })
      .receive('error', (resp: any) => {
        console.error('Failed to join channel:', resp);
      });
    
    // Handle reconnection after being offline
    this.socket.onError(() => {
      console.log('WebSocket connection lost');
    });
    
    this.socket.onOpen(() => {
      console.log('WebSocket reconnected');
      // Fetch latest data after coming back online (with jitter to prevent DDoS)
      setTimeout(() => {
        this.fetchData();
      }, this.reconnectJitter);
    });
  }
  
  private getAuthToken(): string {
    // Get device authentication token
    // Implementation depends on device authentication mechanism
    return localStorage.getItem('device_token') || '';
  }
  
  private updateWidgetData(data: any): void {
    // Update widget display with new data
    this.emit('data-updated', data);
  }
  
  private handleError(error: any): void {
    // Show error state or keep displaying stale data
    this.emit('data-error', error);
  }
  
  unload(): void {
    if (this.channel) {
      this.channel.leave();
    }
    if (this.socket) {
      this.socket.disconnect();
    }
    super.unload();
  }
}
```

### Widget Template

Create a widget template that uses integration data:

```typescript
// Weather widget example

import { IntegratedWidget } from './integrated-widget';

export class WeatherWidget extends IntegratedWidget {
  private container?: HTMLElement;
  
  show(el: HTMLElement, offset: number): Observable<string> {
    this.container = el;
    
    // Initial render
    this.render();
    
    // Update on data changes
    this.on('data-updated', () => this.render());
    this.on('data-error', () => this.renderError());
    
    return of('shown');
  }
  
  private render(): void {
    if (!this.container) return;
    
    // Access current data (cached in base class or state)
    const data = this.getCurrentData();
    
    if (!data) {
      this.renderLoading();
      return;
    }
    
    this.container.innerHTML = `
      <div class="weather-widget">
        <div class="temperature">${data.temperature}°</div>
        <div class="condition">${data.condition}</div>
        <div class="location">${data.location}</div>
      </div>
    `;
  }
  
  private renderLoading(): void {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="weather-widget loading">
        <div class="spinner"></div>
        <div>Loading weather data...</div>
      </div>
    `;
  }
  
  private renderError(): void {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="weather-widget error">
        <div class="icon">⚠️</div>
        <div>Unable to load weather data</div>
      </div>
    `;
  }
}
```

## Testing

### Unit Tests

Test integration creation and credential management:

```elixir
# test/castmill/widgets/integrations_test.exs

test "creates PULL integration with valid configuration" do
  attrs = %{
    widget_id: widget.id,
    name: "test_integration",
    integration_type: "pull",
    credential_scope: "organization",
    pull_endpoint: "https://api.example.com/data",
    pull_interval_seconds: 300
  }
  
  assert {:ok, integration} = Integrations.create_integration(attrs)
  assert integration.pull_interval_seconds == 300
end

test "encrypts and decrypts credentials" do
  key = Crypto.generate_key()
  credentials = %{"api_key" => "secret123"}
  
  encrypted = Crypto.encrypt(credentials, key)
  {:ok, decrypted} = Crypto.decrypt(encrypted, key)
  
  assert decrypted == credentials
end
```

### Integration Tests

Test the full workflow:

```elixir
test "full PULL workflow", %{integration: integration, widget_config: widget_config} do
  # 1. Set credentials
  {:ok, _} = setup_credentials(integration, organization)
  
  # 2. Schedule pull job
  {:ok, _} = schedule_pull(integration, widget_config)
  
  # 3. Execute job
  :ok = perform_pull_job()
  
  # 4. Verify data was cached
  data = Integrations.get_integration_data_by_config(widget_config.id)
  assert data.version == 1
  assert data.status == "success"
end
```

## Examples

See the `agents/systems/WIDGET-INTEGRATION-API.md` file for complete API examples including:

- Weather widget (organization credentials, PULL)
- Social feed widget (widget credentials, PUSH)
- RSS feed widget (no credentials, PULL)

## Best Practices

1. **Error Handling**: Always handle API failures gracefully
2. **Rate Limiting**: Respect third-party API rate limits
3. **Caching**: Use version-based caching to minimize bandwidth
4. **Security**: Never expose credentials in logs or error messages
5. **Testing**: Test with both valid and invalid credentials
6. **Documentation**: Document integration setup steps for users
7. **Monitoring**: Log integration health and errors
8. **Fallback**: Display stale data or error messages when APIs are down

## Support

For questions or contributions:
- Documentation: https://docs.castmill.com
- GitHub: https://github.com/castmill/castmill
- Discord: https://discord.gg/castmill
