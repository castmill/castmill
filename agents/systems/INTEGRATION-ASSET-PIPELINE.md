# Integration Asset Pipeline (Future Implementation)

## Overview

This document describes the architecture for processing and caching media assets from third-party integrations. This is a **future enhancement** - the MVP uses external URLs directly.

## Problem Statement

Third-party integrations (Spotify, weather services, social media, etc.) return media URLs that point to external servers. These present several challenges:

1. **Offline capability** - Players can't cache external URLs for offline playback
2. **Image size** - External images may be excessively large (16MP+) wasting bandwidth
3. **Inconsistent formats** - Need standardized formats (WebP) for player efficiency
4. **No variants** - Need thumbnail/preview/full like regular Castmill medias
5. **Ephemeral data** - Integration data changes frequently, creating cleanup challenges

## Proposed Architecture

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  External    │     │   Fetcher    │     │    Asset     │     │   Storage    │
│    API       │────▶│   Module     │────▶│  Processor   │────▶│   (S3/FS)    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │                    │                     │
                            ▼                    ▼                     ▼
                     Extract media        Transcode &           Store with
                     URLs from data       resize images         time partitions
                            │                    │                     │
                            └────────────────────┴─────────────────────┘
                                                 │
                                                 ▼
                                    ┌──────────────────────┐
                                    │ widget_integration_  │
                                    │ data.data (JSONB)    │
                                    │ contains processed   │
                                    │ Castmill URLs        │
                                    └──────────────────────┘
```

### Key Components

#### 1. Asset Processor Module

```elixir
defmodule Castmill.Widgets.Integrations.AssetProcessor do
  @moduledoc """
  Processes media URLs from integration data:
  - Downloads external images
  - Transcodes to WebP
  - Generates size variants (thumbnail, preview, full)
  - Stores with content-hash for deduplication
  """

  @max_dimension 3840  # 4K max for digital signage
  @variants [
    {:thumbnail, 150, 150},
    {:preview, 800, 600},
    {:full, @max_dimension, @max_dimension}
  ]

  def process_media_url(source_url, opts \\ []) do
    hash = content_hash(source_url)
    storage_path = build_storage_path(hash)

    case check_existing(storage_path) do
      {:ok, existing} -> {:ok, existing}
      :not_found -> download_and_process(source_url, storage_path, opts)
    end
  end

  defp content_hash(url) do
    :crypto.hash(:sha256, url) |> Base.encode16(case: :lower) |> String.slice(0, 16)
  end

  defp build_storage_path(hash) do
    date = Date.utc_today() |> Date.to_iso8601()
    "/integration-assets/#{date}/#{hash}"
  end
end
```

#### 2. Storage Structure

Time-partitioned directories for easy bulk cleanup:

```
/storage/integration-assets/
  /2025-12-11/
    /a1b2c3d4e5f6g7h8/
      thumb.webp      (150x150)
      preview.webp    (800x600)
      full.webp       (max 3840px)
      metadata.json   (source_url, created_at, size_bytes)
  /2025-12-10/
    /...
```

#### 3. Cleanup Strategy

**Oban scheduled job** runs daily:

```elixir
defmodule Castmill.Workers.IntegrationAssetCleanup do
  use Oban.Worker, queue: :maintenance

  @retention_days 2  # Keep assets for 2 days

  @impl Oban.Worker
  def perform(_job) do
    cutoff_date = Date.utc_today() |> Date.add(-@retention_days)
    
    # Delete all date directories older than cutoff
    list_date_directories()
    |> Enum.filter(&(Date.compare(&1, cutoff_date) == :lt))
    |> Enum.each(&delete_directory/1)
    
    :ok
  end
end
```

**Alternative: S3 Lifecycle Policy** (zero code):

```json
{
  "Rules": [{
    "ID": "DeleteOldIntegrationAssets",
    "Status": "Enabled",
    "Filter": {"Prefix": "integration-assets/"},
    "Expiration": {"Days": 2}
  }]
}
```

#### 4. Data Schema Enhancement

Mark fields containing media URLs in the integration config:

```elixir
# In widget integration definition
%{
  "media_fields" => [
    %{
      "path" => "album_art_url",           # JSON path in fetched data
      "output_path" => "album_art.files",  # Where to put processed URLs
      "variants" => ["thumbnail", "full"]  # Which variants to generate
    }
  ]
}
```

#### 5. Fetcher Enhancement

Modify fetchers to process media URLs:

```elixir
defmodule Castmill.Widgets.Integrations.Fetchers.Spotify do
  def fetch(credentials, config) do
    with {:ok, raw_data} <- call_spotify_api(credentials),
         {:ok, processed_data} <- process_media_fields(raw_data, config) do
      {:ok, processed_data}
    end
  end

  defp process_media_fields(data, config) do
    media_fields = config["media_fields"] || []
    
    Enum.reduce(media_fields, {:ok, data}, fn field_config, {:ok, acc} ->
      source_url = get_in(acc, String.split(field_config["path"], "."))
      
      case AssetProcessor.process_media_url(source_url) do
        {:ok, files} ->
          {:ok, put_in(acc, String.split(field_config["output_path"], "."), files)}
        {:error, _} = error ->
          error
      end
    end)
  end
end
```

### Resulting Data Structure

Before processing (raw from Spotify):
```json
{
  "album_art_url": "https://i.scdn.co/image/ab67616d0000b273...",
  "track_name": "Bohemian Rhapsody",
  "artist_name": "Queen"
}
```

After processing:
```json
{
  "album_art": {
    "original_url": "https://i.scdn.co/image/ab67616d0000b273...",
    "files": {
      "thumbnail": "/api/integration-assets/2025-12-11/a1b2c3d4/thumb.webp",
      "preview": "/api/integration-assets/2025-12-11/a1b2c3d4/preview.webp",
      "full": "/api/integration-assets/2025-12-11/a1b2c3d4/full.webp"
    }
  },
  "track_name": "Bohemian Rhapsody",
  "artist_name": "Queen"
}
```

### Widget Template Usage

Templates use the standard `@target` pattern:

```json
{
  "type": "image",
  "opts": {
    "url": {"key": "data.album_art.files[@target]"},
    "size": "cover"
  }
}
```

The player's `@target` global resolves to the appropriate variant based on context.

### Deduplication

Content-hash based within the time partition:
- Same source URL on same day = reuse existing assets
- No complex reference counting needed
- Natural cleanup via time-based expiration

### Benefits

| Aspect | Benefit |
|--------|---------|
| **Offline** | Players cache Castmill-hosted URLs normally |
| **Bandwidth** | Images properly sized, WebP compressed |
| **Consistency** | Same variant pattern as regular medias |
| **Cleanup** | Simple time-based deletion, no orphan tracking |
| **Storage** | Content-hash dedup within retention window |
| **Complexity** | No new PostgreSQL tables for assets |

### Implementation Phases

1. **Phase 1**: Implement AssetProcessor module
2. **Phase 2**: Add media_fields config to integration schema
3. **Phase 3**: Enhance fetchers to use AssetProcessor
4. **Phase 4**: Add cleanup Oban worker
5. **Phase 5**: Update widget templates to use new URL pattern

### Considerations

- **Storage costs**: ~2 days of assets per organization
- **Processing time**: Adds latency to fetch cycle (consider async)
- **Error handling**: What if external image is unavailable?
- **Fallback**: Show placeholder if processing fails

---

*This document was created on 2025-12-11 as part of the widget integration system design.*
*See also: WIDGET-INTEGRATIONS.md, WIDGET-INTEGRATION-API.md*
