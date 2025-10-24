# Widget Assets Architecture

## Problem Statement

Widgets often require static assets (icons, images, fonts, CSS files) to be bundled with their JSON template definitions. We need an elegant, scalable, and simple way to manage these assets.

## Current System Analysis

### Existing Asset Handling

1. **Widget Icons** - Currently stored as string URLs:
   ```elixir
   schema "widgets" do
     field(:icon, :string)
     field(:small_icon, :string)
   end
   ```

2. **Media References** - Widgets can reference uploaded media via the `ref` type:
   ```elixir
   data_schema: %{
     "background_image" => %{
       "type" => "ref",
       "collection" => "medias"
     }
   }
   ```

3. **Organization Media** - Media files are organization-scoped and stored separately:
   ```elixir
   schema "medias" do
     field(:name, :string)
     field(:mimetype, :string)
     field(:status, :enum)
     belongs_to(:organization, Organization)
   end
   ```

## Proposed Solution: Widget Assets Field

Add an `assets` field to the widget schema that references a collection of bundled media files.

### Architecture

```elixir
# Enhanced Widget Schema
schema "widgets" do
  field(:name, :string)
  field(:template, :map)
  field(:options_schema, :map)
  field(:data_schema, :map)
  
  # Icon URLs (kept for backward compatibility)
  field(:icon, :string)
  field(:small_icon, :string)
  
  # NEW: Asset manifest
  field(:assets, :map, default: %{})
  
  timestamps()
end
```

### Asset Manifest Structure

The `assets` field contains a manifest of widget-bundled assets:

```json
{
  "assets": {
    "icons": {
      "sunny": {
        "url": "/widgets/weather/assets/sunny.svg",
        "type": "image/svg+xml",
        "size": 2048
      },
      "cloudy": {
        "url": "/widgets/weather/assets/cloudy.svg",
        "type": "image/svg+xml",
        "size": 1856
      },
      "rainy": {
        "url": "/widgets/weather/assets/rainy.svg",
        "type": "image/svg+xml",
        "size": 2304
      }
    },
    "fonts": {
      "roboto": {
        "url": "/widgets/weather/assets/Roboto-Regular.woff2",
        "type": "font/woff2",
        "size": 67624
      }
    },
    "images": {
      "background": {
        "url": "/widgets/weather/assets/gradient-bg.png",
        "type": "image/png",
        "size": 51200
      }
    },
    "styles": {
      "main": {
        "url": "/widgets/weather/assets/styles.css",
        "type": "text/css",
        "size": 4096
      }
    }
  }
}
```

### Asset Storage Options

#### Option 1: Static File Serving (Recommended)

Store widget assets in the backend's static file directory:

```
packages/castmill/priv/static/widgets/
├── weather/
│   ├── assets/
│   │   ├── sunny.svg
│   │   ├── cloudy.svg
│   │   ├── rainy.svg
│   │   ├── Roboto-Regular.woff2
│   │   └── gradient-bg.png
│   └── manifest.json
├── rss-feed/
│   └── assets/
│       └── feed-icon.svg
└── clock/
    └── assets/
        └── digital-font.woff2
```

**Pros**:
- Simple to implement
- Fast serving via Phoenix static plug
- Easy to version with widget updates
- CDN-friendly

**Cons**:
- Assets bundled with backend code
- Requires backend deployment for asset updates

#### Option 2: Media Library Integration

Store widget assets as special media entries:

```elixir
schema "medias" do
  field(:name, :string)
  field(:mimetype, :string)
  field(:organization_id, :uuid)
  
  # NEW: Widget asset flag
  field(:widget_id, :integer)
  field(:is_widget_asset, :boolean, default: false)
  field(:asset_key, :string)  # e.g., "icons.sunny"
end
```

**Pros**:
- Reuses existing media infrastructure
- Asset upload/management via existing UI
- Organization-specific asset customization possible

**Cons**:
- More complex implementation
- Increases media table size
- Harder to bundle assets with widget definition

#### Option 3: Embedded Base64 (Not Recommended)

Embed small assets directly in the widget JSON:

```json
{
  "assets": {
    "icons": {
      "sunny": {
        "data": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...",
        "type": "image/svg+xml"
      }
    }
  }
}
```

**Pros**:
- Self-contained widget definition
- No separate asset loading

**Cons**:
- Large JSON payloads
- Poor performance for large assets
- Not suitable for fonts or multiple images

## Recommended Implementation: Option 1 + Asset Manifest

### 1. File Structure

```
packages/castmill/priv/static/widgets/{widget_slug}/
├── assets/
│   ├── icons/
│   ├── images/
│   ├── fonts/
│   └── styles/
└── manifest.json
```

### 2. Widget Creation with Assets

```elixir
# Create widget with asset manifest
{:ok, widget} = Widgets.create_widget(%{
  name: "Weather Widget",
  slug: "weather",
  template: %{
    "type" => "container",
    "style" => %{
      "backgroundImage" => "asset:images.background",
      "fontFamily" => "asset:fonts.roboto"
    },
    "components" => [
      %{
        "type" => "image",
        "source" => "asset:icons.{data.condition_icon}",
        "alt" => "Weather icon"
      },
      %{
        "type" => "text",
        "field" => "temperature",
        "style" => %{"fontFamily" => "asset:fonts.roboto"}
      }
    ]
  },
  assets: %{
    "icons" => %{
      "sunny" => %{
        "url" => "/widgets/weather/assets/icons/sunny.svg",
        "type" => "image/svg+xml"
      },
      "cloudy" => %{
        "url" => "/widgets/weather/assets/icons/cloudy.svg",
        "type" => "image/svg+xml"
      }
    },
    "fonts" => %{
      "roboto" => %{
        "url" => "/widgets/weather/assets/fonts/Roboto-Regular.woff2",
        "type" => "font/woff2"
      }
    },
    "images" => %{
      "background" => %{
        "url" => "/widgets/weather/assets/images/gradient-bg.png",
        "type" => "image/png"
      }
    }
  }
})
```

### 3. Template Asset Resolution

Templates reference assets using the `asset:` prefix:

```json
{
  "type": "image",
  "source": "asset:icons.sunny"
}
```

The template engine resolves this to:
```json
{
  "type": "image",
  "source": "/widgets/weather/assets/icons/sunny.svg"
}
```

Dynamic asset resolution based on data:
```json
{
  "type": "image",
  "source": "asset:icons.{data.condition_icon}"
}
```

With data `{"condition_icon": "cloudy"}`, resolves to:
```json
{
  "type": "image",
  "source": "/widgets/weather/assets/icons/cloudy.svg"
}
```

### 4. Asset Preloading

Players can preload all widget assets:

```typescript
class TemplateWidget {
  async preloadAssets(assets: AssetManifest): Promise<void> {
    const assetUrls = this.getAllAssetUrls(assets);
    
    await Promise.all(
      assetUrls.map(url => this.preloadAsset(url))
    );
  }
  
  private getAllAssetUrls(assets: AssetManifest): string[] {
    const urls: string[] = [];
    
    for (const category of Object.values(assets)) {
      for (const asset of Object.values(category)) {
        urls.push(asset.url);
      }
    }
    
    return urls;
  }
  
  private async preloadAsset(url: string): Promise<void> {
    // Fetch and cache the asset
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Store in cache for offline use
    await this.cacheAsset(url, blob);
  }
}
```

### 5. Widget Package Format

Widgets can be distributed as packages:

```
weather-widget.zip
├── widget.json          # Widget definition
├── assets/
│   ├── icons/
│   │   ├── sunny.svg
│   │   ├── cloudy.svg
│   │   └── rainy.svg
│   ├── fonts/
│   │   └── Roboto-Regular.woff2
│   └── images/
│       └── gradient-bg.png
└── README.md           # Widget documentation
```

Import process:
```elixir
defmodule Castmill.Widgets.Importer do
  def import_widget_package(zip_path) do
    with {:ok, files} <- unzip_package(zip_path),
         {:ok, widget_def} <- parse_widget_json(files["widget.json"]),
         :ok <- copy_assets_to_static(files, widget_def.slug),
         {:ok, asset_manifest} <- build_asset_manifest(files, widget_def.slug),
         {:ok, widget} <- create_widget(widget_def, asset_manifest) do
      {:ok, widget}
    end
  end
  
  defp copy_assets_to_static(files, widget_slug) do
    target_dir = Path.join([
      Application.app_dir(:castmill),
      "priv",
      "static",
      "widgets",
      widget_slug,
      "assets"
    ])
    
    File.mkdir_p!(target_dir)
    
    files
    |> Enum.filter(fn {path, _} -> String.starts_with?(path, "assets/") end)
    |> Enum.each(fn {path, content} ->
      target_path = Path.join(target_dir, String.replace(path, "assets/", ""))
      File.write!(target_path, content)
    end)
    
    :ok
  end
  
  defp build_asset_manifest(files, widget_slug) do
    manifest = %{}
    
    files
    |> Enum.filter(fn {path, _} -> String.starts_with?(path, "assets/") end)
    |> Enum.reduce(manifest, fn {path, content}, acc ->
      relative_path = String.replace(path, "assets/", "")
      [category | rest] = String.split(relative_path, "/")
      filename = List.last(rest)
      name = Path.rootname(filename)
      
      asset_info = %{
        "url" => "/widgets/#{widget_slug}/assets/#{relative_path}",
        "type" => MIME.from_path(filename),
        "size" => byte_size(content)
      }
      
      put_in(acc, [category, name], asset_info)
    end)
    
    {:ok, manifest}
  end
end
```

### 6. Migration Strategy

For existing widgets:

```elixir
# Migration to add assets field
alter table(:widgets) do
  add :assets, :map, default: %{}
end

# Migrate existing icon fields to assets
def migrate_existing_icons do
  Repo.all(Widget)
  |> Enum.each(fn widget ->
    assets = %{
      "icons" => %{
        "main" => %{
          "url" => widget.icon,
          "type" => "image/svg+xml"
        },
        "small" => %{
          "url" => widget.small_icon,
          "type" => "image/svg+xml"
        }
      }
    }
    
    Widgets.update_widget(widget, %{assets: assets})
  end)
end
```

## Advanced Features

### 1. Asset Versioning

Include version in asset URLs for cache busting:

```json
{
  "assets": {
    "icons": {
      "sunny": {
        "url": "/widgets/weather/assets/icons/sunny.svg?v=1.2.0",
        "type": "image/svg+xml",
        "version": "1.2.0"
      }
    }
  }
}
```

### 2. Responsive Assets

Support multiple sizes for responsive design:

```json
{
  "assets": {
    "images": {
      "background": {
        "variants": {
          "small": {
            "url": "/widgets/weather/assets/images/bg-sm.png",
            "width": 640
          },
          "medium": {
            "url": "/widgets/weather/assets/images/bg-md.png",
            "width": 1024
          },
          "large": {
            "url": "/widgets/weather/assets/images/bg-lg.png",
            "width": 1920
          }
        }
      }
    }
  }
}
```

### 3. Asset CDN Support

Allow CDN URLs for better performance:

```json
{
  "assets": {
    "fonts": {
      "roboto": {
        "url": "https://cdn.castmill.com/widgets/weather/fonts/Roboto-Regular.woff2",
        "type": "font/woff2",
        "cdn": true
      }
    }
  }
}
```

### 4. Organization Asset Overrides

Allow organizations to customize widget assets:

```elixir
schema "widget_asset_overrides" do
  belongs_to(:widget, Widget)
  belongs_to(:organization, Organization)
  
  field(:asset_key, :string)  # e.g., "icons.sunny"
  field(:media_id, :integer)  # Reference to organization's media
  
  timestamps()
end
```

## Implementation Checklist

- [ ] Add `assets` field to Widget schema
- [ ] Create widget asset directory structure
- [ ] Implement asset manifest builder
- [ ] Add `asset:` prefix resolver in template engine
- [ ] Create widget package importer
- [ ] Update widget creation API to handle assets
- [ ] Implement asset preloading in player
- [ ] Add asset versioning support
- [ ] Create migration for existing widgets
- [ ] Document asset conventions and best practices

## Best Practices

1. **Keep Assets Small**: Optimize images, use SVG when possible, subset fonts
2. **Use Descriptive Names**: `sunny.svg` not `icon1.svg`
3. **Organize by Type**: Separate icons, images, fonts, styles
4. **Version Assets**: Include version in URLs for cache control
5. **Provide Fallbacks**: Include default assets for missing data
6. **Test Offline**: Ensure assets work when cached
7. **Document Assets**: Include README with widget package

## Example: Complete Weather Widget with Assets

```elixir
{:ok, weather_widget} = Widgets.create_widget(%{
  name: "Weather Display",
  slug: "weather",
  
  template: %{
    "type" => "container",
    "style" => %{
      "backgroundImage" => "url(asset:images.background)",
      "fontFamily" => "asset:fonts.roboto, sans-serif"
    },
    "components" => [
      %{
        "type" => "image",
        "source" => "asset:icons.{data.condition_icon}",
        "style" => %{"width" => "100px", "height" => "100px"}
      },
      %{
        "type" => "text",
        "field" => "temperature",
        "style" => %{
          "fontSize" => "48px",
          "fontFamily" => "asset:fonts.roboto"
        }
      },
      %{
        "type" => "text",
        "field" => "condition",
        "style" => %{
          "fontSize" => "24px",
          "fontFamily" => "asset:fonts.roboto"
        }
      }
    ]
  },
  
  options_schema: %{
    "latitude" => %{"type" => "number", "required" => true},
    "longitude" => %{"type" => "number", "required" => true}
  },
  
  data_schema: %{
    "temperature" => %{"type" => "number", "required" => true},
    "condition" => %{"type" => "string", "required" => true},
    "condition_icon" => %{"type" => "string", "required" => true}
  },
  
  assets: %{
    "icons" => %{
      "sunny" => %{
        "url" => "/widgets/weather/assets/icons/sunny.svg",
        "type" => "image/svg+xml",
        "size" => 2048
      },
      "cloudy" => %{
        "url" => "/widgets/weather/assets/icons/cloudy.svg",
        "type" => "image/svg+xml",
        "size" => 1856
      },
      "rainy" => %{
        "url" => "/widgets/weather/assets/icons/rainy.svg",
        "type" => "image/svg+xml",
        "size" => 2304
      }
    },
    "fonts" => %{
      "roboto" => %{
        "url" => "/widgets/weather/assets/fonts/Roboto-Regular.woff2",
        "type" => "font/woff2",
        "size" => 67624
      }
    },
    "images" => %{
      "background" => %{
        "url" => "/widgets/weather/assets/images/gradient-bg.png",
        "type" => "image/png",
        "size" => 51200
      }
    }
  }
})

# Integration provides condition_icon in data
defmodule Castmill.Widgets.Integrations.Fetchers.OpenWeather do
  def fetch(credentials, options) do
    # ... fetch weather data ...
    
    # Map condition to icon name
    icon_name = case api_data["weather"]["main"] do
      "Clear" -> "sunny"
      "Clouds" -> "cloudy"
      "Rain" -> "rainy"
      _ -> "cloudy"
    end
    
    {:ok, %{
      "temperature" => api_data["main"]["temp"],
      "condition" => api_data["weather"]["main"],
      "condition_icon" => icon_name  # Resolves to asset:icons.sunny
    }}
  end
end
```

## Summary

**Recommended Approach**: Add an `assets` map field to the Widget schema that contains a manifest of asset URLs served from `priv/static/widgets/{slug}/assets/`.

**Key Benefits**:
- Simple and elegant
- Scalable for any number of assets
- Compatible with CDN deployment
- Supports widget packaging and distribution
- Enables asset preloading and caching
- Allows organization-specific overrides

**Trade-offs**:
- Assets bundled with backend code (acceptable for widget definitions)
- Requires file system access during widget creation (standard for static assets)
- Version management requires careful planning (solvable with asset versioning)

This approach provides a clean separation between:
- **Widget definition** (JSON template + schemas + asset manifest)
- **Widget assets** (static files served via Phoenix)
- **Widget data** (dynamic content from integrations)
- **Organization media** (user-uploaded content)
