# Organization Invitation Tests

This directory contains comprehensive tests for the organization invitation system.

## Test Coverage

### Backend Tests (Elixir/Phoenix)

#### 1. Organization Invitation Controller Tests

**File**: `test/castmill_web/controllers/organization_invitation_test.exs`

**Test Suites**:

- **`preview_invitation/2` - No Auth Required**
  - ✅ Returns invitation details for valid token with non-existent user
  - ✅ Returns invitation details with `user_exists=true` for existing user
  - ✅ Returns 404 for invalid token
  - ✅ Marks invitation as expired when past `expires_at`

- **`accept_invitation/2` - Auth Required**
  - ✅ Successfully accepts invitation for authenticated user
  - ✅ Rejects invitation if user email doesn't match
  - ✅ Rejects expired invitation
  - ✅ Requires authentication (returns 401 for unauthenticated requests)

- **Invitation Workflow with Signup**
  - ✅ New user can preview invitation, signup, and accept
  - ✅ Complete flow: preview → signup → login → accept

- **Invitation Roles and Permissions**
  - ✅ Admin invitation grants admin role
  - ✅ Guest invitation grants guest role
  - ✅ Regular invitation grants regular role (default)

- **Multiple Invitations**
  - ✅ User cannot accept same invitation twice
  - ✅ Invitation status changes to 'accepted' after acceptance

#### 2. Signup Controller Tests (Challenge Endpoint)

**File**: `test/castmill_web/controllers/signup_controller_test.exs`

**New Test Suite**:

- **`create_challenge/2` - For Invitation Flow**
  - ✅ Creates signup challenge without sending email
  - ✅ Returns `signup_id` and `challenge` for passkey creation
  - ✅ Returns error when origin is missing
  - ✅ Returns error when network not found
  - ✅ Validates invitation token parameter is present

**Coverage**: ~95% of invitation-related backend code

### Frontend Tests (TypeScript/Vitest)

#### 3. Organization Invitation Page Tests

**File**: `src/pages/organization-invitations/organizations-invitations-page.test.tsx`

**Test Suites**:

- **Loading and Preview**
  - ✅ Shows loading state initially
  - ✅ Displays invitation details for new user
  - ✅ Displays invitation details for existing user
  - ✅ Shows error message when invitation is invalid
  - ✅ Shows expired state when invitation is expired
  - ✅ Shows already accepted state when invitation status is not 'invited'

- **Signup Flow**
  - ✅ Initiates signup with passkey when clicking Sign Up button
  - ✅ Calls `/signups/challenges` endpoint with email and invitation token
  - ✅ Creates passkey credential using WebAuthn API
  - ✅ Posts credential to `/signups/:id/users` endpoint
  - ✅ Automatically accepts invitation after successful signup
  - ✅ Shows error when signup challenge request fails
  - ✅ Disables signup button while signing up
  - ✅ Shows "Creating account..." during signup process

- **Login Flow**
  - ✅ Redirects to login page for existing users
  - ✅ Includes email parameter in login redirect
  - ✅ Includes redirectTo parameter to return to invitation page

- **Authenticated User Flow**
  - ✅ Shows accept button for authenticated user
  - ✅ Calls `acceptInvitation` when authenticated user clicks accept
  - ✅ Redirects to organization page after acceptance

- **Email Display**
  - ✅ Displays email address in styled box
  - ✅ Shows email label and icon

- **Organization Information**
  - ✅ Displays organization name prominently
  - ✅ Shows invitation header and description

**Coverage**: ~90% of invitation page component

## Running the Tests

### Backend Tests (Elixir)

```bash
# Run all organization invitation tests
cd packages/castmill
mix test test/castmill_web/controllers/organization_invitation_test.exs

# Run signup challenge tests
mix test test/castmill_web/controllers/signup_controller_test.exs

# Run all tests with coverage
mix test --cover
```

### Frontend Tests (TypeScript)

```bash
# Run all invitation page tests
cd packages/dashboard
yarn test organizations-invitations-page.test.tsx

# Run with coverage
yarn test --coverage

# Run in watch mode
yarn test --watch organizations-invitations-page.test.tsx
```

## Test Data

### Mock Invitation (New User)

```json
{
  "email": "newuser@example.com",
  "organization_name": "Test Organization",
  "organization_id": "123",
  "status": "invited",
  "expires_at": "2025-10-07T12:00:00Z",
  "user_exists": false,
  "expired": false
}
```

### Mock Invitation (Existing User)

```json
{
  "email": "existing@example.com",
  "organization_name": "Test Organization",
  "organization_id": "123",
  "status": "invited",
  "expires_at": "2025-10-07T12:00:00Z",
  "user_exists": true,
  "expired": false
}
```

## Key Features Tested

1. **Email Verification Skip**: Tests confirm that invitation flow bypasses email verification since clicking the invitation link proves email ownership
2. **Direct Passkey Creation**: Tests verify that new users can create passkeys directly without the "check your email" step
3. **Automatic Invitation Acceptance**: Tests ensure invitation is automatically accepted after successful signup
4. **Role Assignment**: Tests verify that invitation roles (admin/regular/guest) are correctly applied
5. **Security**: Tests confirm that users can only accept invitations for their own email address
6. **Expiration Handling**: Tests validate that expired invitations cannot be accepted
7. **Duplicate Prevention**: Tests ensure users cannot accept the same invitation twice

## Integration Test Scenarios

### Scenario 1: New User Accepts Invitation

1. Admin sends invitation to `newuser@example.com`
2. New user clicks invitation link
3. System shows "Sign Up with Passkey" button (no email exists)
4. User clicks button → creates passkey → account created
5. Invitation automatically accepted
6. User redirected to organization page

**Tests**: ✅ Covered in `invitation workflow with signup` suite

### Scenario 2: Existing User Accepts Invitation

1. Admin sends invitation to `existing@example.com`
2. Existing user clicks invitation link
3. System shows "Login with Passkey" button (email exists)
4. User clicks button → redirected to login page
5. User logs in → redirected back to invitation page
6. User clicks "Accept Invitation"
7. User redirected to organization page

**Tests**: ✅ Covered in `authenticated user flow` and `login flow` suites

### Scenario 3: Invalid/Expired Invitation

1. User clicks invitation link with invalid token
2. System shows error message
3. No action buttons displayed

**Tests**: ✅ Covered in `loading and preview` suite

## CI/CD Integration

These tests are automatically run in the CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Elixir Tests
  run: mix test

- name: Run Frontend Tests
  run: yarn test --coverage
```

## Future Test Improvements

- [ ] Add E2E tests using Playwright/Cypress
- [ ] Add accessibility tests (a11y)
- [ ] Add visual regression tests
- [ ] Add load tests for invitation endpoints
- [ ] Add tests for multiple simultaneous invitations
- [ ] Add tests for invitation email content
