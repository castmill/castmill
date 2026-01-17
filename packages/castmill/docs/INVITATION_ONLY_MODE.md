# Invitation-Only Mode for Networks

## Overview

The invitation-only mode feature allows network administrators to control user signups through a centralized invitation system. When enabled, only users who have received an explicit invitation can sign up to the Castmill dashboard.

## Features

### Network-Level Settings

Network administrators can configure two settings via the LiveView admin tool:

1. **Invitation Only Mode** - When enabled, blocks all signups that don't have a valid invitation token
2. **Allow Organization Admins to Invite** - When enabled, organization admins can invite users to their organizations (in addition to network admins)

### Network Invitations

Network admins can invite users to create new organizations through the LiveView admin interface:

1. Navigate to the Network details page
2. Select the "Invitations" tab
3. Click "New Invitation"
4. Enter the user's email and the name for the new organization
5. The system generates a unique invitation token

When the invited user signs up:
- A new organization is automatically created with the specified name
- The user becomes the admin of that organization
- The user can then invite other members to their organization from the dashboard

### Organization Invitations

Organization admins can continue to invite users to their existing organizations from the dashboard (this existing functionality is not changed).

## Technical Implementation

### Database Schema

#### Networks Table Updates
```sql
ALTER TABLE networks ADD COLUMN invitation_only BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE networks ADD COLUMN invitation_only_org_admins BOOLEAN DEFAULT FALSE NOT NULL;
```

#### Network Invitations Table
```sql
CREATE TABLE network_invitations (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  token VARCHAR NOT NULL UNIQUE,
  organization_name VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'invited' NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  inserted_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX ON network_invitations (network_id, email) WHERE status = 'invited';
```

### API Endpoints

#### Network Invitation Management (LiveView Admin)
- Admin interface provides CRUD operations for network invitations
- Invitations can be viewed, created, and deleted via the Invitations tab

#### Public Preview (No Auth Required)
```
GET /dashboard/network_invitations/:token/preview
```
Returns invitation details including email, organization name, and expiration status.

#### Authenticated Endpoints
```
GET /dashboard/network_invitations/:token
POST /dashboard/network_invitations/:token/accept
POST /dashboard/network_invitations/:token/reject
```

#### Signup Flow Changes
```
POST /signups/
```
- Now validates `invitation_only` mode
- Blocks signups without valid invitations when mode is enabled

```
POST /signups/challenges
```
- Validates invitation tokens for invited users
- Checks both network and organization invitations

### User Flow

#### For Network Admins:
1. Enable "Invitation Only" mode in Network settings
2. Navigate to the Invitations tab
3. Create invitations with email and organization name
4. Share invitation link/token with users

#### For Invited Users:
1. Receive invitation (currently manual - future: email with link)
2. Navigate to signup page with invitation token
3. Complete passkey registration
4. Automatically get new organization created
5. Become admin of the new organization
6. Can now invite other users to their organization

## Configuration

### Enabling Invitation-Only Mode

In the LiveView admin tool:
1. Navigate to Networks
2. Select a network
3. Click "Edit Network"
4. Enable "Invitation Only Mode"
5. Optionally enable "Allow Organization Admins to Invite"
6. Save

### Security Considerations

- Invitation tokens are cryptographically secure (32 random bytes, base64-encoded)
- Tokens expire after 7 days by default
- Email validation ensures invitations are only accepted by the correct user
- Status tracking prevents invitation reuse
- Unique constraints prevent duplicate invitations for the same email

## Testing

Comprehensive test coverage includes:
- Network-level invitation-only mode validation
- Network invitation CRUD operations
- Signup flow with and without invitations
- Token validation and expiration
- Duplicate invitation prevention

Run tests:
```bash
cd packages/castmill
mix test test/castmill/networks_test.exs
mix test test/castmill_web/controllers/signup_controller_test.exs
```

## Future Enhancements

- Email notifications for invitations
- Customizable invitation email templates
- Invitation link generation in admin UI
- Bulk invitation import
- Invitation analytics and tracking
- Configurable expiration times
