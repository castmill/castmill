import {
  Component,
  createSignal,
  onMount,
  onCleanup,
  Show,
  createEffect,
  on,
} from 'solid-js';
import { ComboBox } from '../combobox/combobox';
import './location-picker.scss';

/**
 * Location value structure with coordinates and address information.
 */
export interface LocationValue {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

/**
 * Location search result from Nominatim API
 */
interface LocationSearchResult {
  id: string;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    postcode?: string;
  };
}

interface LocationPickerProps {
  value?: LocationValue;
  onChange: (value: LocationValue) => void;
  placeholder?: string;
  defaultZoom?: number;
  disabled?: boolean;
  searchLabel?: string;
}

// Leaflet types (minimal interface to avoid `any`)
interface LeafletMap {
  setView: (latlng: [number, number], zoom?: number) => LeafletMap;
  on: (event: string, handler: (e: any) => void) => LeafletMap;
  off: (event: string, handler?: (e: any) => void) => LeafletMap;
  remove: () => void;
  scrollWheelZoom: {
    enable: () => void;
    disable: () => void;
  };
  getContainer: () => HTMLElement;
}

interface LeafletMarker {
  addTo: (map: LeafletMap) => LeafletMarker;
  on: (event: string, handler: (e: any) => void) => LeafletMarker;
  setLatLng: (latlng: [number, number]) => LeafletMarker;
}

interface LeafletStatic {
  map: (
    element: HTMLElement,
    options?: { scrollWheelZoom?: boolean }
  ) => LeafletMap;
  tileLayer: (url: string, options: any) => any;
  marker: (latlng: [number, number], options?: any) => LeafletMarker;
}

/**
 * LocationPicker Component
 *
 * A map-based location picker using Leaflet and OpenStreetMap.
 * Supports:
 * - Map interaction with marker placement
 * - Address search (geocoding) using ComboBox
 * - Reverse geocoding when clicking on map
 * - Manual address editing
 */
export const LocationPicker: Component<LocationPickerProps> = (props) => {
  let mapContainer: HTMLDivElement | undefined;
  let map: LeafletMap | undefined;
  let marker: LeafletMarker | undefined;

  const [editingAddress, setEditingAddress] = createSignal(false);
  const [manualAddress, setManualAddress] = createSignal('');

  const defaultLocation = { lat: 51.505, lng: -0.09 }; // Default to London
  const zoom = props.defaultZoom || 13;

  // Initialize Leaflet dynamically
  const loadLeaflet = async (): Promise<LeafletStatic> => {
    // Check if Leaflet is already loaded
    if (typeof window !== 'undefined' && (window as any).L) {
      return (window as any).L;
    }

    // Check if CSS is already loaded
    const existingLink = document.querySelector('link[href*="leaflet.css"]');
    if (!existingLink) {
      // Load Leaflet CSS
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      cssLink.crossOrigin = '';
      document.head.appendChild(cssLink);
    }

    // Load Leaflet JS
    return new Promise<LeafletStatic>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve((window as any).L);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Fetch locations using Nominatim API (for ComboBox)
  const fetchLocations = async (
    _page: number,
    _pageSize: number,
    searchQuery: string
  ): Promise<{ count: number; data: LocationSearchResult[] }> => {
    if (!searchQuery.trim()) {
      return { count: 0, data: [] };
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `format=json&q=${encodeURIComponent(searchQuery)}&limit=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Castmill Digital Signage Platform',
          },
        }
      );
      const results = await response.json();
      // Add unique IDs to results (Nominatim returns place_id)
      const data = results.map((r: any) => ({
        ...r,
        id: r.place_id?.toString() || `${r.lat}-${r.lon}`,
      }));
      return { count: data.length, data };
    } catch (error) {
      console.error('Geocoding error:', error);
      return { count: 0, data: [] };
    }
  };

  // Handle location selection from ComboBox
  const handleLocationSelect = (result: LocationSearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    const location: LocationValue = {
      lat,
      lng,
      address: result.display_name,
      city:
        result.address?.city || result.address?.town || result.address?.village,
      country: result.address?.country,
      postalCode: result.address?.postcode,
    };

    props.onChange(location);

    // Update map
    if (map && marker) {
      map.setView([lat, lng], zoom);
      marker.setLatLng([lat, lng]);
    }
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?` +
          `format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Castmill Digital Signage Platform',
          },
        }
      );
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  // Handle map click
  const handleMapClick = async (e: any) => {
    if (props.disabled) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Update marker position
    if (marker) {
      marker.setLatLng([lat, lng]);
    }

    // Reverse geocode to get address
    const result = await reverseGeocode(lat, lng);

    const location: LocationValue = {
      lat,
      lng,
      address: result?.display_name,
      city:
        result?.address?.city ||
        result?.address?.town ||
        result?.address?.village,
      country: result?.address?.country,
      postalCode: result?.address?.postcode,
    };

    props.onChange(location);
  };

  // Update manual address
  const updateManualAddress = () => {
    const currentLocation = props.value;
    if (currentLocation) {
      props.onChange({
        ...currentLocation,
        address: manualAddress(),
      });
    }
    setEditingAddress(false);
  };

  // Initialize map
  onMount(async () => {
    if (!mapContainer) return;

    const L = await loadLeaflet();

    // Create map with scroll wheel zoom disabled by default
    // This prevents scroll hijacking when users scroll past the map
    map = L.map(mapContainer, { scrollWheelZoom: false }).setView(
      props.value
        ? [props.value.lat, props.value.lng]
        : [defaultLocation.lat, defaultLocation.lng],
      zoom
    );

    // Enable scroll wheel zoom only when map is focused (clicked)
    const mapEl = map.getContainer();
    mapEl.addEventListener('mouseenter', () => {
      mapEl.addEventListener('click', enableScrollZoom);
    });
    mapEl.addEventListener('mouseleave', () => {
      map?.scrollWheelZoom.disable();
      mapEl.removeEventListener('click', enableScrollZoom);
    });

    const enableScrollZoom = () => {
      map?.scrollWheelZoom.enable();
    };

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add marker
    marker = L.marker(
      props.value
        ? [props.value.lat, props.value.lng]
        : [defaultLocation.lat, defaultLocation.lng],
      {
        draggable: !props.disabled,
      }
    ).addTo(map);

    // Handle map clicks
    map.on('click', handleMapClick);

    // Handle marker drag
    marker.on('dragend', async (e: any) => {
      const position = e.target.getLatLng();
      await handleMapClick({ latlng: position });
    });
  });

  // Update marker when value changes externally
  // Use `on` to track specific dependencies and avoid unnecessary updates
  createEffect(
    on(
      () => props.value,
      (value, prevValue) => {
        // Only update if coordinates actually changed
        if (
          value &&
          map &&
          marker &&
          (!prevValue ||
            value.lat !== prevValue.lat ||
            value.lng !== prevValue.lng)
        ) {
          map.setView([value.lat, value.lng]);
          marker.setLatLng([value.lat, value.lng]);
        }
      }
    )
  );

  // Cleanup
  onCleanup(() => {
    if (map) {
      map.remove();
    }
  });

  return (
    <div class="location-picker">
      <div class="location-picker__search">
        <ComboBox<LocationSearchResult>
          id="location-search"
          label={props.searchLabel || 'Search Location'}
          placeholder={props.placeholder || 'Search for a location...'}
          fetchItems={fetchLocations}
          renderItem={(item) => (
            <div class="location-picker__result-item">{item.display_name}</div>
          )}
          onSelect={handleLocationSelect}
        />
      </div>

      <Show when={props.value}>
        <div class="location-picker__info">
          <div class="location-picker__coordinates">
            <strong>Coordinates:</strong> {props.value?.lat.toFixed(6)},{' '}
            {props.value?.lng.toFixed(6)}
          </div>

          <Show when={!editingAddress()}>
            <div class="location-picker__address">
              <strong>Address:</strong>{' '}
              {props.value?.address || 'No address available'}
              <button
                class="location-picker__edit-button"
                onClick={() => {
                  setManualAddress(props.value?.address || '');
                  setEditingAddress(true);
                }}
                disabled={props.disabled}
              >
                Edit
              </button>
            </div>
          </Show>

          <Show when={editingAddress()}>
            <div class="location-picker__address-editor">
              <input
                type="text"
                class="location-picker__address-input"
                value={manualAddress()}
                onInput={(e) => setManualAddress(e.currentTarget.value)}
                placeholder="Enter address..."
              />
              <button
                class="location-picker__save-button"
                onClick={updateManualAddress}
              >
                Save
              </button>
              <button
                class="location-picker__cancel-button"
                onClick={() => setEditingAddress(false)}
              >
                Cancel
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <div ref={mapContainer} class="location-picker__map"></div>
    </div>
  );
};
