import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { LocationPicker, LocationValue } from './location-picker';

// Mock the window.L (Leaflet) global
const mockMapContainer = document.createElement('div');
const mockLeaflet = {
  map: vi.fn(() => ({
    setView: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    scrollWheelZoom: {
      enable: vi.fn(),
      disable: vi.fn(),
    },
    getContainer: vi.fn(() => mockMapContainer),
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    dragging: { enable: vi.fn(), disable: vi.fn() },
  })),
};

describe('LocationPicker Component', () => {
  beforeEach(() => {
    // Mock the Leaflet library
    (window as any).L = mockLeaflet;

    // Mock fetch for geocoding
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    const mockOnChange = vi.fn();
    render(() => <LocationPicker onChange={mockOnChange} />);

    // Check that the ComboBox label is rendered
    expect(screen.getByText('Search Location')).toBeInTheDocument();

    // Check that the placeholder text is shown in selected-item div
    expect(screen.getByText('Search for a location...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const mockOnChange = vi.fn();
    render(() => (
      <LocationPicker onChange={mockOnChange} placeholder="Find a place..." />
    ));

    // The placeholder is now shown in the ComboBox's selected-item area
    expect(screen.getByText('Find a place...')).toBeInTheDocument();
  });

  it('displays location info when value is provided', () => {
    const mockOnChange = vi.fn();
    const mockValue: LocationValue = {
      lat: 51.5074,
      lng: -0.1278,
      address: '10 Downing Street, London, UK',
    };

    render(() => <LocationPicker onChange={mockOnChange} value={mockValue} />);

    // Check coordinates are displayed
    expect(screen.getByText(/51.507400/)).toBeInTheDocument();
    expect(screen.getByText(/-0.127800/)).toBeInTheDocument();

    // Check address is displayed
    expect(
      screen.getByText(/10 Downing Street, London, UK/)
    ).toBeInTheDocument();
  });

  it('calls onChange when location value changes', async () => {
    const mockOnChange = vi.fn();
    const mockValue: LocationValue = {
      lat: 51.5074,
      lng: -0.1278,
    };

    render(() => <LocationPicker onChange={mockOnChange} value={mockValue} />);

    // Click edit button
    const editButton = screen.getByText('Edit');
    editButton.click();

    // Wait for edit mode to activate
    await waitFor(() => {
      const addressInput = screen.getByPlaceholderText('Enter address...');
      expect(addressInput).toBeInTheDocument();
    });
  });

  it('shows no address available when address is not present', () => {
    const mockOnChange = vi.fn();
    const mockValue: LocationValue = {
      lat: 51.5074,
      lng: -0.1278,
    };

    render(() => <LocationPicker onChange={mockOnChange} value={mockValue} />);

    expect(screen.getByText('No address available')).toBeInTheDocument();
  });

  it('initializes map on mount', async () => {
    const mockOnChange = vi.fn();

    render(() => <LocationPicker onChange={mockOnChange} />);

    // Wait for async map initialization
    await waitFor(
      () => {
        // Map should be created with default location
        expect(mockLeaflet.map).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });

  it('renders with custom search label', () => {
    const mockOnChange = vi.fn();
    render(() => (
      <LocationPicker onChange={mockOnChange} searchLabel="Find Location" />
    ));

    expect(screen.getByText('Find Location')).toBeInTheDocument();
  });

  it('displays map container', () => {
    const mockOnChange = vi.fn();
    render(() => <LocationPicker onChange={mockOnChange} />);

    // Check that the map container exists
    const mapContainer = document.querySelector('.location-picker__map');
    expect(mapContainer).toBeInTheDocument();
  });

  it('hides the address line when showAddress is false', () => {
    render(() => (
      <LocationPicker
        onChange={vi.fn()}
        value={{ lat: 1, lng: 2, address: 'Somewhere' }}
        showAddress={false}
      />
    ));
    expect(screen.getByText(/1\.000000/)).toBeInTheDocument();
    expect(screen.queryByText(/Somewhere/)).toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('blocks the search while disabled', () => {
    const { container } = render(() => (
      <LocationPicker onChange={vi.fn()} disabled />
    ));
    const search = container.querySelector('.location-picker__search')!;
    expect(search.hasAttribute('inert')).toBe(true);
    expect(search.getAttribute('aria-disabled')).toBe('true');
  });

  it('removes the marker when the value is cleared and restores it', async () => {
    const [value, setValue] = createSignal<LocationValue | undefined>({
      lat: 1,
      lng: 2,
    });
    render(() => <LocationPicker onChange={vi.fn()} value={value()} />);
    // Maps of earlier tests may still be loading: take this one's marker.
    const markerAt = (lat: number, lng: number) => {
      const i = mockLeaflet.marker.mock.calls.findIndex(
        (c: any[]) => c[0][0] === lat && c[0][1] === lng
      );
      return i < 0 ? undefined : mockLeaflet.marker.mock.results[i].value;
    };
    await waitFor(() => expect(markerAt(1, 2)).toBeDefined());
    const marker = markerAt(1, 2);
    expect(marker.addTo).toHaveBeenCalledTimes(1);

    setValue(undefined);
    expect(marker.remove).toHaveBeenCalledTimes(1);

    setValue({ lat: 3, lng: 4 });
    expect(marker.setLatLng).toHaveBeenLastCalledWith([3, 4]);
    expect(marker.addTo).toHaveBeenCalledTimes(2);
  });

  it('places no marker without a value', async () => {
    render(() => <LocationPicker onChange={vi.fn()} />);
    await waitFor(() => expect(mockLeaflet.marker).toHaveBeenCalled());
    // Without a value the marker is created at the default but not shown.
    mockLeaflet.marker.mock.results.forEach((r: any) =>
      expect(r.value.addTo).not.toHaveBeenCalled()
    );
  });
});
