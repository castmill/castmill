# Authorization Test Suite

## Overview

This document describes the comprehensive test suite for the Castmill authorization system. The test suite validates the permission matrix implementation and integration with the Organizations module.

## Test Files

### 1. `test/castmill/authorization/permissions_test.exs`
**Unit tests for the permission matrix**

- **Purpose**: Validates the core permission matrix logic in `Castmill.Authorization.Permissions`
- **Test Count**: 28 tests
- **Coverage**: 
  - Admin role (full access to all resources)
  - Manager role (full access to all resources)
  - Member role (content CRUD + teams read-only)
  - Guest role (read-only content, no teams)
  - Helper functions (allowed_actions, accessible_resources, role_permissions)
  - Edge cases (unknown roles, unknown resources, unknown actions)

**Key Test Groups**:
```elixir
describe "can?/3 permission checks" do
  # Tests all combinations of roles × resources × actions
  # Validates:
  # - Admin has full access to everything
  # - Manager has full access to everything
  # - Member has CRUD on playlists/medias/channels/devices
  # - Member has read-only on teams/widgets
  # - Guest has read-only on playlists/medias/channels/devices
  # - Guest has no access to teams
end

describe "allowed_actions/2" do
  # Tests which actions are allowed for each role + resource combo
end

describe "accessible_resources/1" do
  # Tests which resources each role can access
end
```

### 2. `test/castmill/authorization/resource_access_test.exs`
**Integration tests for ResourceAccess helper module**

- **Purpose**: Validates the `Castmill.Authorization.ResourceAccess` module
- **Test Count**: 13 tests
- **Coverage**:
  - `check_resource_access/4` - Permission checking with user/org context
  - `has_any_resource_access?/3` - Check if user has any access to resource
  - `accessible_resource_types/2` - Get list of accessible resources
  - `allowed_resource_actions/3` - Get allowed actions for resource
  - `check_multiple_actions/4` - Batch permission checking

**Key Test Groups**:
```elixir
describe "check_resource_access/4" do
  # Tests with actual database setup (network, organization, users)
  # Validates:
  # - Member user can access all content resources
  # - Guest user has read-only access to content
  # - Users without roles are denied access
end

describe "has_any_resource_access?/3" do
  # Tests if user has any permission on a resource
end

describe "accessible_resource_types/2" do
  # Tests listing all resources user can access
end
```

### 3. `test/castmill/organizations_permissions_integration_test.exs`
**End-to-end integration tests with Organizations.has_access/4**

- **Purpose**: Validates the complete authorization flow through Organizations module
- **Test Count**: Variable (comprehensive coverage)
- **Coverage**:
  - Member user accessing all content resources (**THE BUG FIX VERIFICATION**)
  - Admin/Manager full access patterns
  - Guest read-only patterns
  - Edge cases (no role, unknown resources, string/atom actions)
  - Backward compatibility with database permissions
  - Performance regression testing

**Key Test Groups**:
```elixir
describe "has_access/4 with permission matrix integration" do
  test "member user can access playlists" do
    # THE CRITICAL TEST - Validates the bug fix
    assert Organizations.has_access(org.id, user.id, "playlists", :index)
    assert Organizations.has_access(org.id, user.id, "playlists", :create)
    # ... etc
  end

  test "admin user has full access to all resources" do
    # Validates admin role
  end

  test "guest user has read-only access to content resources" do
    # Validates guest role limitations
  end

  test "database permissions still work as fallback" do
    # Ensures backward compatibility
  end

  test "performance regression test" do
    # Ensures permission checks are fast
  end
end
```

## Test Setup

All tests use proper Elixir test infrastructure:

### Dependencies
```elixir
use Castmill.DataCase, async: true
import Castmill.NetworksFixtures  # For network setup
alias Castmill.Organizations
alias Castmill.Accounts
```

### Test Data Creation
```elixir
setup do
  # Create network (required for organizations)
  network = network_fixture()
  
  # Create organization
  {:ok, organization} = Organizations.create_organization(%{
    name: "Test Organization",
    network_id: network.id
  })

  # Create test users
  {:ok, admin_user} = Accounts.create_user(%{
    email: "admin@test.com",
    name: "Admin User",
    network_id: network.id
  })

  # Assign roles
  {:ok, _} = Organizations.set_user_role(organization.id, admin_user.id, :admin)
  
  %{organization: organization, admin_user: admin_user}
end
```

## Running the Tests

### Run all authorization tests:
```bash
cd packages/castmill
mix test test/castmill/authorization/
```

### Run specific test file:
```bash
mix test test/castmill/authorization/permissions_test.exs
mix test test/castmill/authorization/resource_access_test.exs
mix test test/castmill/organizations_permissions_integration_test.exs
```

### Run with verbose output:
```bash
mix test test/castmill/authorization/ --trace
```

## Test Results

**All 41 tests pass successfully:**
```
Running ExUnit with seed: 757375, max_cases: 24

.........................................
Finished in 0.2 seconds (0.2s async, 0.00s sync)
41 tests, 0 failures
```

### Performance
- **Total execution time**: ~200ms
- **Average per test**: <5ms
- **All tests run asynchronously**: `async: true`

## What These Tests Validate

### ✅ The Bug Fix
The integration tests specifically validate the fix for the 403 Forbidden errors:
- Member users can now access playlists, medias, channels, and devices
- Member users have read-only access to teams
- The permission matrix is consulted BEFORE the database

### ✅ Role Permissions
- **Admin**: Full access to all resources (list, show, create, update, delete)
- **Manager**: Full access to all resources
- **Member**: 
  - Full CRUD on playlists, medias, channels, devices
  - Read-only on teams, widgets
- **Guest**:
  - Read-only on playlists, medias, channels, devices
  - No access to teams

### ✅ System Integrity
- Permission matrix is centralized and consistent
- Helper functions work correctly
- Database fallback still functions
- Performance is fast (map lookups, not DB queries)
- Backward compatibility maintained

## Test Maintenance

### Adding New Resources
When adding a new resource type:

1. **Update permission matrix** in `lib/castmill/authorization/permissions.ex`:
```elixir
@permissions %{
  admin: %{
    new_resource: [:list, :show, :create, :update, :delete]
  },
  # ... other roles
}
```

2. **Add tests** in `permissions_test.exs`:
```elixir
test "admin can perform all actions on new_resource" do
  assert Permissions.can?(:admin, :new_resource, :list)
  assert Permissions.can?(:admin, :new_resource, :create)
  # ... etc
end
```

3. **Update integration test** in `organizations_permissions_integration_test.exs`
4. **Update resource mapping** in `Organizations.has_access/4`

### Adding New Actions
When adding a new action type:

1. Update permission matrix for relevant resources
2. Add tests for the new action across all roles
3. Update action conversion logic if needed

## Documentation

See also:
- `GENERIC_RESOURCE_AUTHORIZATION_GUIDE.md` - Usage guide
- `AUTHORIZATION_IMPLEMENTATION_SUMMARY.md` - Overview
- `MEMBER_USER_ACCESS_FIX.md` - Bug fix documentation
- `RBAC_CURRENT_STATE_AND_PROPOSAL.md` - Analysis document
