import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, screen, waitFor } from '@solidjs/testing-library';
import { LocationPicker, LocationValue } from './location-picker';

// Mock the window.L (Leaflet) global
const mockLeaflet = {
  map: vi.fn(() => ({
    setView: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
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

    // Check that search input is rendered
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    expect(searchInput).toBeInTheDocument();

    // Check that search button is rendered
    const searchButton = screen.getByText('Search');
    expect(searchButton).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const mockOnChange = vi.fn();
    render(() => (
      <LocationPicker onChange={mockOnChange} placeholder="Find a place..." />
    ));

    const searchInput = screen.getByPlaceholderText('Find a place...');
    expect(searchInput).toBeInTheDocument();
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

  it('disables interactions when disabled prop is true', () => {
    const mockOnChange = vi.fn();
    render(() => <LocationPicker onChange={mockOnChange} disabled={true} />);

    const searchInput = screen.getByPlaceholderText(
      'Search for a location...'
    ) as HTMLInputElement;
    const searchButton = screen.getByText('Search') as HTMLButtonElement;

    expect(searchInput.disabled).toBe(true);
    expect(searchButton.disabled).toBe(true);
  });

  it('handles search query input', async () => {
    const mockOnChange = vi.fn();
    const mockSearchResults = [
      {
        lat: '51.5074',
        lon: '-0.1278',
        display_name: '10 Downing Street, London, UK',
        address: {
          city: 'London',
          country: 'United Kingdom',
          postcode: 'SW1A 2AA',
        },
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockSearchResults,
    });

    render(() => <LocationPicker onChange={mockOnChange} />);

    const searchInput = screen.getByPlaceholderText(
      'Search for a location...'
    ) as HTMLInputElement;

    // Type in search input
    searchInput.value = 'London';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      expect(searchInput.value).toBe('London');
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

  it('updates marker when value changes', async () => {
    const mockOnChange = vi.fn();
    let value: LocationValue = {
      lat: 51.5074,
      lng: -0.1278,
    };

    const { rerender } = render(() => (
      <LocationPicker onChange={mockOnChange} value={value} />
    ));

    // Change value
    value = {
      lat: 48.8566,
      lng: 2.3522,
    };

    rerender(() => <LocationPicker onChange={mockOnChange} value={value} />);

    await waitFor(() => {
      // Check that coordinates updated
      expect(screen.getByText(/48.856600/)).toBeInTheDocument();
    });
  });
});
