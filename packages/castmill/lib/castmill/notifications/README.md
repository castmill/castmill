# Castmill Notification System

## Overview

The Castmill notification system provides real-time notifications to users about important events in the platform. Notifications are delivered via WebSocket (Phoenix Channels) and displayed in the Dashboard UI.

## Architecture

### Components

1. **Notification Schema** (`notification.ex`) - Defines the notification data structure
2. **Notifications Context** (`notifications.ex`) - Handles CRUD operations and filtering
3. **Events Module** (`events.ex`) - Helper functions for creating notifications for specific events
4. **WebSocket Channel** (`notifications_channel.ex`) - Real-time delivery via Phoenix Channels
5. **Frontend Components** (Dashboard) - Display and interaction UI

### Notification Types

Notifications can be scoped to three different audiences:

- **User-specific**: Sent to a single user (`user_id`)
- **Organization-wide**: Sent to all members of an organization (`organization_id`)
- **Team-wide**: Sent to all members of a team (`team_id`)

### Translation Keys Approach

**CRITICAL**: All notifications use **translation keys** instead of hardcoded text. This enables full internationalization support across 9 languages.

Each notification stores:
- `title_key`: Key for the notification title (e.g., `"organizations.notifications.types.deviceRegistration.title"`)
- `description_key`: Key for the notification description (e.g., `"organizations.notifications.types.deviceRegistration.description"`)
- `metadata`: Map containing dynamic values for interpolation (e.g., `%{device_name: "Screen-01"}`)

The Dashboard frontend translates these keys client-side using the user's selected language.

## Database Schema

```elixir
schema "notifications" do
  field :title_key, :string          # Translation key for title
  field :description_key, :string    # Translation key for description
  field :link, :string                # Optional link (e.g., "/org/:orgId/devices/:id")
  field :type, :string                # Notification type identifier
  field :read, :boolean, default: false
  field :metadata, :map, default: %{} # Dynamic data for interpolation + excluded_user_ids
  field :roles, {:array, :string}, default: []  # Optional role-based filtering

  # Actor tracking (who/what triggered this notification)
  field :actor_id, :string            # ID of the actor (user ID, device ID, etc.)
  field :actor_type, :string          # Type: "user", "device", "system", "integration", etc.

  belongs_to :user, User
  belongs_to :organization, Organization
  belongs_to :team, Team, type: :integer  # Note: Team uses integer IDs

  timestamps()
end
```

### Important Schema Details

- **Primary key**: Binary ID (UUID) for notifications
- **Foreign keys**: Binary IDs for user/organization, **integer** for team (teams use integer PKs)
- **Metadata field**: Stores both interpolation parameters AND special fields like `excluded_user_ids`
- **Actor tracking**: `actor_id` and `actor_type` record who/what triggered the notification (user, device, system, etc.)

## Adding New Notifications

### Step-by-Step Guide

#### 1. Define Notification Type

Choose a descriptive type identifier (e.g., `"device_registration"`, `"media_uploaded"`).

#### 2. Add Translation Keys

Add translation keys to all 9 language files in `packages/dashboard/src/i18n/locales/*.json`:

```json
{
  "organizations": {
    "notifications": {
      "types": {
        "yourNotificationType": {
          "title": "Your Notification Title",
          "description": "Description with {{param1}} and {{param2}}"
        }
      }
    }
  }
}
```

**Languages to update**:
- `en.json` (English) - Required first
- `es.json` (Spanish)
- `sv.json` (Swedish)
- `de.json` (German)
- `fr.json` (French)
- `zh.json` (Chinese)
- `ar.json` (Arabic)
- `ko.json` (Korean)
- `ja.json` (Japanese)

**Use the translation helper**:
```bash
cd packages/dashboard
node scripts/i18n/translation-helper.cjs add "organizations.notifications.types.yourType.title" "Your Title"
```

This adds the key to all 9 files (non-English will be marked `[TODO: Translate]`).

#### 3. Create Helper Function

Add a helper function in `lib/castmill/notifications/events.ex`:

```elixir
@doc """
Notifies when [describe the event].

## Parameters
  - param1: Description
  - param2: Description
  - user_id/organization_id/team_id: Recipient scope
  - actor_id: ID of who/what triggered this (optional)
  - actor_type: Type of actor - "user", "device", "system", etc. (optional)
"""
def notify_your_event(param1, param2, organization_id, actor_id \\ nil, actor_type \\ "user") do
  Notifications.create_organization_notification(%{
    organization_id: organization_id,
    title_key: "organizations.notifications.types.yourNotificationType.title",
    description_key: "organizations.notifications.types.yourNotificationType.description",
    type: "your_notification_type",
    link: "/org/#{organization_id}/some-resource/#{param1}",  # Optional
    actor_id: actor_id,
    actor_type: actor_type,
    metadata: %{
      param1: param1,
      param2: param2
    }
  })
end
```

**Actor Tracking Best Practices**:
- **User-triggered events**: Pass `actor_id: user.id, actor_type: "user"`
- **Device events**: Pass `actor_id: device.id, actor_type: "device"`
- **System/automated events**: Pass `actor_type: "system"` (no actor_id needed)
- **Integration events**: Pass `actor_id: integration_name, actor_type: "integration"`
- **Scheduled jobs**: Pass `actor_id: job_id, actor_type: "scheduler"`

This enables future features like:
- User avatars in notifications ("John added you to the team")
- Filtering by actor ("Show me all notifications from devices")
- Analytics (which users/devices generate most notifications)
- Audit trails

#### 4. Call the Helper Function

Invoke the helper function at the appropriate place in your business logic:

```elixir
# In your context module (e.g., Devices, Media, Teams)
def some_action(params) do
  # ... perform action ...
  
  # Send notification
  Castmill.Notifications.Events.notify_your_event(
    param1,
    param2,
    organization_id
  )
  
  {:ok, result}
end
```

#### 5. Add Frontend Icon (Optional)

Update `packages/dashboard/src/components/notification-dialog/notification-dialog.tsx`:

```tsx
const getNotificationIcon = (type: string): string => {
  const icons: Record<string, string> = {
    // ... existing icons ...
    your_notification_type: '🔔',  // Choose appropriate emoji
  };
  return icons[type] || '📢';
};
```

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

### Gotchas and Best Practices

#### 1. **Translation Keys Path**

Always use the full path starting with `organizations.notifications.types`:

```elixir
# ✅ Correct
title_key: "organizations.notifications.types.deviceRegistration.title"

# ❌ Wrong
title_key: "notifications.types.deviceRegistration.title"
title_key: "deviceRegistration.title"
```

#### 2. **Team ID Type Mismatch**

Teams use **integer** primary keys, while notifications use binary IDs by default. When defining the relationship:

```elixir
# In notification.ex schema
belongs_to :team, Castmill.Teams.Team, type: :integer  # Must specify :integer
```

#### 3. **Excluding Users from Notifications**

If a user triggers an action (e.g., accepting an invitation), they should **not** receive a notification about their own action:

```elixir
# Store excluded user IDs in metadata
metadata: %{
  user_name: user.name,
  excluded_user_ids: [user_id]  # User who performed the action
}
```

The filtering logic automatically excludes these users.

#### 4. **Role-Based Filtering**

Use the `roles` field to restrict notifications to specific roles:

```elixir
Notifications.create_organization_notification(%{
  organization_id: org_id,
  # ... other fields ...
  roles: ["admin", "manager"]  # Only admins and managers will see this
})
```

Leave `roles` empty (`[]`) for no restrictions.

#### 5. **Link Format**

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

#### 6. **Metadata Parameters**

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

#### 7. **Notification Types with Variants**

For related notifications with different messages (e.g., for different audiences):

```elixir
# Option 1: Different description keys
def notify_team_member_removed(user_name, team_name, team_id, removed_user_id) do
  # Notification to removed user
  Notifications.create_user_notification(%{
    user_id: removed_user_id,
    title_key: "...teamMemberRemoved.titleSelf",
    description_key: "...teamMemberRemoved.descriptionSelf",
    # ...
  })
  
  # Notification to other team members
  Notifications.create_team_notification(%{
    team_id: team_id,
    title_key: "...teamMemberRemoved.titleOthers",
    description_key: "...teamMemberRemoved.descriptionOthers",
    metadata: %{excluded_user_ids: [removed_user_id]},
    # ...
  })
end
```

#### 8. **Translation Validation**

Always validate translations before committing:

```bash
cd packages/dashboard
yarn check-translations  # Checks all languages are 100% complete
```

CI will fail if any translations are missing.

#### 9. **WebSocket Broadcasting**

Notifications are automatically broadcast via WebSocket when created. The `broadcast_notification/1` function is called automatically by `create_*_notification` functions.

Users subscribe to:
- `"notifications:#{user_id}"` - Personal channel
- `"organization:#{org_id}"` - Organization events (handled separately)

#### 10. **Testing Notifications**

See `test/castmill/notifications_test.exs` for comprehensive examples of:
- Creating different notification types
- Role-based filtering
- User exclusion
- Translation key validation

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

## Migration Notes

### From Hardcoded Strings to Translation Keys

The system previously used `title` and `description` fields with hardcoded text. This was migrated to `title_key` and `description_key` with client-side translation.

**Migration completed**: Removed `title` and `description` columns from the database schema.

## Future Improvements

- [ ] Add notification preferences (allow users to mute certain types)
- [ ] Add email digest for unread notifications
- [ ] Add notification grouping (e.g., "3 devices registered")
- [ ] Add notification actions (e.g., "Approve", "Reject" buttons)
- [ ] Add push notifications for mobile apps
- [ ] Add notification templates for easier creation
