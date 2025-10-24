# Widget Integration API Reference

This document provides a complete reference for the Widget Third-Party Integration API.

## Base URL

All API endpoints are prefixed with the base URL:
```
https://api.castmill.com/dashboard
```

## Authentication

All endpoints (except webhooks) require authentication using a valid session token or API key.

## Endpoints

### Integration Management

#### List Widget Integrations

Lists all active integrations for a specific widget.

```http
GET /organizations/:organization_id/widgets/:widget_id/integrations
```

**Parameters:**
- `organization_id` (path, required): Organization ID
- `widget_id` (path, required): Widget ID

**Response:**
```json
{
  "data": [
    {
      "id": 123,
      "widget_id": "weather-widget",
      "name": "openweather",
      "description": "OpenWeather API Integration",
      "integration_type": "pull",
      "credential_scope": "organization",
      "pull_endpoint": "https://api.openweathermap.org/data/2.5/weather",
      "pull_interval_seconds": 1800,
      "credential_schema": {
        "api_key": {
          "type": "string",
          "required": true,
          "label": "API Key"
        }
      },
      "is_active": true
    }
  ]
}
```

#### Get Integration Details

Gets details for a specific integration.

```http
GET /organizations/:organization_id/widget-integrations/:integration_id
```

**Parameters:**
- `organization_id` (path, required): Organization ID
- `integration_id` (path, required): Integration ID

**Response:**
```json
{
  "data": {
    "id": 123,
    "name": "openweather",
    "description": "OpenWeather API Integration",
    "integration_type": "pull",
    "credential_scope": "organization",
    "config_schema": {
      "units": {
        "type": "string",
        "enum": ["metric", "imperial"],
        "default": "metric"
      }
    },
    "credential_schema": {
      "api_key": {
        "type": "string",
        "required": true,
        "sensitive": true
      }
    },
    "pull_endpoint": "https://api.openweathermap.org/data/2.5/weather",
    "pull_interval_seconds": 1800
  }
}
```

### Credential Management

#### Create/Update Organization Credentials

Creates or updates organization-scoped credentials for an integration.

```http
POST /organizations/:organization_id/widget-integrations/:integration_id/credentials
PUT /organizations/:organization_id/widget-integrations/:integration_id/credentials
```

**Parameters:**
- `organization_id` (path, required): Organization ID
- `integration_id` (path, required): Integration ID

**Request Body:**
```json
{
  "credentials": {
    "api_key": "your-api-key-here",
    "username": "optional-username"
  }
}
```

**Response:**
```json
{
  "data": {
    "id": "credential-uuid",
    "widget_integration_id": 123,
    "organization_id": "org-uuid",
    "metadata": {
      "username": "optional-username"
    },
    "validated_at": "2025-10-24T10:56:00Z",
    "is_valid": true
  }
}
```

**Notes:**
- Credentials are encrypted using the organization's encryption key
- Only non-sensitive metadata is returned in the response
- Sensitive fields (containing "password", "secret", "key", "token") are excluded from metadata

#### Create/Update Widget Credentials

Creates or updates widget-scoped credentials for a specific widget instance.

```http
POST /widget-configs/:widget_config_id/credentials
PUT /widget-configs/:widget_config_id/credentials
```

**Parameters:**
- `widget_config_id` (path, required): Widget Config ID
- `integration_id` (query, required): Integration ID

**Request Body:**
```json
{
  "integration_id": 123,
  "credentials": {
    "access_token": "widget-specific-token",
    "page_id": "12345"
  }
}
```

**Response:**
```json
{
  "data": {
    "id": "credential-uuid",
    "widget_integration_id": 123,
    "widget_config_id": "config-uuid",
    "metadata": {
      "page_id": "12345"
    },
    "validated_at": "2025-10-24T10:56:00Z",
    "is_valid": true
  }
}
```

#### Test Integration

Tests integration credentials by verifying they exist and are valid.

```http
POST /organizations/:organization_id/widget-integrations/:integration_id/test
```

**Parameters:**
- `organization_id` (path, required): Organization ID
- `integration_id` (path, required): Integration ID

**Response:**
```json
{
  "success": true,
  "message": "Credentials found and validated",
  "validated_at": "2025-10-24T10:56:00Z"
}
```

**Error Response:**
```json
{
  "error": "Integration or credentials not found"
}
```

### Data Access (for Players)

#### Get Widget Data

Gets integration data for a widget config with version-based caching.

```http
GET /widget-configs/:widget_config_id/data?version=:current_version
```

**Parameters:**
- `widget_config_id` (path, required): Widget Config ID
- `version` (query, optional): Current version number

**Response (when version is different or not provided):**
```json
{
  "data": {
    "temperature": 72,
    "condition": "sunny",
    "location": "Stockholm"
  },
  "version": 42,
  "fetched_at": "2025-10-24T10:56:00Z",
  "status": "success"
}
```

**Response (when version matches):**
```
HTTP 304 Not Modified
```

**Error Response:**
```json
{
  "error": "No integration data found"
}
```

**Usage Pattern:**
```javascript
// Player polling logic
async function pollWidgetData(widgetConfigId, currentVersion) {
  const url = `/widget-configs/${widgetConfigId}/data`;
  const params = currentVersion ? `?version=${currentVersion}` : '';
  
  const response = await fetch(url + params);
  
  if (response.status === 304) {
    // Data unchanged
    return null;
  }
  
  if (response.ok) {
    const data = await response.json();
    return data;
  }
  
  throw new Error('Failed to fetch widget data');
}

// Poll every 30 seconds
setInterval(async () => {
  const newData = await pollWidgetData(configId, currentVersion);
  if (newData) {
    currentVersion = newData.version;
    updateWidget(newData.data);
  }
}, 30000);
```

#### Refresh Widget Data

Forces an immediate refresh of widget data (admin only).

```http
POST /widget-configs/:widget_config_id/refresh
```

**Parameters:**
- `widget_config_id` (path, required): Widget Config ID

**Response:**
```json
{
  "message": "Refresh queued",
  "widget_config_id": "config-uuid"
}
```

**Notes:**
- This endpoint queues a background job to fetch fresh data
- Returns immediately with 202 Accepted
- Actual data will be updated asynchronously

### Webhooks (PUSH Mode)

#### Receive Webhook

Receives webhook data from third-party services.

```http
POST /webhooks/widgets/:integration_id/:widget_config_id
```

**Parameters:**
- `integration_id` (path, required): Integration ID
- `widget_config_id` (path, required): Widget Config ID

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: <signature> (optional, depends on integration)
X-API-Key: <api-key> (optional, depends on integration)
```

**Request Body:**
```json
{
  "data": {
    "temperature": 75,
    "condition": "cloudy"
  }
}
```

**Response:**
```json
{
  "success": true,
  "version": 43,
  "received_at": "2025-10-24T10:56:00Z"
}
```

**Error Responses:**

Invalid signature:
```json
{
  "error": "Invalid webhook signature"
}
```

Integration doesn't support webhooks:
```json
{
  "error": "This integration does not support webhooks"
}
```

**Notes:**
- This endpoint is publicly accessible (no authentication required)
- Security is enforced through webhook signatures or API keys
- Version number is automatically incremented
- Players will detect the new version on their next poll

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 202 | Accepted (for async operations) |
| 304 | Not Modified (version unchanged) |
| 400 | Bad Request (invalid parameters or scope mismatch) |
| 401 | Unauthorized (invalid credentials or signature) |
| 404 | Not Found (resource doesn't exist) |
| 422 | Unprocessable Entity (validation errors) |
| 500 | Internal Server Error |

## Integration Configuration Examples

### Weather Widget (Organization Credentials, PULL)

**Create Integration:**
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
      "sensitive": true,
      "help": "Get your API key from openweathermap.org"
    }
  },
  "config_schema": {
    "units": {
      "type": "string",
      "enum": ["metric", "imperial"],
      "default": "metric",
      "label": "Temperature Units"
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

**Set Organization Credentials:**
```bash
curl -X POST \
  https://api.castmill.com/dashboard/organizations/org-123/widget-integrations/1/credentials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "api_key": "your-openweather-api-key"
    }
  }'
```

### Social Feed (Widget Credentials, PUSH)

**Create Integration:**
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
      "required": true,
      "label": "Facebook Page ID"
    },
    "webhook_verify_token": {
      "type": "string",
      "required": true,
      "sensitive": true,
      "label": "Webhook Verification Token"
    }
  },
  "push_webhook_path": "/facebook",
  "push_config": {
    "signature_header": "X-Hub-Signature",
    "verify_signature": true
  }
}
```

**Set Widget Credentials:**
```bash
curl -X POST \
  https://api.castmill.com/dashboard/widget-configs/config-456/credentials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": 2,
    "credentials": {
      "page_id": "123456789",
      "webhook_verify_token": "my-secret-token"
    }
  }'
```

**Configure Facebook Webhook:**
```
Webhook URL: https://api.castmill.com/webhooks/widgets/2/config-456
Verify Token: my-secret-token
```

### RSS Feed (No Credentials, PULL)

**Create Integration:**
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
      "label": "RSS Feed URL",
      "pattern": "^https?://.+"
    },
    "max_items": {
      "type": "number",
      "default": 10,
      "min": 1,
      "max": 50,
      "label": "Maximum Items"
    }
  },
  "pull_interval_seconds": 300
}
```

**No credentials needed** - feed URL is stored in widget config options.

## Security Best Practices

### For Integration Developers

1. **Always use HTTPS** for webhook endpoints
2. **Implement signature verification** for webhooks
3. **Rate limit** your API calls appropriately
4. **Handle errors gracefully** and log them for debugging
5. **Encrypt sensitive data** - all credentials are automatically encrypted

### For Widget Developers

1. **Validate all input data** from integrations
2. **Handle missing or stale data** gracefully
3. **Use version-based polling** to minimize bandwidth
4. **Respect pull intervals** - don't poll more frequently than needed
5. **Display error states** when integration data is unavailable

### For Organization Administrators

1. **Rotate API keys regularly** using the credential update endpoints
2. **Monitor integration health** through the dashboard
3. **Test integrations** after credential changes
4. **Use organization-scoped credentials** when possible for easier management
5. **Review webhook logs** for suspicious activity

## Rate Limiting

API endpoints follow these rate limits:

- **Integration Management**: 100 requests per minute per organization
- **Credential Management**: 10 requests per minute per organization
- **Data Access (Players)**: 1 request per widget per pull interval (configured in integration)
- **Webhooks**: 1000 requests per hour per integration

Exceeding rate limits returns a 429 Too Many Requests response.

## Support

For questions or issues:
- Documentation: https://docs.castmill.com
- GitHub Issues: https://github.com/castmill/castmill/issues
- Email: support@castmill.com
