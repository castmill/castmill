# Universal Tags/Labels System for Resource Organization

## Overview

This document describes the design and implementation of a flexible tagging system that allows users to organize resources (medias, devices, playlists, channels, etc.) according to their preferred categorization schemes such as campaigns, locations, offices, or any custom taxonomy.

## Key Design Principles

1. **Flexible Taxonomy** - Users create their own organizational structure
2. **Multi-dimensional** - Resources can have multiple tags (e.g., "Summer Campaign" AND "London Office")
3. **Organization-scoped** - Tags belong to an organization, not shared globally
4. **No Access Control Implications** - Tags are purely for organization (unlike Teams which control access)
5. **Generic Architecture** - Works across all resource types using polymorphic associations
6. **Optional Grouping** - Tags can be organized into groups (e.g., "Location", "Campaign") for better UX

## Architecture

### Tags vs Teams

| Feature | Tags | Teams |
|---------|------|-------|
| Purpose | Organization/categorization | Access control |
| Multiple per resource | Yes | Yes |
| User membership | No | Yes |
| Permission levels | No | Yes (read/write/delete) |
| Groups/Categories | Yes (optional) | No |

### Database Schema

```
┌──────────────────┐
│   tag_groups     │  (Optional: for organizing tags by category)
├──────────────────┤
│ id               │
│ name             │  e.g., "Location", "Campaign", "Department"
│ color            │  Optional: for visual distinction
│ icon             │  Optional: for visual distinction
│ organization_id  │
│ position         │  For ordering groups
└───────┬──────────┘
        │
        │ 1:N
        ▼
┌──────────────────┐
│     tags         │
├──────────────────┤
│ id               │
│ name             │  e.g., "London Office", "Summer 2026"
│ color            │  For visual distinction (pill/badge color)
│ tag_group_id     │  Optional: FK to tag_groups
│ organization_id  │
│ position         │  For ordering within group
└───────┬──────────┘
        │
        │ N:M (polymorphic)
        ▼
┌──────────────────┐
│  resource_tags   │  (Polymorphic join table)
├──────────────────┤
│ tag_id           │
│ resource_type    │  "media", "device", "playlist", "channel"
│ resource_id      │
└──────────────────┘
```

### API Endpoints

#### Tag Groups (Optional)
- `GET /api/organizations/:org_id/tag_groups` - List all tag groups
- `POST /api/organizations/:org_id/tag_groups` - Create tag group
- `PUT /api/organizations/:org_id/tag_groups/:id` - Update tag group
- `DELETE /api/organizations/:org_id/tag_groups/:id` - Delete tag group

#### Tags
- `GET /api/organizations/:org_id/tags` - List all tags (optionally filter by group)
- `POST /api/organizations/:org_id/tags` - Create tag
- `PUT /api/organizations/:org_id/tags/:id` - Update tag
- `DELETE /api/organizations/:org_id/tags/:id` - Delete tag

#### Resource Tagging
- `GET /api/organizations/:org_id/:resource_type/:id/tags` - Get tags for a resource
- `PUT /api/organizations/:org_id/:resource_type/:id/tags` - Set tags for a resource (replace all)
- `POST /api/organizations/:org_id/:resource_type/:id/tags` - Add tag(s) to a resource
- `DELETE /api/organizations/:org_id/:resource_type/:id/tags/:tag_id` - Remove tag from resource

#### Filtering
- Existing list endpoints (medias, devices, etc.) support `?tags=1,2,3` query parameter

### Frontend Components

#### 1. TagFilter Component
Similar to TeamFilter, appears in table toolbar for filtering by tags.

```tsx
<TagFilter
  tags={tags()}
  selectedTagIds={selectedTagIds()}
  onTagChange={handleTagChange}
  multiSelect={true}  // Can filter by multiple tags
/>
```

#### 2. TagBadge Component
Small colored badge/pill showing a tag name.

```tsx
<TagBadge tag={tag} onRemove={handleRemove} />
```

#### 3. TagEditor Component
Used in resource detail views to add/remove tags.

```tsx
<TagEditor
  resourceType="media"
  resourceId={media.id}
  selectedTags={media.tags}
  availableTags={allTags()}
  onTagsChange={handleTagsChange}
/>
```

#### 4. TagsManager Page
Dedicated page for managing tags and tag groups (under Settings or as separate addon).

### Frontend Hooks

#### useTagFilter Hook
Similar to useTeamFilter, manages tag selection state with URL sync.

```tsx
const { tags, selectedTagIds, setSelectedTagIds } = useTagFilter({
  baseUrl: props.store.env.baseUrl,
  organizationId: props.store.organizations.selectedId,
  params: props.params,
});
```

### Color System

Default color palette for tags (users can customize):
- `#3B82F6` - Blue (default)
- `#10B981` - Green
- `#F59E0B` - Amber
- `#EF4444` - Red
- `#8B5CF6` - Purple
- `#EC4899` - Pink
- `#06B6D4` - Cyan
- `#6B7280` - Gray

## Implementation Plan

### Phase 1: Backend Foundation ✅ COMPLETE
1. Database migrations for tags, tag_groups, resource_tags
2. Ecto schemas
3. Tags context with CRUD operations
4. API controllers
5. Tag filtering support in resource list endpoints

### Phase 2: Frontend Core ✅ COMPLETE
1. TagsService for API calls
2. useTagFilter hook
3. TagFilter component
4. TagBadge component

### Phase 3: Integration ✅ COMPLETE
1. Add tag filtering to table views (medias, devices, playlists, channels)
2. TagEditor in resource detail modals
3. Bulk tagging operations

### Phase 4: Tags Management ✅ COMPLETE
1. Tags management page (as addon)
2. Tag groups support
3. Color picker for tags

## Usage Examples

### Example 1: Location-based Organization
```
Tag Groups:
  └── Location
      ├── London Office
      ├── NYC Office
      └── Tokyo Office

User filters: devices by "London Office"
→ Shows only devices tagged with that location
```

### Example 2: Campaign-based Organization
```
Tag Groups:
  └── Campaign
      ├── Summer Sale 2026
      ├── Holiday Promo
      └── New Product Launch

User filters: medias by "Summer Sale 2026"
→ Shows all media files for that campaign
```

### Example 3: Multi-dimensional Filtering
```
User applies filters:
  - Location: "London Office"
  - Campaign: "Summer Sale 2026"

→ Shows only resources tagged with BOTH tags
```

## i18n Requirements

New translation keys needed:
- `tags.title` - "Tags"
- `tags.create` - "Create Tag"
- `tags.edit` - "Edit Tag"
- `tags.delete` - "Delete Tag"
- `tags.groups` - "Tag Groups"
- `tags.addToResource` - "Add Tags"
- `tags.removeFromResource` - "Remove Tag"
- `tags.filter.placeholder` - "Filter by tags..."
- `tags.filter.clearAll` - "Clear all"
- `tags.noTags` - "No tags"
- `tags.manageTags` - "Manage Tags"
- `tags.colorPicker` - "Choose Color"
- `tags.confirmDelete` - "Are you sure you want to delete this tag?"

## Quotas Consideration

Tags could be added to the quota system if needed:
- `tags` - Maximum number of tags per organization
- Default: Reasonable limit (e.g., 100 tags)

## Migration Path

For existing users:
1. Tags feature launches as optional (no tags = current behavior)
2. Users can gradually adopt tags
3. Teams continue to work for access control
4. Tags complement teams for organization

## Related Documentation

- [Team Filter Implementation](../packages/castmill/docs/architecture/TEAM_FILTER_URL_PARAMS_IMPLEMENTATION.md)
- [Quotas System](./QUOTAS.md)
- [UI Common Components](../packages/ui-common/README.md)
