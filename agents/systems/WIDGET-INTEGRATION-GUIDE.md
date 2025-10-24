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

The backend periodically fetches data from a third-party API and caches it. Players poll for updates.

**Use Cases:**
- Weather data
- Stock prices
- RSS feeds
- Social media feeds with API access

**Pros:**
- Centralized rate limiting
- Efficient for multiple players
- Can cache and serve stale data

**Cons:**
- Delayed updates (limited by pull interval)
- Backend resource usage

### PUSH Mode

Third-party services push data to a webhook when it changes. Players poll for the latest version.

**Use Cases:**
- Real-time event notifications
- Social media webhooks
- Form submissions
- IoT sensor data

**Pros:**
- Near real-time updates
- No polling of third-party APIs
- Event-driven architecture

**Cons:**
- Requires third-party to support webhooks
- Need to configure webhook URLs externally

### BOTH Mode

Supports both PULL and PUSH. Use PULL for initial data and periodic fallback, PUSH for real-time updates.

**Use Cases:**
- Hybrid systems
- Fallback scenarios
- Mixed data sources

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

The backend needs to implement the data fetching logic:

```elixir
# packages/castmill/lib/castmill/widgets/integrations/pull_worker.ex

defmodule Castmill.Widgets.Integrations.PullWorker do
  @moduledoc """
  Background worker that periodically pulls data from third-party integrations.
  """
  use Oban.Worker, queue: :widget_integrations

  alias Castmill.Widgets.Integrations
  alias Castmill.Crypto
  alias Castmill.Repo

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"widget_integration_data_id" => data_id}}) do
    data = Integrations.get_integration_data_by_id(data_id)
    data = Repo.preload(data, [:widget_integration, widget_config: [playlist_item: :playlist]])
    
    integration = data.widget_integration
    widget_config = data.widget_config
    
    # Get credentials
    credentials = get_credentials(integration, widget_config)
    
    # Fetch data from third-party API
    case fetch_integration_data(integration, widget_config, credentials) do
      {:ok, new_data} ->
        # Update cached data
        now = DateTime.utc_now()
        refresh_at = DateTime.add(now, integration.pull_interval_seconds, :second)
        
        {:ok, _} = Integrations.upsert_integration_data(%{
          widget_integration_id: integration.id,
          widget_config_id: widget_config.id,
          data: new_data,
          fetched_at: now,
          refresh_at: refresh_at,
          status: "success"
        })
        
        # Schedule next pull
        schedule_next_pull(data_id, integration.pull_interval_seconds)
        
        :ok
        
      {:error, reason} ->
        # Log error but keep stale data
        Integrations.update_integration_data(data, %{
          status: "error",
          error_message: inspect(reason)
        })
        
        # Retry with backoff
        {:error, reason}
    end
  end
  
  defp get_credentials(integration, widget_config) do
    creds = if integration.credential_scope == "organization" do
      organization_id = widget_config.playlist_item.playlist.organization_id
      Integrations.get_credentials(integration, organization_id: organization_id)
    else
      Integrations.get_credentials(integration, widget_config_id: widget_config.id)
    end
    
    if creds do
      organization = get_organization(widget_config)
      {:ok, encryption_key} = Crypto.decode_key(organization.encryption_key)
      {:ok, decrypted} = Crypto.decrypt(creds.encrypted_credentials, encryption_key)
      decrypted
    else
      nil
    end
  end
  
  defp fetch_integration_data(integration, widget_config, credentials) do
    # Build request URL with widget options
    url = build_request_url(
      integration.pull_endpoint, 
      widget_config.options, 
      credentials
    )
    
    headers = build_headers(credentials)
    
    case HTTPoison.get(url, headers, timeout: integration.pull_config["timeout"] || 5000) do
      {:ok, %{status_code: 200, body: body}} ->
        Jason.decode(body)
        
      {:ok, %{status_code: status}} ->
        {:error, "HTTP #{status}"}
        
      {:error, reason} ->
        {:error, reason}
    end
  end
  
  defp build_request_url(endpoint, options, credentials) do
    # Example: OpenWeather API
    params = %{
      "lat" => options["latitude"],
      "lon" => options["longitude"],
      "units" => options["units"] || "metric",
      "appid" => credentials["api_key"]
    }
    
    query = URI.encode_query(params)
    "#{endpoint}?#{query}"
  end
  
  defp build_headers(_credentials) do
    [
      {"User-Agent", "Castmill/1.0"},
      {"Accept", "application/json"}
    ]
  end
  
  defp schedule_next_pull(data_id, interval) do
    %{widget_integration_data_id: data_id}
    |> __MODULE__.new(schedule_in: interval)
    |> Oban.insert()
  end
end
```

### Scheduling PULL Jobs

When a widget is created with an integration, schedule the first pull:

```elixir
# When widget_config is created
def create_widget_with_integration(attrs) do
  with {:ok, widget_config} <- Widgets.new_widget_config(...),
       {:ok, integration} <- get_integration_for_widget(widget_config.widget_id),
       {:ok, integration_data} <- create_initial_integration_data(integration, widget_config) do
    
    # Schedule first pull
    PullWorker.schedule_next_pull(integration_data.id, 0) # Run immediately
    
    {:ok, widget_config}
  end
end
```

## PUSH Mode Integration

### Webhook Handler

Implement custom webhook handlers for different integrations:

```elixir
# packages/castmill/lib/castmill/widgets/integrations/webhook_handlers/facebook.ex

defmodule Castmill.Widgets.Integrations.WebhookHandlers.Facebook do
  @moduledoc """
  Handles Facebook Page webhook events.
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
  """
  def transform_payload(payload) do
    # Extract relevant data from Facebook webhook
    entry = List.first(payload["entry"] || [])
    changes = List.first(entry["changes"] || [])
    value = changes["value"]
    
    %{
      "message" => value["message"],
      "created_time" => value["created_time"],
      "from" => value["from"],
      "permalink_url" => value["permalink_url"]
    }
  end
end
```

Update the webhook controller to use handlers:

```elixir
# In widget_integration_controller.ex

defp verify_webhook_signature(conn, integration, params) do
  handler = get_webhook_handler(integration.name)
  
  signature = get_req_header(conn, "x-hub-signature-256") |> List.first()
  body = conn.assigns.raw_body # Need to capture raw body
  
  credentials = get_webhook_credentials(integration, params["widget_config_id"])
  
  if handler.verify_signature(body, signature, credentials) do
    :ok
  else
    {:error, :invalid_signature}
  end
end

defp extract_webhook_data(params, integration) do
  handler = get_webhook_handler(integration.name)
  {:ok, handler.transform_payload(params)}
end
```

## Player Implementation

### Polling for Updates

Implement efficient polling in the player:

```typescript
// packages/player/src/widgets/integrated-widget.ts

import { Widget } from './widget';

export class IntegratedWidget extends Widget {
  private currentVersion: number = 0;
  private pollInterval: number = 30000; // 30 seconds
  private pollTimer?: number;
  
  constructor(
    protected widgetConfigId: string,
    protected apiBase: string = '/api'
  ) {
    super();
  }
  
  async load(): Promise<void> {
    // Initial data fetch
    await this.fetchData();
    
    // Start polling
    this.startPolling();
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
  
  private updateWidgetData(data: any): void {
    // Update widget display with new data
    this.emit('data-updated', data);
  }
  
  private handleError(error: any): void {
    // Show error state or keep displaying stale data
    this.emit('data-error', error);
  }
  
  private startPolling(): void {
    this.pollTimer = window.setInterval(() => {
      this.fetchData();
    }, this.pollInterval);
  }
  
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
  
  unload(): void {
    this.stopPolling();
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
