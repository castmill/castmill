# WebSocket Authentication and Security

This document describes the authentication and security measures implemented for WebSocket connections in the Castmill platform.

## Overview

The Castmill platform uses WebSockets for real-time communication between:
- **Devices** (digital signage players) and the backend
- **Dashboard users** (via RC window) and devices for remote control

Each connection type has specific authentication requirements and security measures.

## Socket Types

### 1. DeviceSocket (`/socket/device`)

**Purpose**: Handles device connections for status updates and command reception.

**Authentication**:
- Device identity is passed at socket connection (device_id, hardware_id)
- **Token validation occurs at channel join**, not socket connect
- Uses device tokens with Argon2 password hashing

**Channels**:
- `devices:#{device_id}` - Main device communication channel
- `register:*` - Device registration channel

**Security Features**:
- Device tokens are hashed using Argon2 (secure, memory-hard algorithm)
- Token validation required before channel join
- IP address tracking for device connections
- Heartbeat mechanism to detect disconnections

### 2. RcSocket (`/socket/rc`)

**Purpose**: Handles remote control WebSocket connections for both devices and dashboard users.

**Authentication**:
- **Dashboard users**: Must authenticate with Phoenix.Token at socket connection
- **Devices**: Authenticate with device token at channel join

**User Authentication Flow** (Dashboard):
1. User logs in via web interface
2. Backend generates Phoenix.Token (signed, time-limited, 24h expiration)
3. Client includes token in WebSocket connection params
4. RcSocket verifies token using `Phoenix.Token.verify/4`
5. User object is assigned to socket for use in channels

**Device Authentication Flow**:
1. Device connects without token at socket level
2. Device provides device token when joining channel
3. Channel validates device token using `Devices.verify_device_token/2`

**Channels**:
- `device_rc:#{device_id}` - Device side of remote control
- `device_media:#{device_id}:#{session_id}` - Media streaming from device
- `rc_window:#{session_id}` - Dashboard RC window (requires device_manager role)

**Security Features**:
- Phoenix.Token for user authentication (cryptographically signed)
- 24-hour token expiration
- Role-based access control (device_manager role required)
- Session ownership validation
- Device token validation for device channels

### 3. UserSocket (`/socket/user`)

**Purpose**: Handles user connections for real-time updates in the dashboard.

**Authentication**:
- Requires Phoenix.Token authentication at socket connection
- Same token mechanism as RcSocket

**Channels**:
- `device_updates:*` - Real-time device status updates
- `resource:*` - Resource update notifications
- `users:*` - User-specific notifications
- `notifications:*` - General notification channel

**Security Features**:
- Phoenix.Token verification
- User object attached to socket for channel authorization

## Role-Based Access Control

### Remote Control Permissions

The `rc_window` channel enforces role-based access control:

**Required Roles** (one of):
- `admin` - Full access to all features
- `manager` - Organization-level management
- `device_manager` - Can manage and remotely control devices

**Insufficient Roles**:
- `viewer` - Read-only access, cannot use remote control
- Other custom roles without device management privileges

**Permission Check**:
```elixir
defp has_rc_permission?(role) do
  role in [:device_manager, :manager, :admin]
end
```

## Session Management

### RC Session Security

**Session ID Generation**:
- Uses Ecto UUID (version 4) for session IDs
- Cryptographically random, unpredictable
- 128-bit security (same as UUIDv4)

**Session Lifecycle**:
1. User creates session via authenticated API endpoint
2. Session starts in `created` state
3. Both device and RC window must authenticate to join
4. Session transitions through states: created → starting → streaming → closed
5. Sessions auto-close on timeout (5 minutes of inactivity by default)

**Session Validation**:
- User must own the session to join RC window channel
- Device must match the session's device_id to join device channels
- Session state must be active (created, starting, or streaming)

## CSRF Protection

### API Endpoints

API endpoints that create RC sessions are protected by:
1. **Bearer Token Authentication**: API uses token-based auth, not cookies
2. **Token Binding**: Tokens are tied to user identity and IP address
3. **Short-lived Tokens**: API tokens expire and must be refreshed

Since API endpoints use bearer tokens (not cookies), they are inherently protected from CSRF attacks. CSRF attacks rely on browsers automatically including cookies in requests, but bearer tokens must be explicitly included in request headers.

### Browser Endpoints

Browser-based endpoints use Phoenix's built-in CSRF protection:
- `plug :protect_from_forgery` in browser pipeline
- CSRF tokens in forms and AJAX requests
- Token validation on state-changing requests

## Token Types Summary

| Token Type | Use Case | Lifetime | Algorithm | Storage |
|------------|----------|----------|-----------|---------|
| Phoenix.Token | User WebSocket auth | 24 hours | HMAC-SHA256 | Client-side |
| Device Token | Device authentication | Permanent (until rotated) | Argon2 | Database (hashed) |
| API Access Token | REST API authentication | Configurable | Database token | Database |
| Session ID | RC session identity | 5 min (activity) | UUID v4 | Database |

## Security Best Practices

### Implemented

✅ **Argon2 for device tokens** - Memory-hard, resistant to GPU attacks  
✅ **Phoenix.Token for users** - Cryptographically signed, time-limited  
✅ **Role-based access control** - device_manager role required for RC  
✅ **Session ownership validation** - Users can only join their own sessions  
✅ **Device identity verification** - Device ID and token must match  
✅ **Automatic session timeout** - Inactive sessions close after 5 minutes  
✅ **IP address tracking** - Device connections record IP addresses  
✅ **Heartbeat mechanism** - Detects device disconnections  

### Extensibility for Future Enhancement

The architecture supports adding additional authentication methods:

**HMAC Authentication**:
- Could be added as an alternative to Argon2 for device tokens
- Useful for devices with hardware security modules
- Implementation would extend `Devices.verify_device_token/2`

**JWT Support**:
- Could be added for federated authentication scenarios
- Would integrate with existing Phoenix.Token flow
- Implementation would add JWT verification option in RcSocket

**Example Extension Point**:
```elixir
def verify_device_token(device_id, token) do
  case detect_token_type(token) do
    :argon2 -> verify_with_argon2(device_id, token)
    :hmac -> verify_with_hmac(device_id, token)
    :jwt -> verify_with_jwt(token)
  end
end
```

## Testing

Comprehensive test coverage includes:

- ✅ Valid authentication scenarios
- ✅ Invalid token rejection
- ✅ Expired token rejection  
- ✅ Missing token rejection
- ✅ Role permission enforcement
- ✅ Session ownership validation
- ✅ Device token security (Argon2 hashing)
- ✅ Cross-device token isolation

See test files:
- `test/castmill_web/channels/rc_socket_test.exs`
- `test/castmill_web/channels/rc_window_channel_test.exs`
- `test/castmill_web/channels/device_rc_channel_test.exs`
- `test/castmill_web/channels/devices_channel_auth_test.exs`
- `test/castmill_web/channels/device_socket_test.exs`

## Monitoring and Auditing

The system tracks:
- Device connection/disconnection events
- Device online/offline status
- Session creation and closure
- Failed authentication attempts (via error logs)

Events are stored in the `devices_events` table for auditing.

## Known Limitations and Future Work

1. **Rate Limiting**: WebSocket connections don't currently have rate limiting
2. **Geofencing**: IP-based restrictions mentioned in code but not implemented
3. **Token Rotation**: Device tokens are permanent until manually rotated
4. **Multi-Factor Authentication**: Not currently supported for WebSocket auth
5. **Audit Logging**: Connection events are logged but not centrally aggregated

## References

- [Phoenix Channels Security](https://hexdocs.pm/phoenix/channels.html#security)
- [Phoenix.Token](https://hexdocs.pm/phoenix/Phoenix.Token.html)
- [Argon2 Password Hashing](https://github.com/riverrun/argon2_elixir)
- [WebSocket Security Best Practices](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
