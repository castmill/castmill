---
sidebar_position: 9
---

# Tags

Tags are **color-coded labels** that help you organize resources across the dashboard. You can tag medias, playlists, channels, and devices, then use tags to filter and group content.

## Tag Structure

Tags have two levels of organization:

- **Tags** — Individual labels with a name and color
- **Tag Groups** — Optional containers that group related tags together

For example, you might create a tag group called "Locations" with tags "Lobby", "Cafeteria", and "Meeting Room".

## Managing Tags

Navigate to **Tags** in the sidebar to create and manage tags.

### Creating Tags

1. Click **Create Tag**
2. Enter a **name**
3. Choose a **color** from the palette
4. Optionally assign to a **tag group**
5. Click **Create**

### Creating Tag Groups

1. Click **Create Group**
2. Enter a **name** and optional **color**
3. Click **Create**

Tags assigned to the group appear nested beneath it.

### Editing and Deleting

- **Edit** — Click a tag or group to change its name or color
- **Delete tag** — Removes the tag from all associated resources
- **Delete group** — Deletes the group **and all tags within it** (with confirmation)

:::info
Tag management requires the **admin** or **manager** role. Members and viewers can see and use tags for filtering but cannot create, edit, or delete them.
:::

## Using Tags

Tags are integrated throughout the dashboard:

### Tagging Resources

On any resource page (medias, playlists, etc.):

1. Click the **tag column** on a resource row
2. A popover appears showing all tag groups and their tags
3. Toggle tags on or off using the switches
4. Changes are saved immediately

### Bulk Tagging

1. Select multiple resources using checkboxes
2. Click **Tag** in the bulk actions toolbar
3. Apply or remove tags from all selected resources at once

### Filtering by Tags

Every resource page has a **Tag filter** in the toolbar:

1. Click the tag filter button
2. Select one or more tags
3. Choose filter mode:
   - **Any** — Show resources that have at least one of the selected tags
   - **All** — Show only resources that have every selected tag
4. The list updates immediately

### Tree View

When you switch to **tree view** on a resource page, resources are organized by tag hierarchy:

```
📁 Locations (group)
  🏷️ Lobby
    📄 Welcome Video
    📄 Company News Playlist
  🏷️ Cafeteria
    📄 Menu Board
📁 Ungrouped
  🏷️ Priority
    📄 Emergency Alert
```

This gives a more structured overview of how your content is organized.

### Inline Tag Creation

When tagging a resource, you can create new tags directly from the tag popover without navigating to the Tags page.
