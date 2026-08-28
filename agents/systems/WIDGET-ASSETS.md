# Widget Asset Management Architecture

## Overview

This document outlines the architecture for managing static assets (icons, fonts, images, styles) required by widget templates in the Castmill Digital Signage Platform.

## Goals

1. **User-Uploadable Widgets**: Enable Castmill users to create and upload their own widgets without requiring backend or frontend code changes
2. **Secure Asset Handling**: Validate uploaded assets with schema validation, file size limits, and integrity checks
3. **Flexible Serving**: Support multiple storage backends (filesystem, S3, CDN) with relative paths
4. **Generic Integrations**: Provide reusable integrations (RSS, social feeds) that users can leverage
5. **Complete Self-Service**: Users can implement any widget requirement by uploading JSON templates and assets

## Problem Statement

Widgets need bundled static assets:
- **Icons**: Weather conditions, social media logos, status indicators
- **Fonts**: Custom typography for branding
- **Images**: Backgrounds, decorative elements, logos  
- **Styles**: CSS for advanced layouts (optional)

Current system lacks:
- Standardized asset bundling mechanism
- Secure upload and validation
- Schema-driven asset definitions
- Runtime URL resolution

## ⚠️ Widget Schema Validation Rules

When creating custom widgets, the `options_schema` and `data_schema` fields are validated against strict rules. Understanding these rules is critical to avoid upload errors.

### Valid Schema Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text values | `"title": "string"` |
| `number` | Numeric values (int or float) | `"score": "number"` |
| `boolean` | True/false values | `"enabled": "boolean"` |
| `url` | URL strings | `"link": "url"` |
| `color` | Color values (hex #RGB/#RRGGBB, rgba) | `"bg_color": "color"` |
| `city` | City name strings | `"location": "city"` |
| `layout` | Layout configuration object | `"layout": "layout"` |
| `layout-ref` | Reference to existing layout by ID | `"layout_id": "layout-ref"` |
| `list` | Array of items (NOT "array"!) | See below |
| `map` | Nested object structure | See below |
| `ref` | Reference to another entity | See below |

### ⚠️ Common Mistakes

1. **Using `"type": "array"` instead of `"type": "list"`**
   ```json
   // ❌ WRONG - will cause validation error
   "items": { "type": "array" }
   
   // ✅ CORRECT
   "items": { "type": "list", "items": { ... } }
   ```

2. **Using `"label"` attribute (not allowed)**
   ```json
   // ❌ WRONG - "label" is not a valid attribute
   "scroll_speed": { "type": "number", "label": "Speed" }
   
   // ✅ CORRECT - use "description" instead
   "scroll_speed": { "type": "number", "description": "Scroll speed" }
   ```

### Allowed Field Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `type` | string | **Required** - The data type |
| `required` | boolean | Whether the field is required |
| `default` | varies | Default value if not provided |
| `description` | string | Human-readable description |
| `help` | string | Additional help text |
| `placeholder` | string | Placeholder text for inputs |
| `min` | number | Minimum value (for numbers) |
| `max` | number | Maximum value (for numbers) |
| `order` | number | Display order in UI |
| `enum` | array | Allowed values for strings |
| `aspectRatios` | array | For layout types |
| `schema` | object | For `map` types - nested schema |
| `items` | object | For `list` types - item schema |
| `collection` | string | For `ref` types - target collection |

### List Schema Example

```json
"data_schema": {
  "items": {
    "type": "list",
    "description": "News items",
    "items": {
      "type": "map",
      "schema": {
        "title": "string",
        "pubDate": "string",
        "score": "number"
      }
    },
    "default": []
  }
}
```

### Map Schema Example

```json
"data_schema": {
  "weather": {
    "type": "map",
    "schema": {
      "temperature": { "type": "number", "required": true },
      "humidity": { "type": "number", "required": false }
    }
  }
}
```

### Reference Schema Example

```json
"data_schema": {
  "background_image": {
    "type": "ref",
    "collection": "medias"
  }
}
```

## Architecture

### Asset Manifest Structure

The `assets` field in the widget definition contains a manifest with **relative paths**. The system constructs absolute URLs at runtime based on the configured storage backend.

```json
{
  "assets": {
    "icons": {
      "sunny": {
        "path": "icons/sunny.svg",
        "type": "image/svg+xml",
        "size": 2048,
        "hash": "sha256:abc123..."
      }
    },
    "fonts": {
      "roboto": {
        "path": "fonts/Roboto-Regular.woff2",
        "type": "font/woff2",
        "size": 67624,
        "hash": "sha256:def456..."
      }
    }
  }
}
```

### Widget Package Format

Users upload widgets as `.zip` files with this structure:

```
weather-widget.zip
├── widget.json          # Widget definition with manifest
├── assets/
│   ├── icons/
│   │   ├── sunny.svg
│   │   ├── cloudy.svg
│   │   └── rainy.svg
│   ├── fonts/
│   │   └── Roboto-Regular.woff2
│   └── images/
│       └── background.png
└── README.md            # Optional documentation
```

### Asset Schema

Define asset constraints in the widget schema:

```json
{
  "assets_schema": {
    "type": "object",
    "properties": {
      "icons": {
        "type": "object",
        "patternProperties": {
          ".*": {
            "type": "object",
            "properties": {
              "path": {"type": "string", "pattern": "^icons/.*\\.(svg|png|jpg)$"},
              "type": {"type": "string", "enum": ["image/svg+xml", "image/png", "image/jpeg"]},
              "size": {"type": "integer", "maximum": 102400},
              "hash": {"type": "string", "pattern": "^sha256:[a-f0-9]{64}$"}
            },
            "required": ["path", "type", "size", "hash"]
          }
        }
      },
      "fonts": {
        "type": "object",
        "patternProperties": {
          ".*": {
            "type": "object",
            "properties": {
              "path": {"type": "string", "pattern": "^fonts/.*\\.(woff|woff2|ttf)$"},
              "type": {"type": "string", "enum": ["font/woff", "font/woff2", "font/ttf"]},
              "size": {"type": "integer", "maximum": 524288},
              "hash": {"type": "string", "pattern": "^sha256:[a-f0-9]{64}$"}
            },
            "required": ["path", "type", "size", "hash"]
          }
        }
      },
      "images": {
        "type": "object",
        "patternProperties": {
          ".*": {
            "type": "object",
            "properties": {
              "path": {"type": "string", "pattern": "^images/.*\\.(png|jpg|jpeg|webp)$"},
              "type": {"type": "string", "enum": ["image/png", "image/jpeg", "image/webp"]},
              "size": {"type": "integer", "maximum": 1048576},
              "hash": {"type": "string", "pattern": "^sha256:[a-f0-9]{64}$"}
            },
            "required": ["path", "type", "size", "hash"]
          }
        }
      }
    }
  }
}
```

### Upload Validation

When a user uploads a widget package, the system performs comprehensive validation:

#### 1. ZIP File Validation

```elixir
defmodule Castmill.Widgets.PackageValidator do
  @max_package_size 10 * 1024 * 1024  # 10MB
  @max_file_size %{
    "icons" => 100 * 1024,    # 100KB per icon
    "fonts" => 512 * 1024,    # 512KB per font
    "images" => 1024 * 1024,  # 1MB per image
    "styles" => 50 * 1024     # 50KB per stylesheet
  }
  @allowed_extensions %{
    "icons" => ~w(.svg .png .jpg .jpeg),
    "fonts" => ~w(.woff .woff2 .ttf),
    "images" => ~w(.png .jpg .jpeg .webp .gif),
    "styles" => ~w(.css)
  }

  def validate_package(zip_path) do
    with :ok <- check_package_size(zip_path),
         {:ok, files} <- extract_file_list(zip_path),
         :ok <- validate_structure(files),
         {:ok, widget_json} <- extract_widget_json(zip_path),
         :ok <- validate_widget_definition(widget_json),
         :ok <- validate_asset_files(zip_path, widget_json),
         :ok <- verify_asset_hashes(zip_path, widget_json) do
      {:ok, widget_json}
    end
  end

  defp check_package_size(zip_path) do
    case File.stat(zip_path) do
      {:ok, %{size: size}} when size <= @max_package_size -> :ok
      {:ok, %{size: size}} -> {:error, "Package too large: #{size} bytes (max: #{@max_package_size})"}
      error -> error
    end
  end

  defp validate_structure(files) do
    required_files = ["widget.json"]
    
    if Enum.all?(required_files, &(&1 in files)) do
      :ok
    else
      {:error, "Missing required files: #{inspect(required_files -- files)}"}
    end
  end

  defp validate_asset_files(zip_path, widget_json) do
    manifest = widget_json["assets"] || %{}
    
    Enum.reduce_while(manifest, :ok, fn {category, assets}, _acc ->
      max_size = @max_file_size[category] || 1024 * 1024
      allowed_exts = @allowed_extensions[category] || []
      
      case validate_category_assets(zip_path, assets, max_size, allowed_exts) do
        :ok -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp verify_asset_hashes(zip_path, widget_json) do
    manifest = widget_json["assets"] || %{}
    
    Enum.reduce_while(manifest, :ok, fn {_category, assets}, _acc ->
      case verify_category_hashes(zip_path, assets) do
        :ok -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp verify_category_hashes(zip_path, assets) do
    Enum.reduce_while(assets, :ok, fn {_name, asset}, _acc ->
      path = asset["path"]
      expected_hash = asset["hash"]
      
      with {:ok, content} <- extract_file(zip_path, "assets/#{path}"),
           actual_hash <- "sha256:" <> Base.encode16(:crypto.hash(:sha256, content), case: :lower) do
        if actual_hash == expected_hash do
          {:cont, :ok}
        else
          {:halt, {:error, "Hash mismatch for #{path}: expected #{expected_hash}, got #{actual_hash}"}}
        end
      end
    end)
  end
end
```

#### 2. Content Security Validation

```elixir
defmodule Castmill.Widgets.AssetSecurityValidator do
  def validate_asset_content(file_path, asset_type) do
    with {:ok, content} <- File.read(file_path),
         :ok <- check_magic_bytes(content, asset_type),
         :ok <- scan_for_threats(content, asset_type) do
      :ok
    end
  end

  defp check_magic_bytes(content, "image/svg+xml") do
    # Validate SVG structure, prevent XML bombs
    case content do
      <<"<?xml", _rest::binary>> -> validate_svg_content(content)
      <<"<svg", _rest::binary>> -> validate_svg_content(content)
      _ -> {:error, "Invalid SVG format"}
    end
  end

  defp check_magic_bytes(content, "image/png") do
    case content do
      <<0x89, 0x50, 0x4E, 0x47, _rest::binary>> -> :ok
      _ -> {:error, "Invalid PNG format"}
    end
  end

  # Additional magic byte checks for other formats...

  defp validate_svg_content(content) do
    # Prevent XXE attacks, script injection
    forbidden_patterns = [
      ~r/<script/i,
      ~r/javascript:/i,
      ~r/on\w+\s*=/i,  # Event handlers
      ~r/<!ENTITY/i     # Entity definitions
    ]
    
    if Enum.any?(forbidden_patterns, &Regex.match?(&1, content)) do
      {:error, "SVG contains forbidden content"}
    else
      :ok
    end
  end

  defp scan_for_threats(content, _type) do
    # Additional threat scanning
    # Could integrate with ClamAV or similar
    :ok
  end
end
```

### Storage and URL Resolution

Assets are stored with relative paths and resolved at runtime:

```elixir
defmodule Castmill.Widgets.AssetResolver do
  @doc """
  Resolves asset manifest paths to absolute URLs based on storage backend
  """
  def resolve_asset_urls(widget, storage_config \\ nil) do
    storage = storage_config || Application.get_env(:castmill, :asset_storage)
    base_url = get_base_url(storage, widget.slug)
    
    resolved_assets = 
      widget.assets
      |> Enum.map(fn {category, assets} ->
        resolved_category = 
          assets
          |> Enum.map(fn {name, asset} ->
            {name, Map.put(asset, "url", "#{base_url}/#{asset["path"]}")}
          end)
          |> Map.new()
        
        {category, resolved_category}
      end)
      |> Map.new()
    
    %{widget | assets: resolved_assets}
  end

  defp get_base_url(%{type: :filesystem, base_path: base}, slug) do
    "/widgets/#{slug}/assets"
  end

  defp get_base_url(%{type: :s3, bucket: bucket, region: region}, slug) do
    "https://#{bucket}.s3.#{region}.amazonaws.com/widgets/#{slug}/assets"
  end

  defp get_base_url(%{type: :cdn, domain: domain}, slug) do
    "https://#{domain}/widgets/#{slug}/assets"
  end
end
```

### Template Asset References

Templates reference assets using the `{key: "path"}` binding syntax with `assets.` prefix:

```json
{
  "template": {
    "type": "group",
    "components": [
      {
        "type": "image",
        "source": {
          "key": "assets.icons.{data.condition_icon}.url"
        },
        "style": {
          "width": 100,
          "height": 100
        }
      },
      {
        "type": "text",
        "text": {
          "key": "data.temperature"
        },
        "style": {
          "fontFamily": {
            "key": "assets.fonts.roboto.url"
          }
        }
      }
    ]
  }
}
```

The player resolves these bindings at runtime:
- `{key: "assets.icons.sunny.url"}` → `https://cdn.castmill.com/widgets/weather/assets/icons/sunny.svg`
- `{key: "assets.icons.{data.condition_icon}.url"}` → Dynamically resolves based on `data.condition_icon` value

## Complete Implementation Flow

### 1. User Creates Widget

User creates `weather-widget.zip`:

```
weather-widget.zip
├── widget.json
└── assets/
    ├── icons/
    │   ├── sunny.svg
    │   ├── cloudy.svg
    │   └── rainy.svg
    └── fonts/
        └── Roboto-Regular.woff2
```

**widget.json**:
```json
{
  "name": "Weather Widget",
  "slug": "weather",
  "version": "1.0.0",
  "description": "Display current weather conditions",
  
  "template": {
    "type": "group",
    "components": [
      {
        "type": "image",
        "source": {"key": "assets.icons.{data.condition_icon}.url"}
      },
      {
        "type": "text",
        "text": {"key": "data.temperature"}
      }
    ]
  },
  
  "options_schema": {
    "latitude": {"type": "number", "required": true},
    "longitude": {"type": "number", "required": true}
  },
  
  "data_schema": {
    "temperature": {"type": "number", "required": true},
    "condition_icon": {"type": "string", "enum": ["sunny", "cloudy", "rainy"], "required": true}
  },
  
  "assets": {
    "icons": {
      "sunny": {
        "path": "icons/sunny.svg",
        "type": "image/svg+xml",
        "size": 2048,
        "hash": "sha256:abc123..."
      },
      "cloudy": {
        "path": "icons/cloudy.svg",
        "type": "image/svg+xml",
        "size": 1856,
        "hash": "sha256:def456..."
      },
      "rainy": {
        "path": "icons/rainy.svg",
        "type": "image/svg+xml",
        "size": 2304,
        "hash": "sha256:ghi789..."
      }
    },
    "fonts": {
      "roboto": {
        "path": "fonts/Roboto-Regular.woff2",
        "type": "font/woff2",
        "size": 67624,
        "hash": "sha256:jkl012..."
      }
    }
  }
}
```

### 2. User Uploads via Dashboard

```typescript
// Dashboard upload component
async function uploadWidget(file: File) {
  const formData = new FormData();
  formData.append('widget_package', file);
  
  const response = await fetch('/api/widgets/upload', {
    method: 'POST',
    body: formData
  });
  
  return response.json();
}
```

### 3. Backend Validates and Stores

```elixir
defmodule CastmillWeb.WidgetController do
  def upload(conn, %{"widget_package" => upload}) do
    with {:ok, widget_def} <- PackageValidator.validate_package(upload.path),
         {:ok, widget} <- Widgets.create_widget_from_package(upload.path, widget_def),
         :ok <- store_assets(upload.path, widget) do
      conn
      |> put_status(:created)
      |> json(%{
        id: widget.id,
        slug: widget.slug,
        name: widget.name,
        assets_url: "/widgets/#{widget.slug}/assets"
      })
    else
      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: reason})
    end
  end

  defp store_assets(zip_path, widget) do
    storage_path = Path.join([
      Application.get_env(:castmill, :assets_root),
      "widgets",
      widget.slug,
      "assets"
    ])
    
    File.mkdir_p!(storage_path)
    
    # Extract assets from ZIP to storage
    extract_assets(zip_path, storage_path)
  end
end
```

### 4. User Selects Generic Integration

User can use built-in RSS integration without coding:

```elixir
# Pre-built generic integration
defmodule Castmill.Widgets.Integrations.Fetchers.RSS do
  @behaviour Castmill.Widgets.Integrations.Fetcher
  
  def fetch(_credentials, options) do
    url = options["feed_url"]
    
    with {:ok, %{body: body}} <- HTTPoison.get(url),
         {:ok, feed} <- parse_rss(body) do
      {:ok, %{
        "items" => Enum.map(feed.items, fn item ->
          %{
            "title" => item.title,
            "description" => item.description,
            "link" => item.link,
            "pubDate" => item.pubDate
          }
        end)
      }}
    end
  end
end
```

### 5. Player Renders Widget

```typescript
// Player resolves asset URLs
class WeatherWidget {
  async render(data, options, assets) {
    // Assets already resolved to absolute URLs
    const iconUrl = assets.icons[data.condition_icon].url;
    // → "https://cdn.castmill.com/widgets/weather/assets/icons/sunny.svg"
    
    return `
      <div class="weather-widget">
        <img src="${iconUrl}" alt="${data.condition_icon}" />
        <span class="temperature">${data.temperature}°C</span>
      </div>
    `;
  }
}
```

## Security Considerations

### File Size Limits

```elixir
@max_limits %{
  package: 10 * 1024 * 1024,    # 10MB total package
  icon: 100 * 1024,              # 100KB per icon
  font: 512 * 1024,              # 512KB per font
  image: 1024 * 1024,            # 1MB per image
  style: 50 * 1024,              # 50KB per stylesheet
  total_assets: 5 * 1024 * 1024  # 5MB total assets
}
```

### Allowed File Types

- **Icons**: SVG, PNG, JPG (validated magic bytes)
- **Fonts**: WOFF, WOFF2, TTF (validated format)
- **Images**: PNG, JPG, WebP, GIF (validated magic bytes)
- **Styles**: CSS (sanitized, no `@import` or `url()` with external sources)

### Content Validation

- **SVG**: Strip scripts, event handlers, entity definitions
- **CSS**: Remove `@import`, validate `url()` references
- **Hash Verification**: SHA-256 hash for each file
- **Malware Scanning**: Optional ClamAV integration

### Path Traversal Prevention

```elixir
defp validate_asset_path(path) do
  normalized = Path.expand(path)
  
  cond do
    String.contains?(path, "..") ->
      {:error, "Path traversal detected"}
    
    String.starts_with?(normalized, "/") ->
      {:error, "Absolute paths not allowed"}
    
    true ->
      :ok
  end
end
```

## Implementation Checklist

### Backend

- [ ] Add `assets` JSONB field to `widgets` table
- [ ] Add `assets_schema` field for validation
- [ ] Create `PackageValidator` module
- [ ] Create `AssetSecurityValidator` module
- [ ] Create `AssetResolver` module
- [ ] Add `/api/widgets/upload` endpoint
- [ ] Add asset storage configuration
- [ ] Implement ZIP extraction and validation
- [ ] Implement SHA-256 hash verification
- [ ] Add magic byte validation
- [ ] Create SVG sanitizer
- [ ] Add asset serving routes
- [ ] Implement CDN support

### Database Migration

```elixir
defmodule Castmill.Repo.Migrations.AddWidgetAssets do
  use Ecto.Migration

  def change do
    alter table(:widgets) do
      add :assets, :map, default: %{}
      add :assets_schema, :map
      add :package_hash, :string
      add :package_size, :integer
    end
  end
end
```

### Dashboard UI

- [ ] Create widget upload component
- [ ] Add drag-and-drop ZIP upload
- [ ] Show upload progress
- [ ] Display validation errors
- [ ] Add asset preview
- [ ] Show package size/limits
- [ ] Create asset browser component
- [ ] Add i18n translations

### Player

- [ ] Implement asset URL resolution
- [ ] Add asset preloading
- [ ] Create asset cache
- [ ] Handle asset loading errors
- [ ] Support offline asset access

### Documentation

- [ ] Widget creation guide
- [ ] Asset packaging guide
- [ ] Security best practices
- [ ] Generic integration usage
- [ ] Example widget packages

## Benefits

1. **No Code Required**: Users create widgets with JSON and assets only
2. **Secure**: Comprehensive validation prevents malicious uploads
3. **Flexible**: Works with filesystem, S3, CDN storage
4. **Scalable**: Generic integrations reusable across widgets
5. **Complete**: End-to-end self-service widget creation

## Widget Lifecycle Management

### Widget Deletion

Widgets uploaded to an organization can be deleted. The deletion process includes:

1. **Usage Check**: Before deletion, the system checks if the widget is used in any playlists
2. **Cascade Deletion**: If confirmed, all widget_configs (instances) are deleted first
3. **Asset Cleanup**: Widget assets are removed from storage
4. **Widget Removal**: Finally, the widget record is deleted

#### API Endpoints

```
# Check widget usage
GET /dashboard/organizations/:org_id/widgets/:widget_id/usage

Response:
{
  "data": [
    {
      "playlist_id": 123,
      "playlist_name": "My Playlist",
      "playlist_item_id": "uuid",
      "widget_config_id": "uuid"
    }
  ],
  "count": 1
}

# Delete widget (cascade deletes all instances)
DELETE /dashboard/organizations/:org_id/widgets/:widget_id
```

#### Backend Functions

```elixir
# Get widget usage information
Castmill.Widgets.get_widget_usage(widget_id)

# Delete widget with cascade (deletes widget_configs first)
Castmill.Widgets.delete_widget_with_cascade(widget)
```

#### Frontend UI

The widgets page includes a delete action in the table row menu:
- Shows confirmation dialog with usage warning
- Lists all playlists where the widget is used
- Warns that instances will be removed from playlists
- Requires delete permission for widgets

#### Permissions

Widget deletion requires the `widgets:delete` permission on the organization.

## Example: Complete Weather Widget

See above implementation flow for a complete working example that demonstrates:
- Widget package structure
- Asset manifest with hashes
- Template asset references
- Generic RSS integration usage
- Secure upload and validation
- Runtime URL resolution

This architecture enables users to create any widget requirement without modifying Castmill's codebase.
