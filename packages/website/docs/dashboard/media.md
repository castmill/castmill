---
sidebar_position: 2
title: Media
description: Upload, process, organize and manage the images and videos of your organization.
---

# Media

Media files are the images and videos that your playlists show. You manage them in **Content → Medias**.

## The Content overview

**Content** in the sidebar opens an overview of your content resources and their quota usage: **Playlists**, **Media Files**, **Storage** and **Widgets**. Each card shows how much you use of your plan and warns you with **Approaching limit** or **Quota limit reached**. See [Usage and quotas](./usage-and-quotas.md).

## Supported files

The upload dialog accepts these file types:

| Type | Formats |
| --- | --- |
| Images | PNG, JPEG, GIF |
| Videos | MP4, QuickTime (MOV), AVI, OGG, WMV |

The server accepts any file that it identifies as an image or a video and rejects everything else with the message "Only images and videos are allowed".

## Uploading media

1. Open **Content → Medias**.
2. Click **Upload Media**.
3. Drag files onto the upload area, or click it to choose files. You can upload several files at once; each file shows its own progress.
4. Wait for the upload to finish. Processing starts on the server right away.

<Screenshot src="media-upload" alt="The Upload Medias dialog with an image and a video ready to upload" width={530} />

The maximum file size is your organization's `max_upload_size` quota. A file above the limit is rejected before it is sent, with a message such as "File size exceeds the maximum upload limit". Files larger than half the limit show a warning that the upload may take a while. Each upload also counts towards the media and storage quotas.

## Processing

After the upload, Castmill processes every file in the background. A media item goes through these states:

<Flow steps={["Uploading|File is sent", "Transcoding|Progress shown", "Ready|Can be used", "Failed|Error message shown"]} />

| File | What Castmill creates |
| --- | --- |
| Image | A 128 px thumbnail, a 640 px preview and a 1920 px poster |
| Video | A thumbnail image and two H.264 MP4 versions (640 px and 1920 px). The video duration is stored, so playlist items use the real length of the video. |

While a file is transcoding, the list shows a progress indicator in place of the thumbnail. If transcoding fails, the thumbnail area shows **Transcoding failed** and the error message.

When a file is ready you receive a notification such as **New Image Uploaded** or **New Video Uploaded**. See [Notifications](./notifications.md).

## Browsing media

The media list shows a thumbnail, the name, size, type, tags and the created and updated dates of each file.

<Screenshot src="media-library" alt="The media list with thumbnails, sizes, types, dates and coloured tags" />

- **Search** filters by name.
- The **Team** filter shows only the media of one team. When a team is selected, new uploads are added to that team. See [Teams](./teams.md).
- The **Tags** filter shows media with **Any** or **All** of the selected tags.
- The view toggle switches between the table and a tree grouped by tag group and tag. See [Tags](./tags.md).

## Media details

Click a media item, or its **View** action, to open the **Media "name"** drawer. It shows when the file was added and last updated, a preview of the image or video, and the name, which you can change. Click **Save** to keep the new name, or **Reset** to undo your change.

<Screenshot src="media-details" alt="The media drawer with the name field and a preview of the Weekend brunch image" />

## Tagging media

Click the tag cell of a row, or **Manage Tags**, to open the tag popover. Switch tags on or off, or type a new tag name to create a tag. To tag several files at once, select them with the checkboxes and use **Manage Tags** in the selection bar. Tagging requires the Administrator or Manager role.

## Deleting media

Use the **Remove** action on a row, or select several rows and click **Delete**. Deleting a media file also removes its processed versions from storage.

:::note
You cannot delete a media file that is used as the organization logo. Choose a different logo first.
:::

## Using media in playlists

Media appears on screens through widgets. Add an **Image** or **Video** widget to a playlist and pick the file in the widget settings. See [Playlists](./playlists.md) and [Widgets](./widgets.md).
