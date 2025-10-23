# Castmill Notification System# Notification System



## Overview

The Castmill Notification System provides real-time notifications to users about important events in the platform, such as invitations, device registrations, and more.



The Castmill notification system provides real-time notifications to users about important events in the platform. Notifications are delivered via WebSocket (Phoenix Channels) and displayed in the Dashboard UI with full internationalization support across 9 languages.## Architecture



## Architecture
### Backend Components



### Backend Components#### 1. Database Schema

- **Table**: `notifications`

#### 1. Database Schema- **Primary Key**: `id` (bigint) - Auto-incrementing integer for optimal performance

- **Fields**:

**Table**: `notifications`  - `title_key` (string): Translation key for notification title (e.g., "organizations.notifications.types.deviceRegistration.title")

  - `description_key` (string): Translation key for notification description

**Primary Key**: `id` (bigint) - Auto-incrementing integer for optimal performance  - `link` (string): Optional link to related resource

  - `type` (string): Notification type identifier (e.g., "device_registration", "organization_invitation")

**Fields**:  - `read` (boolean): Whether the notification has been read (default: false)

- `title_key` (string): Translation key for notification title (e.g., `"organizations.notifications.types.deviceRegistration.title"`)  - `user_id` (binary_id): Foreign key to users (for user-specific notifications)

- `description_key` (string): Translation key for notification description  - `organization_id` (binary_id): Foreign key to organizations (for org-wide notifications)

- `link` (string): Optional link to related resource  - `team_id` (bigint): Foreign key to teams (for team-wide notifications) - **Note: Teams use integer IDs**

- `type` (string): Notification type identifier (e.g., `"device_registration"`, `"organization_invitation"`)  - `roles` (array of strings): Optional role filter for org/team notifications (e.g., ["admin", "device_manager"])

- `read` (boolean): Whether the notification has been read (default: false)  - `metadata` (map): Extensible JSON field for dynamic interpolation values and special fields like `excluded_user_ids`

- `user_id` (binary_id): Foreign key to users (for user-specific notifications)  - `actor_id` (string): ID of who/what triggered the notification (user ID, device ID, etc.)

- `organization_id` (binary_id): Foreign key to organizations (for org-wide notifications)  - `actor_type` (string): Type of actor - "user", "device", "system", "integration", "scheduler" (default: "user")

- `team_id` (bigint): Foreign key to teams (for team-wide notifications) - **Note: Teams use integer IDs**  - `inserted_at`, `updated_at`: Timestamps

- `roles` (array of strings): Optional role filter for org/team notifications (e.g., `["admin", "device_manager"]`)

- `metadata` (map): Extensible JSON field for dynamic interpolation values and special fields like `excluded_user_ids`**Important Schema Notes**:

- `actor_id` (string): ID of who/what triggered the notification (user ID, device ID, etc.)- **Translation Keys**: All notifications use translation keys instead of hardcoded text for full i18n support across 9 languages

- `actor_type` (string): Type of actor - `"user"`, `"device"`, `"system"`, `"integration"`, `"scheduler"` (default: `"user"`)- **Integer ID**: Uses auto-incrementing integer (not UUID) for better performance and smaller indexes

- `inserted_at`, `updated_at`: Timestamps- **Team ID Type**: Teams use integer foreign keys, not binary_ids

- **Indexes**: Only essential indexes (user_id, organization_id, team_id) for optimal write performance

**Important Schema Notes**:

- **Translation Keys**: All notifications use translation keys instead of hardcoded text for full i18n support across 9 languages#### 2. Elixir Context: `Castmill.Notifications`

- **Integer ID**: Uses auto-incrementing integer (not UUID) for better performance and smaller indexesLocated in: `packages/castmill/lib/castmill/notifications.ex`

- **Team ID Type**: Teams use integer foreign keys, not binary_ids

- **Indexes**: Only essential indexes (user_id, organization_id, team_id) for optimal write performanceKey functions:

- `create_user_notification/1` - Create notification for a specific user

**Schema Definition**:- `create_organization_notification/1` - Create notification for all users in an organization

```elixir- `create_team_notification/1` - Create notification for all users in a team

schema "notifications" do- `list_user_notifications/2` - List notifications for a user (with pagination)

  field :title_key, :string- `count_unread_notifications/1` - Count unread notifications for a user

  field :description_key, :string- `mark_as_read/1` - Mark a notification as read

  field :link, :string- `mark_all_as_read/1` - Mark all notifications as read for a user

  field :type, :string

  field :read, :boolean, default: false#### 3. Events Module: `Castmill.Notifications.Events`

  field :metadata, :map, default: %{}Located in: `packages/castmill/lib/castmill/notifications/events.ex`

  field :roles, {:array, :string}, default: []

  field :actor_id, :stringHelper functions for common notification events:

  field :actor_type, :string, default: "user"- `notify_organization_invitation/3` - Notify user about organization invitation

- `notify_team_invitation/3` - Notify user about team invitation

  belongs_to :user, User- `notify_device_registration/4` - Notify organization about new device (with optional role filter)

  belongs_to :organization, Organization- `notify_device_removal/2` - Notify organization about device removal

  belongs_to :team, Team, type: :integer  # Teams use integer PKs- `notify_media_transcoded/4` - Notify user when media transcoding completes

- `notify_media_uploaded/5` - Notify user or organization about media upload (with optional role filter)

  timestamps()- `notify_invitation_accepted/3` - Notify organization/team when invitation is accepted

end- `notify_device_offline_alert/5` - Alert about device going offline (with role filter, defaults to admin & device_manager)

```- `notify_device_online_alert/5` - Notify when device comes back online (with role filter)



#### 2. Elixir Context: `Castmill.Notifications`#### 4. Phoenix Channel: `CastmillWeb.NotificationsChannel`

Located in: `packages/castmill/lib/castmill_web/channels/notifications_channel.ex`

**Location**: `packages/castmill/lib/castmill/notifications.ex`

- **Channel Topic**: `notifications:user_id`

**Key functions**:- **Join**: User can only join their own notification channel

- `create_user_notification/1` - Create notification for a specific user- **Events**:

- `create_organization_notification/1` - Create notification for all users in an organization  - `new_notification` (server->client): Pushed when a new notification is created

- `create_team_notification/1` - Create notification for all users in a team  - `mark_read` (client->server): Mark a notification as read

- `list_user_notifications/2` - List notifications for a user (with pagination)  - `mark_all_read` (client->server): Mark all notifications as read

- `count_unread_notifications/1` - Count unread notifications for a user

- `mark_as_read/1` - Mark a notification as read#### 5. REST API Endpoints

- `mark_all_as_read/1` - Mark all notifications as read for a user

**Base Path**: `/api/notifications`

#### 3. Events Module: `Castmill.Notifications.Events`

| Method | Endpoint | Description |

**Location**: `packages/castmill/lib/castmill/notifications/events.ex`|--------|----------|-------------|

| GET | `/notifications` | List notifications for current user (supports pagination) |

Helper functions for common notification events:| GET | `/notifications/unread_count` | Get count of unread notifications |

- `notify_organization_invitation/3` - Notify user about organization invitation| PATCH | `/notifications/:id/read` | Mark a notification as read |

- `notify_team_invitation/3` - Notify user about team invitation| POST | `/notifications/mark_all_read` | Mark all notifications as read |

- `notify_device_registration/4` - Notify organization about new device (with optional role filter)

- `notify_device_removal/2` - Notify organization about device removal**Query Parameters** (for GET /notifications):

- `notify_media_transcoded/4` - Notify user when media transcoding completes- `page` (default: 1): Page number

- `notify_media_uploaded/5` - Notify user or organization about media upload (with optional role filter)- `page_size` (default: 20): Items per page

- `notify_invitation_accepted/3` - Notify organization/team when invitation is accepted

- `notify_device_offline_alert/5` - Alert about device going offline (with role filter, defaults to admin & device_manager)**Response Format**:

- `notify_device_online_alert/5` - Notify when device comes back online (with role filter)```json

{

#### 4. Phoenix Channel: `CastmillWeb.NotificationsChannel`  "data": [

    {

**Location**: `packages/castmill/lib/castmill_web/channels/notifications_channel.ex`      "id": "uuid",

      "title": "Organization Invitation",

- **Channel Topic**: `notifications:user_id`      "description": "You have been invited to join Acme Corp",

- **Join**: User can only join their own notification channel      "link": "/invite-organization",

- **Events**:      "type": "organization_invitation",

  - `new_notification` (server→client): Pushed when a new notification is created      "read": false,

  - `mark_read` (client→server): Mark a notification as read      "metadata": {

  - `mark_all_read` (client→server): Mark all notifications as read        "organization_id": "uuid",

        "organization_name": "Acme Corp"

#### 5. REST API Endpoints      },

      "inserted_at": "2025-10-14T20:00:00Z",

**Base Path**: `/api/notifications`      "updated_at": "2025-10-14T20:00:00Z"

    }

| Method | Endpoint | Description |  ],

|--------|----------|-------------|  "unread_count": 5

| GET | `/notifications` | List notifications for current user (supports pagination) |}

| GET | `/notifications/unread_count` | Get count of unread notifications |```

| PATCH | `/notifications/:id/read` | Mark a notification as read |

| POST | `/notifications/mark_all_read` | Mark all notifications as read |### Frontend Components



**Query Parameters** (for GET /notifications):#### 1. Notification Service

- `page` (default: 1): Page numberLocated in: `packages/dashboard/src/services/notifications.service.ts`

- `page_size` (default: 20): Items per page

Provides API methods:

**Response Format**:- `getNotifications(page, pageSize)` - Fetch notifications with pagination

```json- `getUnreadCount()` - Get unread notification count

{- `markAsRead(notificationId)` - Mark notification as read

  "data": [- `markAllAsRead()` - Mark all notifications as read

    {

      "id": "123456",#### 2. NotificationBell Component

      "title_key": "organizations.notifications.types.organizationInvitation.title",Located in: `packages/dashboard/src/components/notification-bell/`

      "description_key": "organizations.notifications.types.organizationInvitation.description",

      "link": "/invite-organization?token=abc",Features:

      "type": "organization_invitation",- Bell icon in topbar

      "read": false,- Badge showing unread count

      "metadata": {- WebSocket connection for real-time updates

        "organization_name": "Acme Corp"- Toggles NotificationDialog on click

      },

      "inserted_at": "2025-10-14T20:00:00Z",#### 3. NotificationDialog Component

      "updated_at": "2025-10-14T20:00:00Z"Located in: `packages/dashboard/src/components/notification-dialog/`

    }

  ],Features:

  "unread_count": 5- Modal dialog displaying notifications

}- Infinite scroll for pagination

```- Mark individual notification as read on click

- Mark all as read button

### Frontend Components- Navigate to linked resource when notification is clicked

- Real-time updates via WebSocket

#### 1. Notification Service- Localized in 9 languages (en, es, sv, de, fr, zh, ar, ko, ja)



**Location**: `packages/dashboard/src/services/notifications.service.ts`## How to Create Notifications



Provides API methods:### Using the Events Module (Recommended)

- `getNotifications(page, pageSize)` - Fetch notifications with pagination

- `getUnreadCount()` - Get unread notification countThe easiest way to create notifications is using the pre-built event helpers:

- `markAsRead(notificationId)` - Mark notification as read

- `markAllAsRead()` - Mark all notifications as read```elixir

# Organization invitation

#### 2. NotificationBell ComponentCastmill.Notifications.Events.notify_organization_invitation(

  user_id,

**Location**: `packages/dashboard/src/components/notification-bell/`  organization_name,

  organization_id

Features:)

- Bell icon in topbar

- Badge showing unread count# Team invitation

- WebSocket connection for real-time updatesCastmill.Notifications.Events.notify_team_invitation(

- Toggles NotificationDialog on click  user_id,

  team_name,

#### 3. NotificationDialog Component  team_id

)

**Location**: `packages/dashboard/src/components/notification-dialog/`

# Device registration (all users)

Features:Castmill.Notifications.Events.notify_device_registration(

- Modal dialog displaying notifications  device_name,

- Infinite scroll for pagination  device_id,

- Mark individual notification as read on click  organization_id

- Mark all as read button)

- Navigate to linked resource when notification is clicked

- Real-time updates via WebSocket# Device registration (admin and device_manager only)

- Fully localized in 9 languages (en, es, sv, de, fr, zh, ar, ko, ja)Castmill.Notifications.Events.notify_device_registration(

  device_name,

## Translation Keys Approach  device_id,

  organization_id,

**CRITICAL**: All notifications use **translation keys** instead of hardcoded text. This enables full internationalization support across 9 languages.  ["admin", "device_manager"]

)

### How It Works

# Device offline alert (defaults to admin and device_manager)

Each notification stores:Castmill.Notifications.Events.notify_device_offline_alert(

- `title_key`: Key for the notification title (e.g., `"organizations.notifications.types.deviceRegistration.title"`)  device_name,

- `description_key`: Key for the notification description (e.g., `"organizations.notifications.types.deviceRegistration.description"`)  device_id,

- `metadata`: Map containing dynamic values for interpolation (e.g., `%{device_name: "Screen-01"}`)  organization_id,

  ["admin", "device_manager"],  # optional, this is the default

The Dashboard frontend translates these keys client-side using the user's selected language.  %{

    expected_online_time: "09:00",

### Translation Key Structure    last_seen: "2025-10-14T08:45:00Z"

  }

All notification translation keys follow this pattern:)



```# Device back online

organizations.notifications.types.<notificationType>.<field>Castmill.Notifications.Events.notify_device_online_alert(

```  device_name,

  device_id,

**Example**:  organization_id,

```json  ["admin", "device_manager"],

{  3600  # offline duration in seconds

  "organizations": {)

    "notifications": {

      "types": {# Media uploaded - user specific

        "deviceRegistration": {Castmill.Notifications.Events.notify_media_uploaded(

          "title": "New Device Registered",  user_id,

          "description": "{{device_name}} has been registered in {{organization_name}}"  organization_id,

        }  media_name,

      }  media_id

    })

  }

}# Media uploaded - organization wide with role filter

```Castmill.Notifications.Events.notify_media_uploaded(

  nil,  # no specific user

### Metadata Field Usage  organization_id,

  media_name,

The `metadata` field is a flexible JSON map for:  media_id,

1. **Translation interpolation values** (e.g., `{device_name: "Lobby TV", organization_name: "Acme Corp"}`)  ["admin", "editor", "publisher"]  # only these roles see it

2. **Exclusion lists** (e.g., `{excluded_user_ids: ["user-who-triggered-action"]}`))

3. **Type-specific data** (e.g., device capabilities, playlist references)

# Invitation accepted

**Example Metadata**:Castmill.Notifications.Events.notify_invitation_accepted(

  user_name,

**Device Registration:**  organization_id  # or nil

```json  team_id          # or nil

{)

  "device_name": "Lobby Display",```

  "organization_name": "Acme Corp",

  "excluded_user_ids": ["abc-123"]### Creating Custom Notifications

}

```For custom events, use the context functions directly:



**Organization Invitation:**```elixir

```json# User-specific notification

{Castmill.Notifications.create_user_notification(%{

  "organization_name": "Acme Corp",  user_id: user_id,

  "inviter_name": "John Doe",  title: "Custom Event",

  "role": "device_manager"  description: "Something happened",

}  link: "/path/to/resource",

```  type: "custom_event",

  metadata: %{

**Playlist Published:**    custom_field: "value"

```json  }

{})

  "playlist_name": "Summer Campaign 2024",

  "organization_name": "Acme Corp",# Organization-wide notification (all members)

  "published_by": "Jane Smith"Castmill.Notifications.create_organization_notification(%{

}  organization_id: org_id,

```  title: "Organization Event",

  description: "All members should see this",

## How to Create Notifications  type: "org_event"

})

### Using the Events Module (Recommended)

# Organization-wide notification (role-filtered)

The easiest way to create notifications is using the pre-built event helpers:Castmill.Notifications.create_organization_notification(%{

  organization_id: org_id,

```elixir  title: "Admin Alert",

# Organization invitation  description: "Only admins and managers see this",

Castmill.Notifications.Events.notify_organization_invitation(  type: "admin_alert",

  user_id,  roles: ["admin", "manager"]  # Only users with these roles will see it

  organization_name,})

  organization_id

)# Team-wide notification

Castmill.Notifications.create_team_notification(%{

# Team invitation  team_id: team_id,

Castmill.Notifications.Events.notify_team_invitation(  title: "Team Event",

  user_id,  description: "All team members should see this",

  team_name,  type: "team_event"

  team_id})

)```



# Device registration (all users)## Role-Based Filtering

Castmill.Notifications.Events.notify_device_registration(

  device_name,The notification system supports role-based filtering for organization and team notifications. This is crucial for scenarios where only users with specific roles should receive certain notifications.

  device_id,

  organization_id### How It Works

)

1. **No Role Filter (Default)**: If `roles` field is empty or not specified, ALL members of the organization/team receive the notification

# Device registration (admin and device_manager only)2. **With Role Filter**: If `roles` is specified (e.g., `["admin", "device_manager"]`), only members with those roles receive the notification

Castmill.Notifications.Events.notify_device_registration(

  device_name,### Organization Roles

  device_id,

  organization_id,The system recognizes these roles for organizations:

  ["admin", "device_manager"]- `admin` - Organization administrators

)- `manager` - Organization managers

- `member` - Regular members

# Device offline alert (defaults to admin and device_manager)- `editor` - Content editors

Castmill.Notifications.Events.notify_device_offline_alert(- `publisher` - Content publishers

  device_name,- `device_manager` - Device managers

  device_id,- `guest` - Guest users

  organization_id,

  ["admin", "device_manager"],  # optional, this is the default### Use Cases

  %{

    expected_online_time: "09:00",**Device Monitoring & Alerts**

    last_seen: "2025-10-14T08:45:00Z"```elixir

  }# Only admins and device managers get offline alerts

)notify_device_offline_alert(

  "Lobby Display",

# Device back online  device_id,

Castmill.Notifications.Events.notify_device_online_alert(  organization_id,

  device_name,  ["admin", "device_manager"]

  device_id,)

  organization_id,```

  ["admin", "device_manager"],

  3600  # offline duration in seconds**Content Management**

)```elixir

# Only editors and publishers get media upload notifications

# Media uploaded - user specificnotify_media_uploaded(

Castmill.Notifications.Events.notify_media_uploaded(  nil,  # org-wide

  user_id,  organization_id,

  organization_id,  "New Promotional Video",

  media_name,  media_id,

  media_id  ["editor", "publisher"]

))

```

# Media uploaded - organization wide with role filter

Castmill.Notifications.Events.notify_media_uploaded(**Administrative Notifications**

  nil,  # no specific user```elixir

  organization_id,# Only admins and managers get quota warnings

  media_name,create_organization_notification(%{

  media_id,  organization_id: org_id,

  ["admin", "editor", "publisher"]  # only these roles see it  title: "Storage Quota Warning",

)  description: "You've used 90% of your storage quota",

  type: "quota_warning",

# Invitation accepted  roles: ["admin", "manager"]

Castmill.Notifications.Events.notify_invitation_accepted(})

  user_name,```

  organization_id,  # or nil

  team_id           # or nil## Notification Types

)

```Current built-in notification types:

- `organization_invitation` - User invited to organization

### Creating Custom Notifications- `team_invitation` - User invited to team

- `device_registration` - New device registered

For custom events, use the context functions directly:- `device_removal` - Device removed

- `media_transcoded` - Media transcoding completed

```elixir- `media_uploaded` - Media uploaded (user-specific or org-wide)

# User-specific notification- `invitation_accepted` - Invitation was accepted

Castmill.Notifications.create_user_notification(%{- `device_offline_alert` - Device offline alert (monitoring/alerting)

  user_id: user_id,- `device_online_alert` - Device back online notification

  title_key: "organizations.notifications.types.customEvent.title",

  description_key: "organizations.notifications.types.customEvent.description",## Extending the Notification System

  link: "/org/#{org_id}/resource/#{id}",

  type: "custom_event",### Adding New Notification Types

  metadata: %{

    custom_field: "value"1. **Create a helper function** in `Castmill.Notifications.Events`:

  }   ```elixir

})   def notify_custom_event(user_id, details) do

     Notifications.create_user_notification(%{

# Organization-wide notification (all members)       user_id: user_id,

Castmill.Notifications.create_organization_notification(%{       title: "Custom Event Title",

  organization_id: org_id,       description: details,

  title_key: "organizations.notifications.types.orgEvent.title",       type: "custom_event",

  description_key: "organizations.notifications.types.orgEvent.description",       metadata: %{...}

  type: "org_event"     })

})   end

   ```

# Organization-wide notification (role-filtered)

Castmill.Notifications.create_organization_notification(%{2. **Add a notification icon** in the frontend `notification-dialog.tsx`:

  organization_id: org_id,   ```typescript

  title_key: "organizations.notifications.types.adminAlert.title",   const getNotificationIcon = (type: string) => {

  description_key: "organizations.notifications.types.adminAlert.description",     switch (type) {

  type: "admin_alert",       case 'custom_event':

  roles: ["admin", "manager"]  # Only admins and managers see this         return '🎉';

})       // ... other cases

     }

# Team-wide notification (excluding actor)   }

Castmill.Notifications.create_team_notification(%{   ```

  team_id: team_id,

  title_key: "organizations.notifications.types.teamEvent.title",3. **Add translations** if needed in all 9 language files in:

  description_key: "organizations.notifications.types.teamEvent.description",   `packages/dashboard/src/i18n/locales/`

  type: "team_event",

  metadata: %{### Monitoring & Alert System Integration

    user_name: user.name,

    excluded_user_ids: [user_id]  # Don't notify the person who triggered itThe notification system is designed to work seamlessly with monitoring and alerting systems. Here's how to integrate:

  }

})**Device Offline Monitoring**

``````elixir

# In your monitoring service/worker

## Adding New Notification Typesdef check_device_status(device) do

  if device_should_be_online?(device) && !device_is_online?(device) do

### Step-by-Step Guide    # Send alert via multiple channels

    send_email_alert(device)

#### 1. Define Notification Type    send_pagerduty_alert(device)

    

Choose a descriptive type identifier (e.g., `"device_registration"`, `"media_uploaded"`).    # Also create in-app notification

    Castmill.Notifications.Events.notify_device_offline_alert(

#### 2. Add Translation Keys      device.name,

      device.id,

Add translation keys to **all 9 language files** in `packages/dashboard/src/i18n/locales/*.json`:      device.organization_id,

      ["admin", "device_manager"],

```json      %{

{        expected_online_time: device.schedule.start_time,

  "organizations": {        last_seen: device.last_seen_at,

    "notifications": {        severity: "critical"

      "types": {      }

        "yourNotificationType": {    )

          "title": "Your Notification Title",  end

          "description": "Description with {{param1}} and {{param2}}"end

        }```

      }

    }**Multi-Channel Alert Pattern**

  }```elixir

}defmodule MyApp.AlertService do

```  alias Castmill.Notifications.Events



**Languages to update**:  def send_critical_alert(alert_type, organization_id, details) do

- `en.json` (English) - **Required first**    # Send to external systems

- `es.json` (Spanish)    send_email(details)

- `sv.json` (Swedish)    send_pagerduty(details)

- `de.json` (German)    send_slack(details)

- `fr.json` (French)    

- `zh.json` (Chinese)    # Create in-app notification for logged-in users

- `ar.json` (Arabic)    Events.create_organization_notification(%{

- `ko.json` (Korean)      organization_id: organization_id,

- `ja.json` (Japanese)      title: details.title,

      description: details.description,

**Use the translation helper**:      type: alert_type,

```bash      roles: ["admin", "manager"],

cd packages/dashboard      metadata: %{

node scripts/i18n/translation-helper.cjs add "organizations.notifications.types.yourType.title" "Your Title"        severity: "critical",

```        alert_source: "monitoring_system",

        timestamp: DateTime.utc_now()

This adds the key to all 9 files (non-English will be marked `[TODO: Translate]`).      }

    })

#### 3. Create Helper Function  end

end

Add a helper function in `lib/castmill/notifications/events.ex`:```



```elixir**Alert Severity Levels**

@doc """Use metadata to indicate severity:

Notifies when [describe the event].```elixir

metadata: %{

## Parameters  severity: "critical",  # or "warning", "info"

  - param1: Description  alert_type: "device_offline",

  - param2: Description  requires_action: true

  - user_id/organization_id/team_id: Recipient scope}

  - actor_id: ID of who/what triggered this (optional)```

  - actor_type: Type of actor - "user", "device", "system", etc. (optional)

"""### Plugin Integration

def notify_your_event(param1, param2, organization_id, actor_id \\ nil, actor_type \\ "user") do

  Notifications.create_organization_notification(%{Plugins can create notifications by calling the Events module or context functions:

    organization_id: organization_id,

    title_key: "organizations.notifications.types.yourNotificationType.title",```elixir

    description_key: "organizations.notifications.types.yourNotificationType.description",# In your plugin code

    type: "your_notification_type",alias Castmill.Notifications

    link: "/org/#{organization_id}/some-resource/#{param1}",  # Optional

    actor_id: actor_id,# Send notification to user

    actor_type: actor_type,Notifications.create_user_notification(%{

    metadata: %{  user_id: user_id,

      param1: param1,  title: "Plugin Event",

      param2: param2  description: "Your plugin action completed",

    }  link: "/plugin/path",

  })  type: "plugin_event",

end  metadata: %{

```    plugin_name: "my_plugin",

    action: "completed"

#### 4. Call the Helper Function  }

})

Invoke the helper function at the appropriate place in your business logic:```



```elixir## Real-time Updates

# In your context module (e.g., Devices, Media, Teams)

def some_action(params) doThe system uses Phoenix Channels for real-time notifications:

  # ... perform action ...

  1. **Server-side**: When a notification is created, it's broadcast via PubSub

  # Send notification2. **Client-side**: WebSocket connection receives the notification

  Castmill.Notifications.Events.notify_your_event(3. **UI Update**: Bell badge and notification list update automatically

    param1,

    param2,## Testing

    organization_id

  )Test files should be added in:

  - Backend: `packages/castmill/test/castmill/notifications_test.exs`

  {:ok, result}- Backend: `packages/castmill/test/castmill_web/controllers/notifications_test.exs`

end- Frontend: `packages/dashboard/src/components/notification-bell/notification-bell.test.tsx`

```

## Migration

#### 5. Add Frontend Icon (Optional)

To apply the notification system schema:

Update `packages/dashboard/src/components/notification-dialog/notification-dialog.tsx`:

```bash

```tsxcd packages/castmill

const getNotificationIcon = (type: string): string => {mix ecto.migrate

  const icons: Record<string, string> = {```

    // ... existing icons ...

    your_notification_type: '🔔',  // Choose appropriate emoji## Security Considerations

  };

  return icons[type] || '📢';- Users can only access their own notifications

};- Organization/team notifications are only visible to members

```- WebSocket channel authentication is enforced

- All API endpoints require authentication

## Actor Tracking

All notifications can track **who or what triggered the notification** using the `actor_id` and `actor_type` fields.

### Actor Types

- **`"user"`**: A user triggered the event (e.g., user invited someone, user removed a member)
- **`"device"`**: A device triggered the event (e.g., device went offline, device registered)
- **`"system"`**: System/automated event (e.g., media transcoding completed, scheduled maintenance)
- **`"integration"`**: External integration triggered the event (e.g., Slack webhook, API call)
- **`"scheduler"`**: Scheduled job/cron triggered the event

### When to Use Actor Tracking

**Always set actor information when available**:

```elixir
# User-triggered notification
notify_invitation_accepted(
  user.name,
  user.id,              # This user is excluded from receiving the notification
  organization_id,
  nil,
  user.id,              # actor_id: Who performed the action
  "user"                # actor_type
)

# Device-triggered notification  
notify_device_offline_alert(
  device.name,
  device.id,            # actor_id: The device that went offline
  organization_id
)
# Helper automatically sets actor_type: "device"

# System-triggered notification
notify_media_transcoded(
  user.id,
  media.name,
  media.id,
  organization_id
)
# Helper automatically sets actor_type: "system"
```

**Actor Tracking Best Practices**:
- **User-triggered events**: Pass `actor_id: user.id, actor_type: "user"`
- **Device events**: Pass `actor_id: device.id, actor_type: "device"`
- **System/automated events**: Pass `actor_type: "system"` (no actor_id needed)
- **Integration events**: Pass `actor_id: integration_name, actor_type: "integration"`
- **Scheduled jobs**: Pass `actor_id: job_id, actor_type: "scheduler"`

### Future Uses of Actor Data

Actor tracking enables:

1. **Rich UI Display**
   - Show user avatars: "**John Smith** invited you to the team"
   - Show device icons: "Device **Screen-01** went offline"
   
2. **Filtering and Search**
   - "Show me all notifications from user X"
   - "Show me all device alerts"
   
3. **Analytics**
   - Which users generate most notifications?
   - Which devices have most alerts?
   
4. **User Preferences**
   - "Mute notifications from this user"
   - "Only show critical device alerts"
   
5. **Audit Trails**
   - Complete history of who triggered what events

## Best Practices & Gotchas

### 1. Translation Keys Path

Always use the full path starting with `organizations.notifications.types`:

```elixir
# ✅ Correct
title_key: "organizations.notifications.types.deviceRegistration.title"

# ❌ Wrong
title_key: "notifications.types.deviceRegistration.title"
title_key: "deviceRegistration.title"
```

### 2. Team ID Type Mismatch

Teams use **integer** primary keys, while notifications use binary IDs by default. When defining the relationship:

```elixir
# In notification.ex schema
belongs_to :team, Castmill.Teams.Team, type: :integer  # Must specify :integer
```

### 3. Excluding Users from Notifications

If a user triggers an action (e.g., accepting an invitation), they should **not** receive a notification about their own action:

```elixir
# Store excluded user IDs in metadata
metadata: %{
  user_name: user.name,
  excluded_user_ids: [user_id]  # User who performed the action
}
```

The filtering logic automatically excludes these users.

### 4. Role-Based Filtering

Use the `roles` field to restrict notifications to specific roles:

```elixir
Notifications.create_organization_notification(%{
  organization_id: org_id,
  # ... other fields ...
  roles: ["admin", "manager"]  # Only admins and managers will see this
})
```

Leave `roles` empty (`[]`) for no restrictions.

### 5. Link Format

Links should follow the Dashboard's URL-based routing pattern:

```elixir
# ✅ Correct - includes organization context
link: "/org/#{organization_id}/devices/#{device_id}"
link: "/org/#{organization_id}/teams"

# ⚠️ Exception - standalone routes (no org prefix)
link: "/invite-organization?token=#{token}"
link: "/invite?token=#{token}"
```

Standalone routes are defined in `notification-dialog.tsx` and exclude org prefix.

### 6. Metadata Parameters

Metadata should contain:
- **Interpolation values**: Data to fill in `{{param}}` placeholders
- **Special fields**: `excluded_user_ids` for user exclusion
- **Keep it simple**: Don't store complex objects, just strings/numbers/arrays

```elixir
# ✅ Good
metadata: %{
  device_name: "Screen-01",
  user_name: "John Doe",
  excluded_user_ids: [user_id]
}

# ❌ Avoid
metadata: %{
  device: %Device{...},  # Don't store full structs
  complex_nested: %{...} # Keep it flat
}
```

### 7. Translation Validation

Always validate translations before committing:

```bash
cd packages/dashboard
yarn check-translations  # Checks all languages are 100% complete
```

CI will fail if any translations are missing.

### 8. WebSocket Broadcasting

Notifications are automatically broadcast via WebSocket when created. The `broadcast_notification/1` function is called automatically by `create_*_notification` functions.

Users subscribe to:
- `"notifications:#{user_id}"` - Personal channel
- `"organization:#{org_id}"` - Organization events (handled separately)

## Real-Time Delivery

### WebSocket Channel

Users connect to `"notifications:#{user_id}"` channel on login.

### Broadcasting

```elixir
# Automatic broadcast after notification creation
{:ok, notification} = Notifications.create_user_notification(attrs)
# -> Broadcasts to "notifications:#{user_id}"
```

### Frontend Subscription

The Dashboard automatically:
1. Connects to the notifications channel on login
2. Listens for `"new_notification"` events
3. Updates the notification badge count
4. Displays notifications in the dropdown

## Filtering Logic

Notifications are filtered on **read** (not write) for efficiency:

1. Query fetches all potentially relevant notifications
2. Application-level filtering applies:
   - **Role-based**: Check if user's role matches `notification.roles`
   - **Exclusion**: Check if user is in `metadata.excluded_user_ids`

This approach allows one notification record to be shown to multiple users with different filtering rules.

## Common Notification Patterns

### Device Event
```elixir
Notifications.create_organization_notification(%{
  organization_id: device.organization_id,
  title_key: "organizations.notifications.types.deviceRegistration.title",
  description_key: "organizations.notifications.types.deviceRegistration.description",
  type: "device_registration",
  link: "/org/#{device.organization_id}/devices/#{device.id}",
  metadata: %{device_name: device.name}
})
```

### User Invitation
```elixir
Notifications.create_user_notification(%{
  user_id: user_id,
  title_key: "organizations.notifications.types.organizationInvitation.title",
  description_key: "organizations.notifications.types.organizationInvitation.description",
  type: "organization_invitation",
  link: "/invite-organization?token=#{token}",
  metadata: %{organization_name: org.name}
})
```

### Team Event (Excluding Actor)
```elixir
Notifications.create_team_notification(%{
  team_id: team_id,
  title_key: "organizations.notifications.types.invitationAccepted.title",
  description_key: "organizations.notifications.types.invitationAccepted.descriptionTeam",
  type: "invitation_accepted",
  metadata: %{
    user_name: user.name,
    excluded_user_ids: [user_id]  # Don't notify the person who just joined
  }
})
```

## Debugging

### Check Notification Creation
```elixir
# In IEx
alias Castmill.Notifications

# List recent notifications for a user
Notifications.list_user_notifications(user_id, page: 1, page_size: 10)

# Count unread
Notifications.count_unread_notifications(user_id)

# Get notification details
Notifications.get_notification(notification_id)
```

### Check WebSocket Delivery
```bash
# Watch Phoenix logs
tail -f /tmp/phoenix.log | grep notification

# Or add debug logging
IO.inspect(notification, label: "Created notification")
```

### Validate Translations
```bash
cd packages/dashboard

# Check for hardcoded strings
yarn check-i18n

# Check translation completeness
yarn check-translations

# Check specific language
node scripts/check-missing-translations.cjs es
```

## Testing

See `test/castmill/notifications_test.exs` for comprehensive examples of:
- Creating different notification types
- Role-based filtering
- User exclusion
- Translation key validation

## Migration Notes

### From Hardcoded Strings to Translation Keys

The system previously used `title` and `description` fields with hardcoded text. This was migrated to `title_key` and `description_key` with client-side translation.

**Migration completed**: Removed `title` and `description` columns from the database schema.

### From UUID to Integer IDs

The system was migrated from UUID primary keys to auto-incrementing integers for better performance:
- Smaller index sizes
- Faster joins
- Better sequential access patterns

## Future Improvements

- [ ] Add notification preferences (allow users to mute certain types)
- [ ] Add email digest for unread notifications
- [ ] Add notification grouping (e.g., "3 devices registered")
- [ ] Add notification actions (e.g., "Approve", "Reject" buttons)
- [ ] Add push notifications for mobile apps
- [ ] Add notification templates for easier creation
- [ ] Add notification analytics dashboard
