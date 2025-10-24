# Widget Template System & Integration Architecture

## Overview

Castmill widgets are **JSON-based templates** that define both the UI structure and data requirements. The integration system seamlessly connects third-party data sources to these templates.

## Widget Template Structure

A widget consists of three main components:

### 1. Template
Defines the visual layout and components using JSON:

```json
{
  "type": "container",
  "opts": {
    "direction": "column"
  },
  "components": [
    {
      "type": "text",
      "field": "temperature",
      "style": {"fontSize": "48px"}
    },
    {
      "type": "text",
      "field": "condition",
      "style": {"fontSize": "24px"}
    },
    {
      "type": "image",
      "field": "icon_url"
    }
  ]
}
```

### 2. Options Schema
Defines configuration options that users can set when creating a widget instance:

```json
{
  "latitude": {
    "type": "number",
    "required": true,
    "description": "Location latitude"
  },
  "longitude": {
    "type": "number",
    "required": true,
    "description": "Location longitude"
  },
  "units": {
    "type": "string",
    "default": "metric",
    "enum": ["metric", "imperial"],
    "description": "Temperature units"
  },
  "refresh_interval": {
    "type": "number",
    "default": 1800,
    "min": 300,
    "max": 3600,
    "description": "Update interval in seconds"
  }
}
```

### 3. Data Schema
Defines the structure of data that the template expects:

```json
{
  "temperature": {
    "type": "number",
    "required": true
  },
  "condition": {
    "type": "string",
    "required": true
  },
  "icon_url": {
    "type": "url",
    "required": false
  },
  "location": {
    "type": "string"
  },
  "humidity": {
    "type": "number"
  },
  "wind_speed": {
    "type": "number"
  }
}
```

## How Integrations Work with Templates

### Complete Flow

1. **Widget Definition** (created once)
```elixir
# Weather widget with template and schemas
{:ok, widget} = Widgets.create_widget(%{
  name: "Weather Display",
  slug: "weather",
  template: %{
    "type" => "container",
    "components" => [
      %{"type" => "text", "field" => "temperature"},
      %{"type" => "text", "field" => "condition"}
    ]
  },
  options_schema: %{
    "latitude" => %{"type" => "number", "required" => true},
    "longitude" => %{"type" => "number", "required" => true},
    "units" => %{"type" => "string", "default" => "metric"}
  },
  data_schema: %{
    "temperature" => %{"type" => "number", "required" => true},
    "condition" => %{"type" => "string", "required" => true},
    "location" => %{"type" => "string"}
  }
})
```

2. **Integration Definition** (created once per third-party service)
```elixir
# OpenWeather integration for the weather widget
{:ok, integration} = Integrations.create_integration(%{
  widget_id: widget.id,
  name: "openweather",
  description: "OpenWeather API Integration",
  integration_type: "pull",
  credential_scope: "organization",
  
  # Credentials needed from third-party
  credential_schema: %{
    "api_key" => %{
      "type" => "string",
      "required" => true,
      "sensitive" => true,
      "label" => "OpenWeather API Key"
    }
  },
  
  # Configuration for the integration
  pull_endpoint: "https://api.openweathermap.org/data/2.5/weather",
  pull_interval_seconds: 1800,
  pull_config: %{
    "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.OpenWeather",
    "timeout" => 5000
  }
})
```

3. **Organization Sets Credentials** (once per organization)
```bash
POST /organizations/org-123/widget-integrations/1/credentials
{
  "credentials": {
    "api_key": "abcdef123456"
  }
}
```

4. **User Creates Widget Instance** (per playlist/channel)
```elixir
# User adds weather widget to a playlist
playlist_item = create_playlist_item(%{
  playlist_id: "playlist-123",
  duration: 30,
  offset: 0
})

# Widget config with user-specified options
{:ok, widget_config} = Widgets.new_widget_config(
  widget.id,
  playlist_item.id,
  %{
    "latitude" => 59.3293,   # Stockholm
    "longitude" => 18.0686,
    "units" => "metric"
  }
)
```

5. **Integration Fetches Data** (automatically, periodically)
```elixir
# System calls the fetcher module
defmodule Castmill.Widgets.Integrations.Fetchers.OpenWeather do
  def fetch(credentials, options) do
    # Fetch from API using credentials and options
    url = "https://api.openweathermap.org/data/2.5/weather?" <>
          "lat=#{options["latitude"]}&" <>
          "lon=#{options["longitude"]}&" <>
          "units=#{options["units"]}&" <>
          "appid=#{credentials["api_key"]}"
    
    {:ok, response} = HTTPoison.get(url)
    {:ok, api_data} = Jason.decode(response.body)
    
    # Transform to match widget's data_schema
    {:ok, %{
      "temperature" => api_data["main"]["temp"],
      "condition" => api_data["weather"] |> List.first() |> Map.get("main"),
      "location" => api_data["name"],
      "humidity" => api_data["main"]["humidity"],
      "wind_speed" => api_data["wind"]["speed"]
    }}
  end
end
```

6. **Data is Cached and Versioned**
```elixir
# System automatically stores in widget_integration_data
%{
  widget_integration_id: 1,
  widget_config_id: "config-456",
  data: %{
    "temperature" => 18.5,
    "condition" => "Clouds",
    "location" => "Stockholm"
  },
  version: 42,
  fetched_at: ~U[2025-10-24 14:00:00Z]
}
```

7. **Updates Broadcast via WebSocket**
```elixir
# System broadcasts to all connected players
CastmillWeb.Endpoint.broadcast(
  "widget_data:config-456",
  "data_updated",
  %{
    version: 42,
    data: %{
      "temperature" => 18.5,
      "condition" => "Clouds",
      "location" => "Stockholm"
    }
  }
)
```

8. **Player Receives and Renders**
```typescript
// Player connected to WebSocket channel
channel.on('data_updated', (payload) => {
  // Template engine consumes the data
  renderTemplate(widget.template, payload.data);
  // Result:
  // <div class="container">
  //   <div class="text">18.5°C</div>
  //   <div class="text">Clouds</div>
  // </div>
});
```

## Schema Validation

The system validates data at multiple levels:

### 1. Widget Creation
```elixir
# Validates options_schema and data_schema syntax
{:ok, widget} = Widgets.create_widget(%{
  options_schema: %{"latitude" => "number"},  # Valid
  data_schema: %{"temp" => "number"}          # Valid
})

{:error, changeset} = Widgets.create_widget(%{
  options_schema: %{"latitude" => "invalid"}  # ERROR: not a recognized type
})
```

### 2. Widget Instance Creation
```elixir
# Validates options against options_schema
{:ok, config} = Widgets.new_widget_config(widget.id, item.id, %{
  "latitude" => 59.3293,  # Valid: matches "number" type
  "longitude" => 18.0686
})

{:error, reason} = Widgets.new_widget_config(widget.id, item.id, %{
  "latitude" => "Stockholm"  # ERROR: not a number
})
```

### 3. Integration Data Storage
```elixir
# Validates data against data_schema
{:ok, _} = Integrations.upsert_integration_data(%{
  widget_integration_id: 1,
  widget_config_id: "config-456",
  data: %{
    "temperature" => 18.5,    # Valid: matches data_schema
    "condition" => "Clouds"
  }
})

{:error, reason} = Integrations.upsert_integration_data(%{
  data: %{
    "temperature" => "warm"   # ERROR: not a number
  }
})
```

## Advanced Template Features

### Lists and Iterations
```json
{
  "template": {
    "type": "list",
    "field": "forecast",
    "item_template": {
      "type": "container",
      "components": [
        {"type": "text", "field": "day"},
        {"type": "text", "field": "temp"}
      ]
    }
  },
  "data_schema": {
    "forecast": {
      "type": "list",
      "items": {
        "type": "map",
        "schema": {
          "day": {"type": "string"},
          "temp": {"type": "number"}
        }
      }
    }
  }
}
```

Integration provides:
```json
{
  "forecast": [
    {"day": "Monday", "temp": 18},
    {"day": "Tuesday", "temp": 20},
    {"day": "Wednesday", "temp": 17}
  ]
}
```

### References to Media
```json
{
  "data_schema": {
    "background_image": {
      "type": "ref",
      "collection": "medias"
    }
  }
}
```

Integration can reference uploaded media:
```json
{
  "background_image": "media-uuid-123"
}
```

### Nested Objects
```json
{
  "data_schema": {
    "current": {
      "type": "map",
      "schema": {
        "temp": {"type": "number"},
        "humidity": {"type": "number"}
      }
    }
  }
}
```

## Multiple Integrations per Widget

A widget can have multiple integration options:

```elixir
# OpenWeather integration
{:ok, openweather} = Integrations.create_integration(%{
  widget_id: widget.id,
  name: "openweather",
  ...
})

# WeatherAPI.com integration (alternative)
{:ok, weatherapi} = Integrations.create_integration(%{
  widget_id: widget.id,
  name: "weatherapi",
  ...
})
```

Users choose which integration to use when configuring the widget instance.

## Best Practices

### 1. Match Data Schema Exactly
```elixir
# Widget expects:
data_schema: %{"temperature" => "number"}

# Integration MUST provide:
%{"temperature" => 18.5}  # ✅ Correct

# NOT:
%{"temp" => 18.5}         # ❌ Wrong field name
%{"temperature" => "18"}  # ❌ Wrong type
```

### 2. Handle Missing Optional Fields
```elixir
data_schema: %{
  "temperature" => %{"type" => "number", "required" => true},
  "humidity" => %{"type" => "number", "required" => false}
}

# Valid data:
%{"temperature" => 18.5}  # ✅ OK, humidity is optional
%{"temperature" => 18.5, "humidity" => 65}  # ✅ OK, both provided
```

### 3. Use Defaults in Options Schema
```elixir
options_schema: %{
  "units" => %{
    "type" => "string",
    "default" => "metric"  # User doesn't have to specify
  }
}
```

### 4. Document Field Meanings
```elixir
data_schema: %{
  "temperature" => %{
    "type" => "number",
    "description" => "Temperature in degrees (Celsius or Fahrenheit based on units option)"
  }
}
```

## Example: RSS Feed Widget

Complete example showing all components:

```elixir
# 1. Widget definition
{:ok, rss_widget} = Widgets.create_widget(%{
  name: "RSS Feed Display",
  slug: "rss-feed",
  template: %{
    "type" => "list",
    "field" => "items",
    "item_template" => %{
      "type" => "container",
      "components" => [
        %{"type" => "text", "field" => "title"},
        %{"type" => "text", "field" => "description"}
      ]
    }
  },
  options_schema: %{
    "feed_url" => %{
      "type" => "url",
      "required" => true,
      "description" => "RSS feed URL"
    },
    "max_items" => %{
      "type" => "number",
      "default" => 10,
      "min" => 1,
      "max" => 50
    }
  },
  data_schema: %{
    "items" => %{
      "type" => "list",
      "items" => %{
        "type" => "map",
        "schema" => %{
          "title" => %{"type" => "string", "required" => true},
          "description" => %{"type" => "string"},
          "link" => %{"type" => "url"}
        }
      }
    }
  }
})

# 2. Integration (no credentials needed for public RSS)
{:ok, rss_integration} = Integrations.create_integration(%{
  widget_id: rss_widget.id,
  name: "rss",
  integration_type: "pull",
  credential_scope: "widget",
  credential_schema: %{},  # No credentials needed
  pull_interval_seconds: 300,
  pull_config: %{
    "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.RSS"
  }
})

# 3. Fetcher implementation
defmodule Castmill.Widgets.Integrations.Fetchers.RSS do
  def fetch(_credentials, options) do
    # Fetch RSS feed
    {:ok, response} = HTTPoison.get(options["feed_url"])
    
    # Parse XML
    {:ok, feed} = parse_rss(response.body)
    
    # Transform to data_schema
    items = feed.items
    |> Enum.take(options["max_items"] || 10)
    |> Enum.map(fn item ->
      %{
        "title" => item.title,
        "description" => item.description,
        "link" => item.link
      }
    end)
    
    {:ok, %{"items" => items}}
  end
end

# 4. User creates instance
{:ok, config} = Widgets.new_widget_config(rss_widget.id, item.id, %{
  "feed_url" => "https://example.com/rss",
  "max_items" => 5
})

# System fetches and broadcasts data automatically
```

## Summary

The integration system is designed to work seamlessly with Castmill's JSON-based widget templates:

1. **Widgets define** what data they need (`data_schema`)
2. **Integrations provide** data matching that schema
3. **System handles** fetching, caching, versioning, and broadcasting
4. **Players receive** updates in real-time via WebSocket
5. **Template engine** renders the data automatically

This architecture allows:
- **Widget developers** to focus on templates and UI
- **Integration developers** to focus on data transformation
- **Users** to configure widgets without coding
- **Players** to receive updates efficiently

The separation of concerns makes the system modular, maintainable, and extensible.
