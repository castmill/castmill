# Credential Recovery Feature

## Overview
This document describes the "Lost your credentials?" feature implemented for passkey-based authentication in the Castmill Digital Signage Platform.

## User Flow

1. **Initiate Recovery**: User clicks "Lost your credentials?" link on login page
2. **Enter Email**: User enters their registered email address
3. **Confirmation**: User receives confirmation message (same response for all emails)
4. **Email Link**: If email exists, user receives recovery email with 5-minute link
5. **Verify Token**: Recovery page verifies the token automatically
6. **Add Passkey**: User creates a new passkey using their device
7. **Auto-Login**: User is automatically logged in after successful recovery

## Security Features

- **No Email Enumeration**: Same response whether email exists or not
- **Time-Limited Tokens**: Recovery links expire after 5 minutes
- **Cryptographic Challenge**: Secure passkey creation validation
- **Session Management**: Recovery state secured in server session
- **Single-Use Tokens**: Tokens consumed after successful use

## API Endpoints

### Request Recovery
```
POST /credentials/recover
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: 200 OK
{
  "status": "ok",
  "message": "If your email is in our system, you will receive instructions..."
}
```

### Verify Token
```
GET /credentials/recover/verify?token=TOKEN

Response: 200 OK (valid token)
{
  "status": "ok",
  "user": {
    "id": "user-id",
    "email": "user@example.com"
  }
}

Response: 422 (invalid/expired token)
{
  "status": "error",
  "message": "Invalid or expired token"
}
```

### Create Challenge
```
GET /credentials/recover/challenge?token=TOKEN

Response: 200 OK
{
  "challenge": "base64-challenge",
  "user_id": "user-id",
  "email": "user@example.com"
}
```

### Add Recovery Credential
```
POST /credentials/recover/credential
Content-Type: application/json

{
  "token": "recovery-token",
  "credential_id": "passkey-id",
  "public_key_spki": "base64-public-key",
  "client_data_json": [...]
}

Response: 201 Created
{
  "status": "ok",
  "message": "Credential added successfully. You are now logged in.",
  "credential": {
    "id": "credential-id",
    "name": "Recovered Passkey",
    "inserted_at": "2024-01-15T10:30:00Z"
  }
}
```

## Frontend Components

### RecoverCredentials Component
- Location: `packages/dashboard/src/components/login/recover-credentials.tsx`
- Purpose: Email input form for requesting recovery
- Features:
  - Email validation
  - Loading states
  - Error handling
  - Confirmation message

### CompleteRecovery Component
- Location: `packages/dashboard/src/components/login/complete-recovery.tsx`
- Purpose: Token verification and passkey creation
- Features:
  - Automatic token verification
  - Browser passkey support detection
  - WebAuthn passkey creation
  - Automatic login after recovery
  - Error handling with user-friendly messages

### Updated Login Component
- Location: `packages/dashboard/src/components/login/login.tsx`
- Changes:
  - Functional "Lost your credentials?" link
  - Toggle between login and recovery views
  - Consistent styling

## Backend Implementation

### User Token Module
- File: `packages/castmill/lib/castmill/accounts/user_token.ex`
- Added: `recover_credentials` token context with 24-hour validity

### User Notifier Module
- File: `packages/castmill/lib/castmill/accounts/user_notifier.ex`
- Added: `deliver_recover_credentials_instructions/2` function

### Accounts Module
- File: `packages/castmill/lib/castmill/accounts.ex`
- Added:
  - `deliver_user_recover_credentials_instructions/2`
  - `get_user_by_recover_credentials_token/1`

### Credential Recovery Controller
- File: `packages/castmill/lib/castmill_web/controllers/credential_recovery_controller.ex`
- Handles all recovery-related API endpoints
- Implements security measures
- Manages session state for recovery process

## Configuration

### Environment Variables

Backend (Elixir):
```bash
MAILER_FROM="noreply@castmill.com"
DASHBOARD_URL="https://dashboard.castmill.com"
```

Frontend (Vite):
```bash
VITE_API_URL="https://api.castmill.com"
VITE_ORIGIN="https://dashboard.castmill.com"
VITE_DOMAIN="castmill.com"
```

## Testing

### Manual Testing Checklist

- [ ] Request recovery with existing email
- [ ] Request recovery with non-existing email
- [ ] Verify no difference in response between existing/non-existing emails
- [ ] Click recovery link from email
- [ ] Verify token validation works
- [ ] Create new passkey successfully
- [ ] Verify automatic login after recovery
- [ ] Test with expired token
- [ ] Test with invalid token
- [ ] Test browser without passkey support
- [ ] Test passkey creation cancellation
- [ ] Test network errors

### Browser Compatibility

Tested browsers:
- [ ] Chrome/Edge (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile)

## Error Handling

### Common Errors

1. **Browser doesn't support passkeys**
   - Message: "Your browser does not support Passkeys"
   - Action: Show error message with info link

2. **Invalid or expired token**
   - Message: "Invalid or expired recovery link"
   - Action: Show error with "Back to Login" button

3. **Passkey creation cancelled**
   - Message: "Passkey creation was cancelled or timed out"
   - Action: Allow user to retry

4. **Network error**
   - Message: "Failed to send recovery email. Please try again."
   - Action: Allow user to retry

## Troubleshooting

### User doesn't receive recovery email

1. Check email is registered in system
2. Verify MAILER_FROM environment variable is set
3. Check email server configuration
4. Check spam/junk folder

### Token verification fails

1. Check token hasn't expired (24-hour limit)
2. Verify token hasn't been used already
3. Check DASHBOARD_URL environment variable

### Passkey creation fails

1. Verify browser supports WebAuthn
2. Check user has biometric/PIN setup on device
3. Ensure secure context (HTTPS)

## Future Enhancements

- [ ] Add rate limiting for recovery requests
- [ ] Add CAPTCHA for abuse prevention
- [ ] Support for multiple recovery methods (SMS, backup codes)
- [ ] Recovery history in user settings
- [ ] Admin dashboard for recovery monitoring
- [ ] Recovery analytics and reporting

## Related Documentation

- [Passkey Authentication](./docs/authentication.md)
- [User Management](./docs/users.md)
- [Email Configuration](./docs/email.md)
- [Security Best Practices](./docs/security.md)
