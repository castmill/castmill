# Location Picker

The LocationPicker component provides an interactive map-based interface for selecting geographic locations. It uses Leaflet with OpenStreetMap for map display and Nominatim for geocoding services.

## Features

- **Interactive Map**: Click anywhere on the map to select a location
- **Address Search**: Search for locations by name or address
- **Reverse Geocoding**: Automatically retrieve address information from coordinates
- **Manual Address Editing**: Edit the address text manually if needed
- **Drag & Drop**: Drag the marker to adjust the location
- **Coordinates Display**: Shows precise latitude and longitude values

## Usage

### Basic Usage

```tsx
import { LocationPicker, LocationValue } from '@castmill/ui-common';

function MyComponent() {
  const [location, setLocation] = createSignal<LocationValue | undefined>();

  return (
    <LocationPicker
      value={location()}
      onChange={(newLocation) => setLocation(newLocation)}
    />
  );
}
```

### With Widget Options Schema

To use the location picker in a widget's options schema:

```json
{
  "location": {
    "type": "location",
    "description": "Select the device location",
    "required": true,
    "default": {
      "lat": 51.505,
      "lng": -0.09,
      "address": "London, UK"
    },
    "defaultZoom": 13
  }
}
```

### LocationValue Interface

The location value is represented by:

```typescript
interface LocationValue {
  /** Latitude coordinate (-90 to 90) */
  lat: number;
  /** Longitude coordinate (-180 to 180) */
  lng: number;
  /** Human-readable address (optional) */
  address?: string;
  /** City name (optional) */
  city?: string;
  /** Country name (optional) */
  country?: string;
  /** Postal/ZIP code (optional) */
  postalCode?: string;
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `LocationValue` | `undefined` | Current location value |
| `onChange` | `(value: LocationValue) => void` | **required** | Callback when location changes |
| `placeholder` | `string` | `'Search for a location...'` | Placeholder text for search input |
| `defaultZoom` | `number` | `13` | Initial zoom level (1-18) |
| `disabled` | `boolean` | `false` | Disables all interactions |

## Map Provider

The LocationPicker uses:
- **Leaflet**: Open-source JavaScript library for interactive maps
- **OpenStreetMap**: Free, open-source map tiles
- **Nominatim**: Free geocoding service by OpenStreetMap

These services are used via CDN and require no API keys, making them ideal for open-source projects.

## Geocoding

The component provides two types of geocoding:

### Forward Geocoding (Address → Coordinates)
When you search for an address, the component uses Nominatim's search API to find matching locations and their coordinates.

### Reverse Geocoding (Coordinates → Address)
When you click on the map or drag the marker, the component uses Nominatim's reverse API to find the address for those coordinates.

## Styling

The component comes with default styles in `location-picker.scss`. You can customize it by:

1. Overriding the CSS classes:
   - `.location-picker`
   - `.location-picker__search`
   - `.location-picker__map`
   - `.location-picker__info`
   - etc.

2. Or by providing custom styles in your application.

## Internationalization

All user-facing text in the LocationPicker is internationalized. The following translation keys are used:

- `common.searchLocation`: Placeholder for search input
- `common.coordinates`: Label for coordinates display
- `common.address`: Label for address display
- `common.noAddressAvailable`: Text when no address is found

These are available in all 9 supported languages (English, Spanish, Swedish, German, French, Chinese, Arabic, Korean, Japanese).

## Accessibility

The component is keyboard accessible:
- Use Tab to navigate between interactive elements
- Press Enter in the search field to trigger search
- The map itself can be navigated with arrow keys (Leaflet default behavior)

## Examples

### With Initial Location

```tsx
<LocationPicker
  value={{
    lat: 59.3293,
    lng: 18.0686,
    address: 'Stockholm, Sweden',
    city: 'Stockholm',
    country: 'Sweden'
  }}
  onChange={handleLocationChange}
/>
```

### With Custom Zoom

```tsx
<LocationPicker
  value={location()}
  onChange={setLocation}
  defaultZoom={15} // Closer zoom level
  placeholder="Find your office location..."
/>
```

### Read-Only Mode

```tsx
<LocationPicker
  value={savedLocation()}
  onChange={() => {}} // No-op
  disabled={true}
/>
```

## Notes

- Coordinates are the source of truth. Address fields are optional metadata.
- The component loads Leaflet dynamically from CDN, so it works without build-time dependencies.
- Rate limiting applies to Nominatim API (1 request per second recommended for production use).
- For high-traffic applications, consider hosting your own Nominatim instance or using a commercial geocoding service.

## Browser Support

The LocationPicker works in all modern browsers that support:
- ES6+ JavaScript features
- Fetch API
- CSS Grid/Flexbox

## License

Part of the Castmill Digital Signage Platform - AGPL-3.0-or-later
