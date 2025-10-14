# Castmill Tests

This directory contains tests for the Castmill addon components and services.

## Running Tests

To run the tests for this package:

```bash
# From the package directory
cd packages/castmill/assets
yarn test

# Run tests in watch mode
yarn test --watch

# Run tests with UI
yarn test:ui

# Generate coverage report
yarn test:coverage
```

## Test Files

### Services
- `playlists.service.test.ts` - Tests for the PlaylistsService, including the new widget search functionality

### Components
- `widget-chooser.test.tsx` - Tests for the WidgetChooser component, including search input and debouncing
- `playlist-view.test.tsx` - Integration tests for the PlaylistView component with widget search

## Test Coverage

The tests cover:
- ✅ Widget search functionality with search parameter
- ✅ Debounced search input (300ms delay)
- ✅ Search with special characters (URL encoding)
- ✅ Empty search results handling
- ✅ Error handling for API failures
- ✅ Component rendering and interaction
- ✅ Integration between components and services

## Dependencies

The test suite uses:
- **Vitest** - Fast unit test framework
- **@solidjs/testing-library** - Testing utilities for SolidJS components
- **jsdom** - DOM implementation for Node.js

## Configuration

Test configuration is defined in:
- `vite.config.ts` - Vitest configuration
- `test-setup.ts` - Test environment setup and global mocks
