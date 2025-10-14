# RBAC Current State and Proposed Changes

**⚠️ CRITICAL: This document analyzes existing authorization logic with extensive test coverage. Changes must be made carefully to avoid breaking security or tests.**

## Table of Contents
1. [Current Authorization Architecture](#current-authorization-architecture)
2. [Current Role Permissions](#current-role-permissions)
3. [Proposed Permission Model](#proposed-permission-model)
4. [Required Changes](#required-changes)
5. [Test Impact Analysis](#test-impact-analysis)
6. [Migration Strategy](#migration-strategy)

---

## Current Authorization Architecture

### Components

1. **`Organizations.has_access/4`** (`lib/castmill/organizations.ex:313`)
   - Central authorization function
   - Checks `OrganizationsUsersAccess` table for granular permissions
   - Special cases: Admins have full access, Managers can create teams
   - Supports hierarchical organization access (checks parent orgs)

2. **Controller-level `check_access/3`** callbacks
   - Each controller implements `CastmillWeb.AccessActorBehaviour`
   - Called by `AuthorizeDash` plug before action execution
   - Returns `{:ok, true}` or `{:ok, false}`

3. **Role Helpers**
   - `Organizations.is_admin?/2` - Checks if user has `:admin` role
   - `Organizations.is_manager?/2` - Checks if user has `:manager` role
   - `Organizations.has_any_role?/3` - Checks if user has any of specified roles
   - `Organizations.get_user_role/2` - Returns user's role (`:admin`, `:manager`, `:regular`, `:guest`, or `nil`)

### Current Roles
- **`:admin`** - Full organizational access
- **`:manager`** - Can create teams, elevated permissions
- **`:regular`** - Standard user with limited access
- **`:guest`** - Read-only access to specific resources

---

## Current Role Permissions

### Resource Controller (`resource_controller.ex`)

**Current Logic:**
```elixir
# Line 52: Update devices, playlists, medias, channels
Organizations.has_any_role?(organization_id, actor_id, [:admin, :regular])

# Line 60: List/read channel entries
Organizations.has_any_role?(organization_id, actor_id, [:admin, :regular, :guest])

# Line 67: General resource access (delegates to Organizations.has_access/4)
Organizations.has_access(organization_id, actor_id, resources, action)
```

**Interpretation:**
- ✅ Regular users CAN: Update devices, playlists, medias, channels (line 52)
- ✅ Guest users CAN: Read channel entries (line 60)
- ⚠️ For other actions: Depends on `OrganizationsUsersAccess` table or defaults to admin-only

### Team Controller (`team_controller.ex`)

**Current Logic:**
```elixir
# Lines 17-23: Manage teams (invite, update, remove members, add/remove resources)
isOrganizationAdmin?(team_id, actor_id)  # Returns true if :admin OR :manager

# Lines 30-35: List teams/members/invitations
isOrganizationMember?(team_id, actor_id)  # Returns true if :admin, :manager, OR :regular
```

**Interpretation:**
- ✅ Managers CAN: Manage team membership (same as admins)
- ✅ Regular users CAN: View teams, members, invitations (read-only)
- ❌ Regular users CANNOT: Create teams, invite members, update teams, remove members

### Organization Controller (`organization_controller.ex`)

**Current Logic:**
```elixir
# Lines 39-50: Widget management (create, update, delete)
Organizations.is_admin?(organization_id, actor_id)  # Admin-only

# Line 54: List organization members
Organizations.has_any_role?(organization_id, actor_id, [:admin, :manager, :regular])

# Lines 58-66: Organization management (invite, list invitations, remove invitations)
Organizations.is_admin?(organization_id, actor_id)  # Admin-only
```

**Interpretation:**
- ❌ Regular users CANNOT: Manage widgets (admin-only)
- ✅ Regular users CAN: View organization members
- ❌ Regular users CANNOT: Manage organization invitations

---

## Proposed Permission Model

Based on your requirements: *"a regular role should probably be able to read/write access to the following resources: playlists, medias, devices, channels, but probably not teams other than read access."*

### Desired Permissions Matrix

| Resource | Admin | Manager | Regular | Guest |
|----------|-------|---------|---------|-------|
| **Playlists** | Full | Full | **✅ Read/Write** | Read-only |
| **Medias** | Full | Full | **✅ Read/Write** | Read-only |
| **Devices** | Full | Full | **✅ Read/Write** | Read-only |
| **Channels** | Full | Full | **✅ Read/Write** | Read-only |
| **Teams** (View) | Full | Full | **✅ Read-only** | No access |
| **Teams** (Manage) | Full | Full | **❌ No access** | No access |
| **Widgets** | Full | ? | ? | No access |
| **Organization Settings** | Full | ? | No access | No access |

### Rationale

**Why Regular users should have full access to content resources:**
- Digital signage platform: Regular users are content creators/managers
- Core workflow: Create playlists → Upload media → Assign to devices → Distribute via channels
- Team management affects organizational structure and permissions → Admin-level concern

**Why Regular users should have read-only Teams access:**
- Need to see which teams exist and who's in them for collaboration
- Should NOT be able to add/remove members (affects permissions)
- Should NOT be able to create teams (organizational decision)

---

## Required Changes

### ✅ Already Correct (No Changes Needed)

1. **Resource Controller** (devices, playlists, medias, channels)
   - Line 52: `has_any_role?(organization_id, actor_id, [:admin, :regular])`
   - ✅ Already allows Regular users to create/update/delete

2. **Team Controller** - Read access
   - Lines 30-35: `isOrganizationMember?` already allows Regular to view teams/members/invitations
   - ✅ Already correct for read-only access

### ⚠️ Potential Issues (Review Needed)

#### 1. **Team Controller - Write Operations**

**Current behavior** (Lines 17-23):
```elixir
def check_access(actor_id, action, %{"team_id" => team_id})
    when action in [
           :invite_user,
           :update_team,
           :remove_member,
           :add_resource,
           :remove_resource,
           :remove_invitation
         ] do
  case isOrganizationAdmin?(team_id, actor_id) do
    true -> {:ok, true}
    false -> {:ok, false}
  end
end

defp isOrganizationAdmin?(team_id, user_id) do
  # ...
  role == :admin or role == :manager  # Line 75
end
```

**Issue:** This is actually **CORRECT** for your requirements!
- Only Admins and Managers can modify teams
- Regular users blocked from team management
- ✅ No changes needed

#### 2. **Organizations.has_access/4 - Default Behavior**

**Current behavior** (`organizations.ex:313`):
```elixir
def has_access(organization_id, user_id, resource_type, action) do
  cond do
    is_admin?(organization_id, user_id) ->
      true

    resource_type == "teams" and action == :create and is_manager?(organization_id, user_id) ->
      true

    true ->
      # Queries OrganizationsUsersAccess table for granular permissions
      # Falls back to checking parent organization
  end
end
```

**Question:** What happens when `OrganizationsUsersAccess` table is empty?
- If no rows exist for a user → Access denied (except for admins/managers with teams)
- This means Regular users might be **blocked by default** unless explicit access rows exist

**Action Required:** 
1. Check if `OrganizationsUsersAccess` table is populated in production
2. If empty: Need to either:
   - Add default rows for Regular users, OR
   - Modify `has_access/4` to have default allowances for Regular role

#### 3. **Widget Management**

**Current behavior** (`organization_controller.ex:39-50`):
```elixir
def check_access(actor_id, :create_widget, %{"organization_id" => organization_id}) do
  # Only admins can create widgets for now
  {:ok, Organizations.is_admin?(organization_id, actor_id)}
end
```

**Question:** Should Regular users be able to create/manage widgets?
- Widgets are reusable content components (like video player, image carousel, etc.)
- In a digital signage context, content creators likely need this

**Decision needed:**
- **Option A:** Keep admin-only (organizational widgets managed centrally)
- **Option B:** Allow Regular users (content creators need widget flexibility)

---

## Test Impact Analysis

### Existing Tests to Review

1. **`team_controller_test.exs`**
   - Line 119: `"allows organization admin to do these actions"` ✅ Should still pass
   - Line 135: `"forbids non-admin org user from these actions"` ✅ Should still pass (Regular role)
   - Line 156: `"allows organization member to list resources / members"` ✅ Should still pass

2. **`organization_invitation_test.exs`**
   - Line 265: `"admin invitation grants admin role"` ✅ No impact
   - Line 291: `"guest invitation grants guest role"` ✅ No impact

### Tests That May Need Updates

**If you modify `has_access/4` logic:**
- Any tests that rely on default access behavior
- Integration tests for resource CRUD operations
- Authorization tests in controllers

**Search for tests:**
```bash
cd packages/castmill
grep -r "has_access\|check_access\|has_any_role" test/ --include="*.exs"
```

---

## Migration Strategy

### Phase 1: Validation (NO CODE CHANGES)
✅ **Current Phase**

1. ✅ Document current authorization architecture
2. ✅ Identify all `check_access` implementations
3. ⏳ **Next:** Run existing test suite to establish baseline
   ```bash
   cd packages/castmill
   mix test
   ```
4. ⏳ **Next:** Test current behavior with Regular user:
   - Create test Regular user in organization
   - Attempt to create/edit playlist → Should succeed (line 52)
   - Attempt to create/edit team → Should fail (line 75)
   - Attempt to view team → Should succeed (line 87)

### Phase 2: Analysis
1. Check `OrganizationsUsersAccess` table schema and data
2. Determine if default permissions exist for Regular users
3. Decide on Widget management permissions (Regular access or not?)

### Phase 3: Documentation Update
1. Update RBAC_IMPLEMENTATION_ISSUE.md with findings
2. Document exact changes needed (if any)
3. List tests that need updating

### Phase 4: Implementation (Only if needed)
1. Make minimal, targeted changes
2. Update tests incrementally
3. Run test suite after each change
4. Document breaking changes

---

## Current Assessment

### ✅ Good News: Minimal Changes Needed!

Based on analysis, the **current authorization logic already matches your requirements**:

1. ✅ **Playlists, Medias, Devices, Channels**: Regular users have read/write (line 52)
2. ✅ **Teams (Read)**: Regular users can view teams/members (line 87)
3. ✅ **Teams (Write)**: Regular users blocked from management (line 75)

### ⚠️ Questions to Answer

1. **Does `Organizations.has_access/4` default to allowing Regular users?**
   - Need to check `OrganizationsUsersAccess` table behavior
   - Test with actual Regular user account

2. **Should Regular users manage Widgets?**
   - Currently admin-only
   - Clarify based on your use case

3. **Are there hidden permission checks in resource creation?**
   - Playlist creation might have additional checks
   - Media upload might have additional checks
   - Need real-world testing

### 🎯 Recommended Next Steps

**Before any code changes:**

1. **Test current behavior** with Regular user:
   ```bash
   # In IEx console
   iex -S mix phx.server
   
   # Create test Regular user
   org = Castmill.Organizations.get_organization!(1)
   user = Castmill.Accounts.get_user_by_email("regular@test.com")
   Castmill.Organizations.set_user_role(org.id, user.id, :regular)
   
   # Test permissions
   Castmill.Organizations.has_access(org.id, user.id, "playlists", :create)
   Castmill.Organizations.has_access(org.id, user.id, "teams", :create)
   ```

2. **Run existing tests:**
   ```bash
   cd packages/castmill
   mix test test/castmill_web/controllers/team_controller_test.exs
   mix test test/castmill_web/controllers/resource_controller_test.exs
   ```

3. **Check database:**
   ```sql
   SELECT * FROM organizations_users_access LIMIT 10;
   ```

4. **Review with team** before making any changes

---

## Conclusion

**The existing authorization system appears to already implement your desired permission model.** The main uncertainty is around:

1. Default behavior when `OrganizationsUsersAccess` table is empty
2. Whether Widget management should be expanded to Regular users

**Recommendation: Validate first, modify only if necessary.**

Before updating RBAC_IMPLEMENTATION_ISSUE.md or making code changes, please:
1. Test current Regular user permissions in running system
2. Review `OrganizationsUsersAccess` table structure
3. Confirm whether changes are actually needed

This cautious approach will prevent breaking existing tests and security logic.
