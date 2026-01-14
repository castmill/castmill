import {
  Component,
  createSignal,
  onMount,
  onCleanup,
  Show,
  createEffect,
} from 'solid-js';
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

interface LocationPickerProps {
  value?: LocationValue;
  onChange: (value: LocationValue) => void;
  placeholder?: string;
  defaultZoom?: number;
  disabled?: boolean;
}

/**
 * LocationPicker Component
 *
 * A map-based location picker using Leaflet and OpenStreetMap.
 * Supports:
 * - Map interaction with marker placement
 * - Address search (geocoding)
 * - Reverse geocoding when clicking on map
 * - Manual address editing
 */
export const LocationPicker: Component<LocationPickerProps> = (props) => {
  let mapContainer: HTMLDivElement | undefined;
  let map: any;
  let marker: any;
  
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<any[]>([]);
  const [showResults, setShowResults] = createSignal(false);
  const [editingAddress, setEditingAddress] = createSignal(false);
  const [manualAddress, setManualAddress] = createSignal('');

  const defaultLocation = { lat: 51.505, lng: -0.09 }; // Default to London
  const zoom = props.defaultZoom || 13;

  // Initialize Leaflet dynamically
  const loadLeaflet = async () => {
    // Check if Leaflet is already loaded
    if (typeof window !== 'undefined' && (window as any).L) {
      return (window as any).L;
    }

    // Load Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

    // Load Leaflet JS
    return new Promise<any>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve((window as any).L);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Geocode address to coordinates using Nominatim (OpenStreetMap)
  const geocodeAddress = async (query: string) => {
    if (!query.trim()) return [];
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Castmill Digital Signage Platform',
          },
        }
      );
      const results = await response.json();
      setIsSearching(false);
      return results;
    } catch (error) {
      console.error('Geocoding error:', error);
      setIsSearching(false);
      return [];
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

  // Handle search input
  const handleSearch = async () => {
    const query = searchQuery();
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const results = await geocodeAddress(query);
    setSearchResults(results);
    setShowResults(results.length > 0);
  };

  // Select a location from search results
  const selectLocation = async (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    const location: LocationValue = {
      lat,
      lng,
      address: result.display_name,
      city: result.address?.city || result.address?.town || result.address?.village,
      country: result.address?.country,
      postalCode: result.address?.postcode,
    };

    props.onChange(location);
    
    // Update map
    if (map && marker) {
      map.setView([lat, lng], zoom);
      marker.setLatLng([lat, lng]);
    }
    
    setShowResults(false);
    setSearchQuery('');
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
      city: result?.address?.city || result?.address?.town || result?.address?.village,
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

    // Create map
    map = L.map(mapContainer).setView(
      props.value ? [props.value.lat, props.value.lng] : [defaultLocation.lat, defaultLocation.lng],
      zoom
    );

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add marker
    marker = L.marker(
      props.value ? [props.value.lat, props.value.lng] : [defaultLocation.lat, defaultLocation.lng],
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
  createEffect(() => {
    const value = props.value;
    if (value && map && marker) {
      map.setView([value.lat, value.lng]);
      marker.setLatLng([value.lat, value.lng]);
    }
  });

  // Cleanup
  onCleanup(() => {
    if (map) {
      map.remove();
    }
  });

  return (
    <div class="location-picker">
      <div class="location-picker__search">
        <input
          type="text"
          class="location-picker__search-input"
          placeholder={props.placeholder || 'Search for a location...'}
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          disabled={props.disabled}
        />
        <button
          class="location-picker__search-button"
          onClick={handleSearch}
          disabled={props.disabled || isSearching()}
        >
          {isSearching() ? 'Searching...' : 'Search'}
        </button>
        
        <Show when={showResults() && searchResults().length > 0}>
          <div class="location-picker__results">
            {searchResults().map((result) => (
              <div
                class="location-picker__result-item"
                onClick={() => selectLocation(result)}
              >
                {result.display_name}
              </div>
            ))}
          </div>
        </Show>
      </div>

      <div ref={mapContainer} class="location-picker__map"></div>

      <Show when={props.value}>
        <div class="location-picker__info">
          <div class="location-picker__coordinates">
            <strong>Coordinates:</strong> {props.value?.lat.toFixed(6)}, {props.value?.lng.toFixed(6)}
          </div>
          
          <Show when={!editingAddress()}>
            <div class="location-picker__address">
              <strong>Address:</strong> {props.value?.address || 'No address available'}
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
    </div>
  );
};
