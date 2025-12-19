# Generic Widget Integration Authentication System

## Implementation Status

**Implemented:**
- ✅ Generic OAuth 2.0 module (`lib/castmill/widgets/integrations/oauth/generic.ex`)
- ✅ Generic Widget OAuth Controller (`lib/castmill_web/controllers/widget_oauth_controller.ex`)
- ✅ Router integration with routes at `/auth/widget-integrations/:integration_id/*`
- ✅ Credential storage with organization encryption keys
- ✅ Comprehensive test suites (35+ passing tests)
- ✅ State parameter security with HMAC signatures and TTL

**Pending:**
- ⏳ Generic credential configuration UI component (SolidJS)
- ⏳ Widget upload as .zip file
- ⏳ UI for listing and managing widget integrations

## Overview

This document describes the design for a generic authentication system for widget integrations that allows widgets to be uploaded as .zip files without requiring custom code. The system supports OAuth 2.0, API keys, and other credential types through a declarative schema approach.

## Design Principles

1. **Schema-Driven**: All authentication is configured via JSON schemas in the widget definition
2. **No Custom Code Required**: Users can create new widgets without writing Elixir or TypeScript code
3. **Provider Agnostic**: The same infrastructure works for Spotify, YouTube, Twitter, any OAuth 2.0 provider
4. **Secure by Default**: Credentials are encrypted, tokens are refreshed automatically

## Widget Integration Schema Extensions

### Enhanced Credential Schema

The `credential_schema` in widget integrations is extended to support OAuth 2.0 declaratively:

```json
{
  "credential_schema": {
    "auth_type": "oauth2",
    "oauth2": {
      "authorization_url": "https://accounts.spotify.com/authorize",
      "token_url": "https://accounts.spotify.com/api/token",
      "scopes": ["user-read-currently-playing", "user-read-playback-state"],
      "pkce": false,
      "token_placement": "header",
      "client_auth": "basic"
    },
    "fields": {
      "client_id": {
        "type": "string",
        "required": true,
        "label": {
          "en": "Client ID",
          "es": "ID de Cliente",
          "de": "Client-ID"
        },
        "description": {
          "en": "OAuth 2.0 Client ID from the provider's developer dashboard"
        },
        "input_type": "text"
      },
      "client_secret": {
        "type": "string",
        "required": true,
        "label": {
          "en": "Client Secret"
        },
        "sensitive": true,
        "input_type": "password"
      }
    }
  }
}
```

### Supported Auth Types

1. **oauth2**: Full OAuth 2.0 authorization code flow
2. **oauth2_client_credentials**: OAuth 2.0 client credentials grant
3. **api_key**: Simple API key authentication
4. **basic**: HTTP Basic Authentication
5. **custom**: Provider-specific headers/params (no special handling)

### OAuth 2.0 Configuration Fields

| Field | Description | Default |
|-------|-------------|---------|
| `authorization_url` | URL for user authorization | Required |
| `token_url` | URL for token exchange | Required |
| `scopes` | Required OAuth scopes | `[]` |
| `pkce` | Use PKCE challenge | `false` |
| `token_placement` | Where to send access token: `header`, `query`, `body` | `header` |
| `client_auth` | How to authenticate client: `basic`, `post` | `basic` |
| `refresh_margin_seconds` | Refresh token before expiry | `300` |

## Localization Support

Labels and descriptions in the schema support multiple languages:

```json
{
  "label": {
    "en": "API Key",
    "es": "Clave API",
    "de": "API-Schlüssel",
    "fr": "Clé API",
    "sv": "API-nyckel",
    "zh": "API 密钥",
    "ar": "مفتاح API",
    "ko": "API 키",
    "ja": "APIキー"
  }
}
```

If only a string is provided (not an object), it's treated as English-only:
```json
{
  "label": "API Key"
}
```

## Generic OAuth Controller

Replace the Spotify-specific controller with a generic one:

### Routes

```elixir
# Generic OAuth routes
scope "/auth/widget-integrations/:integration_id", CastmillWeb do
  pipe_through(:oauth)
  
  # Initiate OAuth flow
  get("/authorize", WidgetOAuthController, :authorize)
  
  # OAuth callback
  get("/callback", WidgetOAuthController, :callback)
end
```

### Controller Logic

```elixir
defmodule CastmillWeb.WidgetOAuthController do
  def authorize(conn, %{"integration_id" => integration_id} = params) do
    widget_config_id = params["widget_config_id"]
    organization_id = params["organization_id"]
    
    # Fetch integration and its credential_schema
    integration = Integrations.get_integration!(integration_id)
    oauth_config = integration.credential_schema["oauth2"]
    
    # Generate authorization URL from schema
    url = OAuth.Generic.authorization_url(
      oauth_config["authorization_url"],
      oauth_config["scopes"],
      %{
        integration_id: integration_id,
        widget_config_id: widget_config_id,
        organization_id: organization_id
      }
    )
    
    redirect(conn, external: url)
  end
  
  def callback(conn, %{"code" => code, "state" => state}) do
    {:ok, context} = OAuth.Generic.validate_state(state)
    
    integration = Integrations.get_integration!(context.integration_id)
    oauth_config = integration.credential_schema["oauth2"]
    
    # Exchange code using schema-defined token URL
    {:ok, tokens} = OAuth.Generic.exchange_code(
      oauth_config["token_url"],
      code,
      oauth_config["client_auth"],
      get_client_credentials(context.organization_id, integration)
    )
    
    # Store credentials
    store_credentials(context, integration, tokens)
    
    redirect_with_success(conn, context)
  end
end
```

## Generic Credential Configuration Component

A reusable SolidJS component that renders based on `credential_schema`:

```tsx
interface CredentialConfigProps {
  store: AddonStore;
  integration: WidgetIntegration;
  widgetConfigId?: string;  // For widget-scoped credentials
  onCredentialsChange?: (valid: boolean) => void;
}

export const CredentialConfig: Component<CredentialConfigProps> = (props) => {
  const schema = () => props.integration.credential_schema;
  const authType = () => schema()?.auth_type || 'custom';
  
  // Get localized label
  const getLabel = (field: any) => {
    if (typeof field.label === 'string') return field.label;
    const locale = props.store.i18n?.locale() || 'en';
    return field.label[locale] || field.label['en'] || '';
  };
  
  return (
    <div class="credential-config">
      <Show when={authType() === 'oauth2'}>
        <OAuth2Config 
          integration={props.integration}
          store={props.store}
          widgetConfigId={props.widgetConfigId}
        />
      </Show>
      
      <Show when={authType() === 'api_key'}>
        <ApiKeyConfig 
          schema={schema()}
          store={props.store}
          integration={props.integration}
        />
      </Show>
      
      <Show when={authType() === 'custom'}>
        <CustomFieldsConfig 
          schema={schema()}
          store={props.store}
          getLabel={getLabel}
        />
      </Show>
    </div>
  );
};
```

### OAuth2Config Sub-component

```tsx
const OAuth2Config: Component<{...}> = (props) => {
  const [isConnected, setIsConnected] = createSignal(false);
  const [connectionStatus, setConnectionStatus] = createSignal<'none' | 'connecting' | 'connected' | 'error'>('none');
  
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;
  
  const initiateOAuth = () => {
    const integration = props.integration;
    const redirectUrl = window.location.href;
    
    // Use generic OAuth route with integration ID
    const authUrl = `/auth/widget-integrations/${integration.id}/authorize?` + 
      new URLSearchParams({
        widget_config_id: props.widgetConfigId || '',
        organization_id: props.store.organizations.selectedId,
        redirect_url: redirectUrl,
      }).toString();
    
    window.location.href = authUrl;
  };
  
  return (
    <div class="oauth2-config">
      <Show when={!isConnected()} fallback={<ConnectedStatus {...} />}>
        <p>{t('widgets.integrations.oauth.description')}</p>
        <Button 
          label={t('widgets.integrations.oauth.connect')}
          onClick={initiateOAuth}
        />
      </Show>
    </div>
  );
};
```

## Backend: Generic OAuth Module

```elixir
defmodule Castmill.Widgets.Integrations.OAuth.Generic do
  @moduledoc """
  Generic OAuth 2.0 implementation that works with any provider
  based on credential_schema configuration.
  """
  
  @doc """
  Generates authorization URL from provider configuration.
  """
  def authorization_url(auth_url, scopes, context, opts \\ []) do
    state = generate_state(context)
    
    params = %{
      "response_type" => "code",
      "scope" => Enum.join(scopes, " "),
      "state" => state
    }
    
    # Add PKCE if configured
    params = if opts[:pkce] do
      {challenge, verifier} = generate_pkce()
      store_pkce_verifier(state, verifier)
      Map.merge(params, %{
        "code_challenge" => challenge,
        "code_challenge_method" => "S256"
      })
    else
      params
    end
    
    {:ok, "#{auth_url}?#{URI.encode_query(params)}", state}
  end
  
  @doc """
  Exchanges authorization code for tokens using provider configuration.
  """
  def exchange_code(token_url, code, client_auth, {client_id, client_secret}, opts \\ []) do
    body = %{
      "grant_type" => "authorization_code",
      "code" => code,
      "redirect_uri" => opts[:redirect_uri]
    }
    
    headers = case client_auth do
      "basic" ->
        [{"Authorization", "Basic " <> Base.encode64("#{client_id}:#{client_secret}")}]
      "post" ->
        body = Map.merge(body, %{"client_id" => client_id, "client_secret" => client_secret})
        []
    end
    
    # Make request and parse response
    case HTTPoison.post(token_url, URI.encode_query(body), headers ++ [{"Content-Type", "application/x-www-form-urlencoded"}]) do
      {:ok, %{status_code: 200, body: response}} ->
        parse_token_response(response)
      {:ok, %{status_code: status, body: error}} ->
        {:error, {:token_exchange_failed, status, error}}
      {:error, reason} ->
        {:error, {:http_error, reason}}
    end
  end
  
  @doc """
  Refreshes an access token using the refresh token.
  """
  def refresh_token(token_url, refresh_token, client_auth, {client_id, client_secret}) do
    # Similar to exchange_code but with grant_type: refresh_token
  end
end
```

## Data Transformation Configuration

For PULL integrations, the response transformation can be defined in the widget:

```json
{
  "pull_config": {
    "transform": {
      "track_name": "$.item.name",
      "artist_name": "$.item.artists[0].name",
      "album_name": "$.item.album.name",
      "album_art_url": "$.item.album.images[0].url",
      "is_playing": "$.is_playing"
    }
  }
}
```

This uses JSONPath expressions to map API responses to widget data schema.

## Fetcher Module Pattern

For complex transformations, a fetcher module can still be specified:

```json
{
  "pull_config": {
    "fetcher_module": "Castmill.Widgets.Integrations.Fetchers.Generic",
    "transform": {...}
  }
}
```

The Generic fetcher applies JSONPath transformations. Custom fetchers can be added for complex cases.

## Migration Path

### Phase 1: Generic OAuth Controller
1. Create `WidgetOAuthController` that reads from `credential_schema`
2. Add generic OAuth routes
3. Keep Spotify-specific controller as fallback

### Phase 2: Generic Credential UI
1. Create `CredentialConfig` component
2. Render forms based on `credential_schema`
3. Support OAuth 2.0, API keys, and custom fields

### Phase 3: Localization
1. Extend `credential_schema` to support localized labels
2. Update widget JSON format to include locales

### Phase 4: Deprecate Provider-Specific Code
1. Remove Spotify-specific OAuth controller
2. Update Spotify widget to use generic system
3. Document the generic integration pattern

## Example: Spotify Widget as Generic

The Spotify widget would be defined as:

```json
{
  "name": "Spotify Now Playing",
  "slug": "spotify-now-playing",
  "credential_schema": {
    "auth_type": "oauth2",
    "oauth2": {
      "authorization_url": "https://accounts.spotify.com/authorize",
      "token_url": "https://accounts.spotify.com/api/token",
      "scopes": ["user-read-currently-playing", "user-read-playback-state"],
      "client_auth": "basic",
      "refresh_margin_seconds": 300
    },
    "fields": {
      "client_id": {
        "type": "string",
        "required": true,
        "label": {"en": "Spotify Client ID", "es": "ID de Cliente de Spotify"},
        "description": {"en": "Get this from the Spotify Developer Dashboard"},
        "input_type": "text",
        "help_url": "https://developer.spotify.com/dashboard"
      },
      "client_secret": {
        "type": "string",
        "required": true,
        "label": {"en": "Spotify Client Secret"},
        "sensitive": true,
        "input_type": "password"
      }
    }
  },
  "pull_config": {
    "endpoint": "https://api.spotify.com/v1/me/player/currently-playing",
    "interval_seconds": 15,
    "transform": {
      "track_name": "$.item.name",
      "artist_name": {
        "path": "$.item.artists[*].name",
        "join": ", "
      },
      "album_name": "$.item.album.name",
      "album_art_url": "$.item.album.images[0].url",
      "duration_ms": "$.item.duration_ms",
      "progress_ms": "$.progress_ms",
      "is_playing": "$.is_playing"
    },
    "no_data_response": {
      "track_name": "No track playing",
      "artist_name": "Spotify",
      "is_playing": false
    }
  }
}
```

No custom Elixir code needed!
