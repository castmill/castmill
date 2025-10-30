# Global Search Implementation Guide

## Overview

The Castmill platform implements a comprehensive global search feature that allows users to search across all resources within their organization. The search functionality includes:

- **Backend API**: RESTful endpoint for searching across all resource types
- **Addon Interface**: Optional search callback for custom addons
- **Frontend UI**: Paginated search results page with grouped results by resource type
- **Internationalization**: Full i18n support in 9 languages

## Architecture

### Backend Components

#### Search Controller (`SearchController`)
Location: `packages/castmill/lib/castmill_web/controllers/search_controller.ex`

The search controller provides a single endpoint that:
1. Searches built-in resources (medias, playlists, channels, devices, teams)
2. Searches addon resources (if they implement the search callback)
3. Returns paginated results grouped by resource type

**Endpoint**: `GET /dashboard/organizations/:organization_id/search`

**Query Parameters**:
- `query` (required): The search string
- `page` (optional, default: 1): Page number for pagination
- `page_size` (optional, default: 20): Number of results per page

**Response Format**:
```json
{
  "query": "search term",
  "page": 1,
  "page_size": 20,
  "results": [
    {
      "resource_type": "medias",
      "data": [
        {
          "id": "1",
          "name": "Media Name",
          "description": "Description..."
        }
      ],
      "count": 5,
      "page": 1,
      "page_size": 20,
      "total_pages": 1
    },
    {
      "resource_type": "playlists",
      "data": [...],
      "count": 3,
      "page": 1,
      "page_size": 20,
      "total_pages": 1
    }
  ]
}
```

#### Addon Search Interface
Location: `packages/castmill/lib/castmill/addons/addon_behaviour.ex`

Addons can optionally implement the `search/3` callback:

```elixir
@callback search(
  organization_id :: String.t(),
  query :: String.t(),
  opts :: map()
) :: {:ok, list()} | {:error, String.t()}
```

**Parameters**:
- `organization_id`: The organization to search within
- `query`: The search query string
- `opts`: Options map containing `page` and `page_size`

**Return Value**:
The addon should return a list of search result groups in the same format as the built-in resources:

```elixir
{:ok, [
  %{
    resource_type: "custom_resource",
    data: [...],
    count: 10,
    page: 1,
    page_size: 20,
    total_pages: 1
  }
]}
```

### Frontend Components

#### Search Service
Location: `packages/dashboard/src/services/search.service.ts`

TypeScript service that calls the backend search endpoint:

```typescript
SearchService.search(organizationId, query, page, pageSize)
  .then(response => {
    // Handle search results
  });
```

#### Search Page Component
Location: `packages/dashboard/src/pages/search-page/search-page.tsx`

SolidJS component that:
- Reads the search query from URL parameters (`?s=query`)
- Displays loading states
- Shows results grouped by resource type
- Handles errors gracefully
- Supports pagination
- Provides click-to-navigate functionality for each result

#### Search Input Component
Location: `packages/dashboard/src/components/search/search.tsx`

The global search input in the topbar:
- Keyboard shortcut: `Ctrl+F` (or `Cmd+F` on Mac)
- Navigate to search page on Enter
- Maintains organization context in the URL

## Implementation Guide

### Adding Search to a Custom Addon

To make your addon searchable, implement the `search/3` callback:

```elixir
defmodule Castmill.Addons.MyCustomAddon do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def search(organization_id, query, opts) do
    page = Map.get(opts, :page, 1)
    page_size = Map.get(opts, :page_size, 20)
    
    # Search your custom resources
    results = MyCustomResource.search(organization_id, query, page, page_size)
    total_count = MyCustomResource.count_search_results(organization_id, query)
    
    {:ok, [
      %{
        resource_type: "my_custom_resources",
        data: results,
        count: total_count,
        page: page,
        page_size: page_size,
        total_pages: ceil(total_count / page_size)
      }
    ]}
  end
end
```

### Adding Translations for Custom Resource Types

Add your resource type labels to all language files:

**English** (`packages/dashboard/src/i18n/locales/en.json`):
```json
{
  "sidebar": {
    "myCustomResources": "My Custom Resources"
  }
}
```

Repeat for all supported languages: `es.json`, `sv.json`, `de.json`, `fr.json`, `zh.json`, `ar.json`, `ko.json`, `ja.json`.

## Testing

### Backend Tests

To test the search endpoint (requires Elixir setup):

```bash
cd packages/castmill
mix test test/castmill_web/controllers/search_controller_test.exs
```

### Frontend Tests

Test the search service:

```bash
cd packages/dashboard
yarn test search.service.test.ts
```

Test the search page component:

```bash
cd packages/dashboard
yarn test search-page.test.tsx
```

## User Guide

### Using Global Search

1. **Access Search**: 
   - Click the search input in the topbar
   - Or press `Ctrl+F` (Windows/Linux) or `Cmd+F` (Mac)

2. **Enter Query**:
   - Type your search term
   - Press `Enter` to search

3. **View Results**:
   - Results are grouped by resource type
   - Click any result to navigate to that resource
   - Pagination appears when there are many results

### Search Behavior

- **Scope**: Search is limited to the current organization
- **Fields**: Searches resource names and descriptions
- **Matching**: Uses SQL LIKE with case-insensitive matching
- **Performance**: Results are paginated for optimal performance

## Security

- **Authentication**: Search endpoint requires authentication
- **Authorization**: Users can only search within organizations they have access to
- **RBAC**: Respects role-based access control (admin, member, guest)

## Performance Considerations

1. **Pagination**: Default page size is 20 items to prevent large responses
2. **Parallel Search**: Built-in resources and addons are searched concurrently
3. **Caching**: Consider implementing caching for frequently searched terms
4. **Indexing**: Ensure database indexes on name/description fields

## Future Enhancements

- [ ] Advanced search with filters (date, type, tags)
- [ ] Search history and suggestions
- [ ] Full-text search using PostgreSQL's full-text search capabilities
- [ ] Search result highlighting
- [ ] Saved searches
- [ ] Search analytics

## Troubleshooting

### No Results Found

- Verify the search term is correct
- Check that resources exist in the current organization
- Ensure you have the necessary permissions

### Slow Search Performance

- Check database indexes on `name` and `description` columns
- Consider reducing page size
- Review addon search implementations for efficiency

### Addon Resources Not Appearing

- Verify addon implements the `search/3` callback
- Check addon is registered in application configuration
- Review addon search implementation for errors

## Related Documentation

- [Addon Development Guide](../addons/README.md)
- [API Permissions Guide](./PERMISSIONS_COMPLETE.md)
- [Internationalization Guide](../../dashboard/AGENTS.md)
