# Layout Widgets & Circular Reference Prevention

## Overview

Layout widgets allow users to create complex multi-zone displays by embedding playlists within playlists. This creates a hierarchical structure that requires careful handling to prevent circular references that would cause infinite loops in the player.

## Layout Widget Architecture

### Layout Widget (`layout-widget`)

The system widget for creating multi-zone displays using reusable layouts:

- **Aspect Ratio**: Inherited from the selected layout
- **Zones**: Dynamic, defined by the selected layout
- **Configuration**: Uses `layout-ref` option type to select a layout and assign playlists to zones

#### Template Structure

```json
{
  "type": "layout",
  "name": "layout-ref-widget",
  "style": {
    "width": "100%",
    "height": "100%",
    "position": "relative",
    "overflow": "hidden"
  },
  "opts": {
    "layoutRef": { "key": "options.layoutRef" }
  }
}
```

#### Options Schema

```json
{
  "layoutRef": {
    "type": "layout-ref",
    "required": true,
    "description": "Select a layout and assign playlists to each zone"
  }
}
```

#### Layout Reference Value Structure

The `layoutRef` option stores:

```json
{
  "layoutId": 123,
  "aspectRatio": "9:16",
  "zones": [...],
  "zonePlaylistMap": {
    "zone-1": 456,
    "zone-2": 789
  }
}
```

### System Layouts

System layouts are available to all organizations and cannot be deleted:

- **Portrait 3 Zones**: Three horizontal zones stacked vertically (9:16 aspect ratio)
  - Each zone takes 1/3 of the screen height
  - Suitable for portrait displays showing multiple content streams

## Circular Reference Prevention

### The Problem

When Playlist A contains a layout widget that references Playlist B, and Playlist B contains a layout widget that references Playlist A, you get a circular reference:

```
A -> B -> A -> B -> A -> ... (infinite loop)
```

This would crash the player by causing infinite recursion when rendering playlists.

### Three Layers of Protection

#### Layer 1: Client-Side Filtering

The `widget-config.tsx` component filters out playlists that would create cycles:

```typescript
// Initialize with current playlist ID immediately
const [excludedPlaylistIds, setExcludedPlaylistIds] = createSignal<number[]>([props.playlistId]);
const [ancestorsLoaded, setAncestorsLoaded] = createSignal(false);

// Fetch ancestor playlist IDs
createEffect(async () => {
  try {
    const response = await fetch(
      `${props.baseUrl}/dashboard/organizations/${props.organizationId}/playlists/${props.playlistId}/ancestors`,
      { credentials: 'include' }
    );
    if (response.ok) {
      const data = await response.json();
      setExcludedPlaylistIds([props.playlistId, ...(data.ancestor_ids || [])]);
    }
  } catch (error) {
    console.error('Failed to fetch playlist ancestors:', error);
    setExcludedPlaylistIds([props.playlistId]);
  } finally {
    setAncestorsLoaded(true);
  }
});

// When fetching playlists for the ComboBox
const filterParams: Record<string, string | boolean> = {};
const excluded = excludedPlaylistIds();
if (excluded.length > 0) {
  filterParams.exclude_ids = excluded.join(',');
}
```

**Critical**: Initialize `excludedPlaylistIds` with `[props.playlistId]` immediately to prevent self-selection before the async ancestors call completes.

#### Layer 2: Server-Side Atomic Validation (Insert)

Validation happens inside the transaction BEFORE creating the playlist item:

```elixir
# In resources.ex - insert_item_into_playlist/6
def insert_item_into_playlist(playlist_id, prev_item_id, widget_id, offset, duration, options \\ %{}) do
  Repo.transaction(fn ->
    with {:ok, prev_item, next_item_id} <- get_prev_and_next_items(playlist_id, prev_item_id),
         # Validate BEFORE creating the playlist item - ATOMIC
         :ok <- Castmill.Widgets.validate_playlist_references_for_widget(widget_id, playlist_id, options),
         {:ok, item} <- create_playlist_item(%{...}),
         {:ok, widget_config} <- Castmill.Widgets.new_widget_config(widget_id, item.id, options),
         :ok <- link_playlist_items(prev_item, item) do
      Map.put(item, :widget_config_id, widget_config.id)
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end)
end
```

#### Layer 3: Server-Side Validation (Update)

When updating existing widget configs:

```elixir
# In widgets.ex - update_widget_config/4
def update_widget_config(playlist_id, playlist_item_id, options, data) do
  with :ok <- validate_playlist_references(playlist_id, playlist_item_id, options) do
    # Proceed with update
  end
end
```

## Key Functions

### `Resources.get_playlist_ancestors/1`

Returns all ancestor playlist IDs (recursive).

```elixir
def get_playlist_ancestors(playlist_id) when is_integer(playlist_id) do
  get_playlist_ancestors_recursive(playlist_id, MapSet.new(), MapSet.new())
  |> MapSet.to_list()
end

defp get_playlist_ancestors_recursive(playlist_id, visited, ancestors) do
  if MapSet.member?(visited, playlist_id) do
    ancestors  # Already processed, prevent infinite loop
  else
    new_visited = MapSet.put(visited, playlist_id)
    parent_ids = get_direct_parent_playlists(playlist_id)
    
    Enum.reduce(parent_ids, ancestors, fn parent_id, acc ->
      updated = MapSet.put(acc, parent_id)
      get_playlist_ancestors_recursive(parent_id, new_visited, updated)
    end)
  end
end
```

### `Resources.validate_no_circular_reference/2`

Validates that selecting a playlist won't create a cycle.

```elixir
def validate_no_circular_reference(current_playlist_id, selected_playlist_id) do
  cond do
    # Can't select the same playlist
    current_playlist_id == selected_playlist_id ->
      {:error, :circular_reference}
    
    # If selected is an ancestor of current, adding it as child creates cycle
    # Example: A -> B exists, now B tries to add A -> would create A -> B -> A
    selected_playlist_id in get_playlist_ancestors(current_playlist_id) ->
      {:error, :circular_reference}
    
    true ->
      :ok
  end
end
```

### `Widgets.validate_playlist_references_for_widget/3`

Public entry point for validation before creating playlist items.

```elixir
def validate_playlist_references_for_widget(widget_id, playlist_id, options) do
  widget = get_widget(widget_id)
  
  if widget && is_layout_widget?(widget) do
    playlist_refs = extract_playlist_references(options)
    
    Enum.reduce_while(playlist_refs, :ok, fn ref_playlist_id, _acc ->
      case Castmill.Resources.validate_no_circular_reference(playlist_id, ref_playlist_id) do
        :ok -> {:cont, :ok}
        {:error, :circular_reference} -> {:halt, {:error, :circular_reference}}
      end
    end)
  else
    :ok
  end
end

defp is_layout_widget?(widget) do
  widget && widget.slug in ["layout-portrait-3"]
end

defp extract_playlist_references(options) when is_map(options) do
  ["playlist_1", "playlist_2", "playlist_3"]
  |> Enum.map(&Map.get(options, &1))
  |> Enum.filter(&(&1 != nil))
  |> Enum.map(fn
    id when is_integer(id) -> id
    id when is_binary(id) -> 
      case Integer.parse(id) do
        {int_id, ""} -> int_id
        _ -> nil
      end
    _ -> nil
  end)
  |> Enum.filter(&(&1 != nil))
end
```

## API Endpoints

### Get Playlist Ancestors

```
GET /dashboard/organizations/:org_id/playlists/:playlist_id/ancestors
GET /api/organizations/:org_id/playlists/:playlist_id/ancestors
```

**Response:**
```json
{
  "ancestor_ids": [123, 456, 789]
}
```

Returns an empty array for standalone playlists not referenced by any layout widget.

### Playlist Filter

The playlist list endpoint supports filtering out IDs:

```
GET /api/organizations/:org_id/playlists?exclude_ids=1,2,3
```

Implemented via `Playlist.apply_filter/1` in the Filterable behaviour.

## Test Coverage

Tests are in `test/castmill_web/controllers/resource_controller/playlists_test.exs`:

### Ancestors API Tests (9 tests)
- Standalone playlist returns empty ancestors
- Single parent returns that parent
- Chain returns all ancestors (grandparent -> parent -> child)
- Multiple parents returns all of them
- Same playlist in multiple slots doesn't duplicate
- Non-layout widget references are ignored
- Non-existent playlist returns empty
- Diamond dependency (multiple paths to same ancestor)
- Cycle detection doesn't cause infinite loop

### Circular Reference Prevention Tests (4 tests)
- Self-reference prevention
- Direct cycle prevention (A -> B -> A)
- Indirect cycle prevention (A -> B -> C -> A)
- Valid non-circular structures allowed (diamond pattern)

## Common Mistakes

### ❌ Empty Initial State

```typescript
// WRONG - allows self-selection before fetch completes
const [excludedPlaylistIds, setExcludedPlaylistIds] = createSignal<number[]>([]);
```

```typescript
// CORRECT - prevents self-selection immediately
const [excludedPlaylistIds, setExcludedPlaylistIds] = createSignal<number[]>([props.playlistId]);
```

### ❌ Wrong Validation Direction

```elixir
# WRONG - checks if current is ancestor of selected
current_playlist_id in get_playlist_ancestors(selected_playlist_id)
```

```elixir
# CORRECT - checks if selected is ancestor of current
selected_playlist_id in get_playlist_ancestors(current_playlist_id)
```

### ❌ Non-Atomic Validation

```elixir
# WRONG - validates after creating the item (race condition possible)
{:ok, item} <- create_playlist_item(%{...}),
:ok <- validate_circular_reference(...)
```

```elixir
# CORRECT - validates before creating (inside transaction)
:ok <- validate_circular_reference(...),
{:ok, item} <- create_playlist_item(%{...})
```

### ❌ Missing Visited Set in Recursion

```elixir
# WRONG - no cycle protection in recursion
defp get_ancestors_recursive(playlist_id, ancestors) do
  parent_ids = get_direct_parents(playlist_id)
  Enum.reduce(parent_ids, ancestors, fn parent_id, acc ->
    get_ancestors_recursive(parent_id, MapSet.put(acc, parent_id))
  end)
end
```

```elixir
# CORRECT - uses visited set to prevent infinite loop
defp get_ancestors_recursive(playlist_id, visited, ancestors) do
  if MapSet.member?(visited, playlist_id) do
    ancestors
  else
    new_visited = MapSet.put(visited, playlist_id)
    # ... recurse with new_visited
  end
end
```

## Database Queries

The `get_direct_parent_playlists/1` function finds playlists that contain a given playlist through layout widgets:

```elixir
defp get_direct_parent_playlists(playlist_id) do
  query = from(pi in PlaylistItem,
    join: wc in assoc(pi, :widget_config),
    join: w in assoc(wc, :widget),
    where: w.slug in ["layout-portrait-3"] and
           (fragment("(?->>'playlist_1')::integer = ?", wc.options, ^playlist_id) or
            fragment("(?->>'playlist_2')::integer = ?", wc.options, ^playlist_id) or
            fragment("(?->>'playlist_3')::integer = ?", wc.options, ^playlist_id)),
    select: pi.playlist_id,
    distinct: true
  )
  
  Repo.all(query)
end
```

## Future Considerations

When adding new layout widgets:

1. Add the slug to `is_layout_widget?/1` check
2. Update `extract_playlist_references/1` if using different option keys
3. Update `get_direct_parent_playlists/1` query to include new widget slug
4. Add corresponding tests

## Related Files

- `packages/castmill/lib/castmill/resources.ex` - Ancestor detection and validation
- `packages/castmill/lib/castmill/widgets.ex` - Widget-specific validation
- `packages/castmill/lib/castmill/resources/playlist.ex` - Playlist filter (exclude_ids)
- `packages/castmill/lib/castmill_web/controllers/playlist_controller.ex` - API endpoint
- `packages/castmill/lib/castmill/addons/playlists/components/widget-config.tsx` - Client-side filtering
- `packages/player/src/widgets/template/layout.tsx` - Layout widget renderer
