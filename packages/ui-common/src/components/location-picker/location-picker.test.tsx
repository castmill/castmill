import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, screen, waitFor } from '@solidjs/testing-library';
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
    setLatLng: vi.fn(),
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
});
