---
sidebar_position: 7
---

# Usage & Quotas

The Usage page shows your organization's **resource consumption** relative to your plan limits. It provides a clear picture of how close you are to your quotas.

## Usage Dashboard

Navigate to **Usage** in the sidebar to see a card grid displaying each tracked resource:

| Resource      | What it Measures                    |
| ------------- | ----------------------------------- |
| **Medias**    | Number of uploaded media files      |
| **Storage**   | Total size of all uploaded files    |
| **Users**     | Number of users in the organization |
| **Devices**   | Number of registered devices        |
| **Playlists** | Number of playlists created         |
| **Channels**  | Number of channels created          |
| **Teams**     | Number of teams created             |
| **Widgets**   | Number of installed widgets         |
| **Layouts**   | Number of layouts created           |

### Card Information

Each card shows:

- **Resource icon and name**
- **Used / Total** values (e.g., "12 / 50" or "2.4 GB / 10 GB")
- **Percentage** of quota consumed
- **Progress bar** with visual fill

### Quota States

| State         | Condition              | Visual                                                 |
| ------------- | ---------------------- | ------------------------------------------------------ |
| **Normal**    | Below 90% usage        | Standard progress bar                                  |
| **Warning**   | At or above 90%        | Yellow/orange highlight with "Approaching limit" alert |
| **Full**      | At or above 100%       | Red highlight with "Quota limit reached" alert         |
| **Unlimited** | No limit set (0 total) | Empty state, no progress bar                           |

## Quota Enforcement

Quotas are enforced **per resource page** in addition to the centralized usage view:

- Each content page (Medias, Playlists, Layouts, Devices) shows a **quota indicator** in the toolbar
- When a quota is reached, the **Create** button is disabled with a message explaining the limit
- Media uploads check both the **file count** quota and the **storage size** quota

## Plan Limits

Quotas are determined by your organization's **plan**. Different plans offer different limits for each resource type. To see your current plan or upgrade, check with your network administrator.

:::tip
Keep an eye on the Usage page as your organization grows. Approaching quota limits can prevent new content from being created until resources are freed or your plan is upgraded.
:::
