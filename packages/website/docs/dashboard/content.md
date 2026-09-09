---
sidebar_position: 2
---

# Content & Media

The **Content** section is the hub for all your digital signage assets. It provides an overview of your resource usage and links to the individual content pages.

## Content Overview

The main content page (`/content`) displays a **dashboard-style overview** with quota usage cards for:

- **Playlists** — used / total
- **Medias** — used / total
- **Storage** — bytes used / bytes available
- **Widgets** — used / total

Each card shows a progress bar and warns you when you are approaching your plan's limits.

## Medias

The Medias page lets you upload, organize, and manage images and videos.

### Supported Formats

| Type       | Formats                             |
| ---------- | ----------------------------------- |
| **Images** | PNG, JPEG, GIF                      |
| **Videos** | MP4, QuickTime (MOV), AVI, OGG, WMV |

### Uploading Media

1. Click **Upload** or press **Ctrl+N**
2. Either **drag and drop** files onto the upload area, or click to browse
3. Multiple files can be uploaded at once — each shows individual progress
4. File size is validated against your organization's `max_upload_size` quota
   - A soft warning appears at 50% of the limit
   - Uploads are blocked above the limit

After upload, videos go through a **transcoding** step. A progress indicator is shown until the media is ready.

### Managing Media

- **Table view** with columns for thumbnail, name, size, type, tags, and timestamps
- **Tree view** organizes media by tag hierarchy
- **Rename** — Click a media item to open the detail view, then edit the name
- **Preview** — Images and videos can be previewed in the detail modal
- **Tags** — Click the tag column to open a popover with all available tags
- **Bulk operations** — Select multiple items for bulk delete or bulk tagging

### Media Thumbnails

Once processing is complete, media items display thumbnails in the table view. During transcoding, a circular progress indicator is shown. If transcoding fails, a fallback message appears.

## Playlists

See the dedicated [Playlists](playlists.md) page.

## Layouts

See the dedicated [Layouts](layouts.md) page.

## Widgets

The Widgets page shows all widgets installed in your network. Widgets are the building blocks used inside playlists — each widget type defines how a specific kind of content is rendered (image, video, ticker, web page, etc.).

Widgets are managed at the **network level** and are available to all organizations within the network. You can browse the widget catalog but cannot install or remove widgets from the dashboard (this is a network admin operation).
