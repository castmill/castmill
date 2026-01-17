# Location Picker Feature

This document describes the Location Picker feature implementation for the Castmill Digital Signage Platform.

## Overview

The Location Picker allows users to select geographic locations using an interactive map interface. This is useful for:
- Setting device locations in the Device Details view
- Configuring location-based widgets (e.g., weather, local time, maps)
- Any widget that needs geographic coordinates

## Architecture

### Components

1. **LocationPicker Component** (`packages/ui-common/src/components/location-picker/`)
   - Interactive map using Leaflet and OpenStreetMap
   - Address search with geocoding (Nominatim API)
   - Reverse geocoding for clicked locations
   - Manual address editing
   - Fully responsive and accessible

2. **Schema Definitions** (`packages/player/src/interfaces/schema.interface.ts`)
   - `LocationValue` interface: Represents a location with coordinates and address
   - `LocationFieldAttributes` interface: Schema attributes for location fields
   - Integrated into the existing schema type system

3. **Widget Integration** (`packages/castmill/lib/castmill/addons/playlists/components/widget-config.tsx`)
   - Automatically renders LocationPicker for location-type fields
   - Handles validation and state management
   - Integrates with existing form system

## LocationValue Interface

```typescript
interface LocationValue {
  lat: number;          // Latitude (-90 to 90)
  lng: number;          // Longitude (-180 to 180)
  address?: string;     // Human-readable address
  city?: string;        // City name
  country?: string;     // Country name
  postalCode?: string;  // Postal/ZIP code
}
```

**Key Design Decision**: Coordinates (`lat`/`lng`) are the source of truth. Address fields are optional metadata that can be updated independently.

## Usage in Widget Options Schema

To add a location picker to a widget, include a field with type `"location"` in the `options_schema`:

```elixir
options_schema: %{
  "location" => %{
    "type" => "location",
    "required" => true,
    "description" => "Select a location on the map",
    "default" => %{
      "lat" => 51.505,
      "lng" => -0.09,
      "address" => "London, United Kingdom"
    },
    "defaultZoom" => 13,
    "order" => 2
  }
}
```

### Schema Options

- `type`: Must be `"location"`
- `required`: Whether the field is required (boolean)
- `description`: Help text shown in the UI
- `default`: Default LocationValue object
- `defaultZoom`: Initial map zoom level (1-18, default: 13)
- `order`: Display order in the form

## Map Provider Details

### Leaflet + OpenStreetMap

- **Leaflet**: Open-source JavaScript library for interactive maps
  - Loaded dynamically from CDN (v1.9.4)
  - No build-time dependencies required
  - Lightweight (~42KB gzipped)

- **OpenStreetMap**: Free, open-source map tiles
  - No API key required
  - Community-maintained data
  - Global coverage

### Geocoding with Nominatim

- **Nominatim**: Free geocoding service by OpenStreetMap
  - Forward geocoding: address → coordinates
  - Reverse geocoding: coordinates → address
  - Rate limit: 1 request per second (recommended)

**Production Considerations**:
- For high-traffic deployments, consider hosting your own Nominatim instance
- Alternative: Use a commercial geocoding service (Google, Mapbox, etc.)
- Current implementation uses public Nominatim with appropriate User-Agent header

## Internationalization

All UI text is fully internationalized in 9 languages:
- English (en)
- Spanish (es)
- Swedish (sv)
- German (de)
- French (fr)
- Chinese (zh)
- Arabic (ar) - RTL supported
- Korean (ko)
- Japanese (ja)

Translation keys added:
- `common.searchLocation`: "Search for a location..."
- `common.coordinates`: "Coordinates"
- `common.address`: "Address"
- `common.noAddressAvailable`: "No address available"

## Example Widget

A demo widget (`location-display-demo`) is included in:
`packages/castmill/priv/repo/migrations/20260114100000_add_location_demo_widget.exs`

This widget demonstrates:
- Using the location picker in options_schema
- Accessing location data in the template
- Displaying coordinates and address
- Template interpolation with location values

To add the demo widget to your database:
```bash
cd packages/castmill
mix ecto.migrate
```

## Testing

Comprehensive tests are included in:
`packages/ui-common/src/components/location-picker/location-picker.test.tsx`

Tests cover:
- Component rendering with various props
- Location value updates
- Search functionality
- Disabled state
- Map initialization
- Address editing

Run tests with:
```bash
cd packages/ui-common
yarn test
```

## Accessibility

The LocationPicker is fully accessible:
- Keyboard navigation support
- ARIA labels for screen readers
- Focus management
- Color contrast compliance
- Responsive design for mobile devices

## Browser Support

Works in all modern browsers supporting:
- ES6+ JavaScript
- Fetch API
- CSS Grid/Flexbox
- Canvas (for Leaflet map rendering)

## Future Enhancements

Potential improvements for future versions:
1. Custom map tile providers (satellite view, terrain, etc.)
2. Drawing tools (radius, polygon areas)
3. Multiple marker support
4. Clustering for many locations
5. Offline map support
6. Custom geocoding provider configuration
7. Map style customization
8. Location history/recent searches

## Files Changed

### New Files
- `packages/ui-common/src/components/location-picker/location-picker.tsx`
- `packages/ui-common/src/components/location-picker/location-picker.scss`
- `packages/ui-common/src/components/location-picker/location-picker.test.tsx`
- `packages/ui-common/src/components/location-picker/README.md`
- `packages/castmill/priv/repo/migrations/20260114100000_add_location_demo_widget.exs`
- `docs/LOCATION-PICKER.md` (this file)

### Modified Files
- `packages/player/src/interfaces/schema.interface.ts` - Added LocationValue and LocationFieldAttributes
- `packages/device/src/interfaces/schema.ts` - Added LocationValue and LocationFieldAttributes
- `packages/ui-common/src/components/index.ts` - Export LocationPicker
- `packages/castmill/lib/castmill/addons/playlists/components/widget-config.tsx` - Integrated LocationPicker
- `packages/dashboard/src/i18n/locales/*.json` - Added translations (9 languages)

## License

Part of the Castmill Digital Signage Platform - AGPL-3.0-or-later
