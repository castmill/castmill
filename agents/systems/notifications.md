# Notification System

The Castmill Notification System provides real-time notifications to users about important events in the platform, such as invitations, device registrations, and more.

## Architecture

### Backend Components

#### 1. Database Schema
- **Table**: `notifications`
- **Fields**:
  - `id` (binary_id): Primary key
  - `title` (string): Notification title
  - `description` (text): Optional detailed description
  - `link` (string): Optional link to related resource
  - `type` (string): Notification type (e.g., "organization_invitation", "device_registration")
  - `read` (boolean): Whether the notification has been read
  - `user_id` (binary_id): Foreign key to users (for user-specific notifications)
  - `organization_id` (binary_id): Foreign key to organizations (for org-wide notifications)
  - `team_id` (binary_id): Foreign key to teams (for team-wide notifications)
  - `metadata` (map): Extensible JSON field for custom event data
  - `inserted_at`, `updated_at`: Timestamps

#### 2. Elixir Context: `Castmill.Notifications`
Located in: `packages/castmill/lib/castmill/notifications.ex`

Key functions:
- `create_user_notification/1` - Create notification for a specific user
- `create_organization_notification/1` - Create notification for all users in an organization
- `create_team_notification/1` - Create notification for all users in a team
- `list_user_notifications/2` - List notifications for a user (with pagination)
- `count_unread_notifications/1` - Count unread notifications for a user
- `mark_as_read/1` - Mark a notification as read
- `mark_all_as_read/1` - Mark all notifications as read for a user

#### 3. Events Module: `Castmill.Notifications.Events`
Located in: `packages/castmill/lib/castmill/notifications/events.ex`

Helper functions for common notification events:
- `notify_organization_invitation/3` - Notify user about organization invitation
- `notify_team_invitation/3` - Notify user about team invitation
- `notify_device_registration/3` - Notify organization about new device
- `notify_device_removal/2` - Notify organization about device removal
- `notify_media_transcoded/4` - Notify user when media transcoding completes
- `notify_invitation_accepted/3` - Notify organization/team when invitation is accepted

#### 4. Phoenix Channel: `CastmillWeb.NotificationsChannel`
Located in: `packages/castmill/lib/castmill_web/channels/notifications_channel.ex`

- **Channel Topic**: `notifications:user_id`
- **Join**: User can only join their own notification channel
- **Events**:
  - `new_notification` (server->client): Pushed when a new notification is created
  - `mark_read` (client->server): Mark a notification as read
  - `mark_all_read` (client->server): Mark all notifications as read

#### 5. REST API Endpoints

**Base Path**: `/api/notifications`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications for current user (supports pagination) |
| GET | `/notifications/unread_count` | Get count of unread notifications |
| PATCH | `/notifications/:id/read` | Mark a notification as read |
| POST | `/notifications/mark_all_read` | Mark all notifications as read |

**Query Parameters** (for GET /notifications):
- `page` (default: 1): Page number
- `page_size` (default: 20): Items per page

**Response Format**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Organization Invitation",
      "description": "You have been invited to join Acme Corp",
      "link": "/invite-organization",
      "type": "organization_invitation",
      "read": false,
      "metadata": {
        "organization_id": "uuid",
        "organization_name": "Acme Corp"
      },
      "inserted_at": "2025-10-14T20:00:00Z",
      "updated_at": "2025-10-14T20:00:00Z"
    }
  ],
  "unread_count": 5
}
```

### Frontend Components

#### 1. Notification Service
Located in: `packages/dashboard/src/services/notifications.service.ts`

Provides API methods:
- `getNotifications(page, pageSize)` - Fetch notifications with pagination
- `getUnreadCount()` - Get unread notification count
- `markAsRead(notificationId)` - Mark notification as read
- `markAllAsRead()` - Mark all notifications as read

#### 2. NotificationBell Component
Located in: `packages/dashboard/src/components/notification-bell/`

Features:
- Bell icon in topbar
- Badge showing unread count
- WebSocket connection for real-time updates
- Toggles NotificationDialog on click

#### 3. NotificationDialog Component
Located in: `packages/dashboard/src/components/notification-dialog/`

Features:
- Modal dialog displaying notifications
- Infinite scroll for pagination
- Mark individual notification as read on click
- Mark all as read button
- Navigate to linked resource when notification is clicked
- Real-time updates via WebSocket
- Localized in 9 languages (en, es, sv, de, fr, zh, ar, ko, ja)

## How to Create Notifications

### Using the Events Module (Recommended)

The easiest way to create notifications is using the pre-built event helpers:

```elixir
# Organization invitation
Castmill.Notifications.Events.notify_organization_invitation(
  user_id,
  organization_name,
  organization_id
)

# Team invitation
Castmill.Notifications.Events.notify_team_invitation(
  user_id,
  team_name,
  team_id
)

# Device registration
Castmill.Notifications.Events.notify_device_registration(
  device_name,
  device_id,
  organization_id
)

# Invitation accepted
Castmill.Notifications.Events.notify_invitation_accepted(
  user_name,
  organization_id  # or nil
  team_id          # or nil
)
```

### Creating Custom Notifications

For custom events, use the context functions directly:

```elixir
# User-specific notification
Castmill.Notifications.create_user_notification(%{
  user_id: user_id,
  title: "Custom Event",
  description: "Something happened",
  link: "/path/to/resource",
  type: "custom_event",
  metadata: %{
    custom_field: "value"
  }
})

# Organization-wide notification
Castmill.Notifications.create_organization_notification(%{
  organization_id: org_id,
  title: "Organization Event",
  description: "All members should see this",
  type: "org_event"
})

# Team-wide notification
Castmill.Notifications.create_team_notification(%{
  team_id: team_id,
  title: "Team Event",
  description: "All team members should see this",
  type: "team_event"
})
```

## Notification Types

Current built-in notification types:
- `organization_invitation` - User invited to organization
- `team_invitation` - User invited to team
- `device_registration` - New device registered
- `device_removal` - Device removed
- `media_transcoded` - Media transcoding completed
- `invitation_accepted` - Invitation was accepted

## Extending the Notification System

### Adding New Notification Types

1. **Create a helper function** in `Castmill.Notifications.Events`:
   ```elixir
   def notify_custom_event(user_id, details) do
     Notifications.create_user_notification(%{
       user_id: user_id,
       title: "Custom Event Title",
       description: details,
       type: "custom_event",
       metadata: %{...}
     })
   end
   ```

2. **Add a notification icon** in the frontend `notification-dialog.tsx`:
   ```typescript
   const getNotificationIcon = (type: string) => {
     switch (type) {
       case 'custom_event':
         return '🎉';
       // ... other cases
     }
   }
   ```

3. **Add translations** if needed in all 9 language files in:
   `packages/dashboard/src/i18n/locales/`

### Plugin Integration

Plugins can create notifications by calling the Events module or context functions:

```elixir
# In your plugin code
alias Castmill.Notifications

# Send notification to user
Notifications.create_user_notification(%{
  user_id: user_id,
  title: "Plugin Event",
  description: "Your plugin action completed",
  link: "/plugin/path",
  type: "plugin_event",
  metadata: %{
    plugin_name: "my_plugin",
    action: "completed"
  }
})
```

## Real-time Updates

The system uses Phoenix Channels for real-time notifications:

1. **Server-side**: When a notification is created, it's broadcast via PubSub
2. **Client-side**: WebSocket connection receives the notification
3. **UI Update**: Bell badge and notification list update automatically

## Testing

Test files should be added in:
- Backend: `packages/castmill/test/castmill/notifications_test.exs`
- Backend: `packages/castmill/test/castmill_web/controllers/notifications_test.exs`
- Frontend: `packages/dashboard/src/components/notification-bell/notification-bell.test.tsx`

## Migration

To apply the notification system schema:

```bash
cd packages/castmill
mix ecto.migrate
```

## Security Considerations

- Users can only access their own notifications
- Organization/team notifications are only visible to members
- WebSocket channel authentication is enforced
- All API endpoints require authentication
