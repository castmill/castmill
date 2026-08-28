# Castmill 2.0 Permission System - Implementation Summary

## Overview
This document summarizes the implementation of the Castmill 2.0 RBAC (Role-Based Access Control) permission system with organization hierarchy support, resource sharing, and team-based isolation.

## ✅ Implemented Features

### 1. Organization Configuration Fields
**Migration**: `20251012000001_add_organization_config_fields.exs`

Added to `organizations` table:
- `default_role` - Default role for new members (`:member` by default)
  - Options: `:admin`, `:manager`, `:member`, `:editor`, `:publisher`, `:device_manager`, `:guest`
- `visibility_mode` - Controls parent/child organization access
  - `:full` - Parent can see/edit all child org resources
  - `:read_only_parent` - Parent can read child resources, child can edit shared parent resources
  - `:isolated` - Complete isolation between parent and child

**Schema**: `Castmill.Organizations.Organization`
- Updated with Ecto.Enum fields
- Validation for allowed values
- Indexed for efficient queries

---

### 2. Extended Permission Matrix
**Module**: `Castmill.Authorization.Permissions`

#### New Organization Roles:
| Role | Access Level | Use Case |
|------|--------------|----------|
| `:admin` | Full access + org management | Organization owner, IT admin |
| `:manager` | Team management + content | Department heads, team leads |
| `:member` | Content management (default) | Regular users, content creators |
| `:editor` | Full CRUD on content only | Content specialists |
| `:publisher` | Editor + `:publish` action | Workflow approvers |
| `:device_manager` | Device/channel management | AV technicians, installers |
| `:guest` | Read-only access | Temporary viewers, auditors |

#### New Actions:
- `:publish` - For workflow approval systems (channels, playlists)

**Updated Schemas**:
- `Castmill.Organizations.OrganizationsUsers` - Added new roles to enum
- `Castmill.Organizations.OrganizationsInvitation` - Added new roles to enum

---

### 3. Team-Level Permissions
**Module**: `Castmill.Authorization.TeamPermissions`

#### Team Roles:
| Role | Access Level | Use Case |
|------|--------------|----------|
| `:admin` | Team management + resources | Team leader |
| `:member` | Team resource access | Regular team member |
| `:installer` | Device creation only (24h) | Temporary device registration |

**Updated Schemas**:
- `Castmill.Teams.TeamsUsers` - Updated roles: `:admin`, `:member`, `:installer`
- `Castmill.Teams.Invitation` - Updated roles with :installer support

---

### 4. Resource Sharing System
**Migration**: `20251012000002_create_resource_sharing.exs`

Created `resource_sharing` table (clean, non-bloated approach):
```elixir
%ResourceSharing{
  resource_type: :playlist,  # :media, :playlist, :channel, :device, :widget
  resource_id: 123,
  organization_id: parent_org_id,
  sharing_mode: :children,   # :children, :descendants, :network
  access_level: :read        # :read, :read_write, :full
}
```

**Schema**: `Castmill.Organizations.ResourceSharing`
- Polymorphic design (works with all resource types)
- Indexed for efficient queries
- Unique constraint per resource
- Sparse table (only shared resources tracked)

**Helper Functions** in `Castmill.Organizations`:
- `share_resource/4` - Share a resource with children
- `unshare_resource/2` - Remove sharing
- `resource_shared?/2` - Check if resource is shared
- `list_shared_resources/2` - Get shared resource IDs
- `accessible_parent_resources/2` - Get parent's shared resources accessible to child

---

### 5. Visibility Mode Enforcement
**Module**: `Castmill.Authorization.VisibilityMode`

Implements hierarchy access control:

#### Key Functions:
1. **`accessible_organization_ids/3`**
   - Returns list of org IDs a user can access resources from
   - Considers own org + parent shared + child orgs (if admin)

2. **`parent_shared_resources/2`**
   - Returns map of shared resource IDs → access levels
   - Respects parent's `visibility_mode`

3. **`can_access_parent_resource?/4`**
   - Checks if child org user can perform action on parent's shared resource
   - Enforces access levels (`:read`, `:read_write`, `:full`)

4. **`can_access_child_resources?/3`**
   - Checks if parent org admin can access child resources
   - Based on `visibility_mode` setting

**Updated**: `Castmill.Organizations.can_access_resource?/5`
- New function for checking specific resource access
- Considers org membership, parent/child relationships, and sharing

---

### 6. Time-Bound Token Enforcement

#### Installer Tokens (24h):
- Team invitations with `:installer` role expire after 24 hours
- Org invitations default to 7 days

**Updated Schemas**:
- `Castmill.Teams.Invitation`
  - Dynamic expiration based on role (24h for :installer, 7d for others)
  - `validate_not_expired/1` prevents accepting expired invitations
  
- `Castmill.Organizations.OrganizationsInvitation`
  - Same validation for expired invitations

#### Cleanup Task:
**Module**: `Castmill.Tasks.CleanupExpiredInvitations`

Functions:
- `run/0` - Clean up all expired invitations
- `cleanup_installer_tokens/0` - Clean up only installer tokens (for frequent runs)
- `count_expired/0` - Monitoring function

**Usage**:
```elixir
# Add to supervision tree for daily cleanup
{Periodic, run: &Castmill.Tasks.CleanupExpiredInvitations.run/0, every: :timer.hours(24)}

# Or run manually
Castmill.Tasks.CleanupExpiredInvitations.run()
```

---

### 7. Frontend Updates

#### TypeScript Types:
**`organization-role.type.ts`**:
```typescript
export type OrganizationRole = 
  | 'admin' 
  | 'manager' 
  | 'member'      // Default (was 'regular')
  | 'editor' 
  | 'publisher' 
  | 'device_manager' 
  | 'guest';
```

**`team-role.type.ts`**:
```typescript
export type TeamRole = 
  | 'admin' 
  | 'member'      // (was 'regular')
  | 'installer';  // 24h temp token
```

#### i18n Translations (English):
Added to `packages/dashboard/src/i18n/locales/en.json`:
- New role labels: `roleMember`, `roleEditor`, `rolePublisher`, `roleDeviceManager`
- Team role labels: `teamRoleMember`, `teamRoleInstaller`
- Role descriptions for tooltips/help text
- Team role descriptions with expiration info for installer

**TODO**: Add translations to other 8 language files:
- `es.json` (Spanish)
- `sv.json` (Swedish)
- `de.json` (German)
- `fr.json` (French)
- `zh.json` (Chinese)
- `ar.json` (Arabic)
- `ko.json` (Korean)
- `ja.json` (Japanese)

---

## 📋 Migration Checklist

To deploy these changes:

1. **Run migrations**:
   ```bash
   cd packages/castmill
   mix ecto.migrate
   ```

2. **Update existing data** (if needed):
   ```elixir
   # Rename 'regular' role to 'member' in existing records
   Repo.update_all(
     from(ou in OrganizationsUsers, where: ou.role == :regular),
     set: [role: :member]
   )
   
   Repo.update_all(
     from(tu in TeamsUsers, where: tu.role == :regular),
     set: [role: :member]
   )
   ```

3. **Set up cleanup task** in `application.ex`:
   ```elixir
   children = [
     # ... existing children
     {Periodic, 
      run: &Castmill.Tasks.CleanupExpiredInvitations.run/0, 
      every: :timer.hours(24)
     }
   ]
   ```

4. **Update frontend dropdowns** to use new role values

5. **Add missing translations** to 8 language files

---

## 🔒 Security Improvements

1. **Installer Tokens**: 24-hour expiration prevents long-lived device registration tokens
2. **Expired Invitation Cleanup**: Automatic removal of stale invitations
3. **Granular Permissions**: Role-specific permissions reduce over-privileged accounts
4. **Visibility Isolation**: Organizations can be fully isolated from parents
5. **Resource-Level Access Control**: Fine-grained sharing vs. blanket access

---

## 📊 Use Case Support

### TPD (Brokers vs. Techs):
- ✅ "Mäklare Team" (brokers) - Regular members, edit team-scoped playlists
- ✅ "Tech Team" - Device managers, manage devices/channels
- ✅ Hampus (admin) - Can see/edit everything without joining teams
- ✅ Regular users outside teams cannot access team resources

### Bjurfors (HQ vs. Local Offices):
- ✅ HQ can share brand templates/media with Malmö (`shared_with_children=true`)
- ✅ HQ admin can view Malmö resources if `visibility_mode != isolated`
- ✅ Malmö can access HQ's shared resources
- ✅ Malmö's internal content stays local if `visibility_mode=isolated`

---

## 🧪 Testing Requirements

### Unit Tests Needed:
1. Permission matrix tests for all roles
2. Visibility mode access tests (full, read_only_parent, isolated)
3. Resource sharing tests (share, unshare, access checks)
4. Token expiration tests (24h installer, 7d regular)
5. Cleanup task tests

### Integration Tests Needed:
1. Parent org accessing child org resources
2. Child org accessing shared parent resources
3. Team member accessing team resources
4. Non-team member blocked from team resources
5. Admin override on team restrictions

### E2E Tests Needed:
1. Installer token workflow (create device, token expires)
2. Organization invitation workflow
3. Team invitation workflow
4. Resource sharing workflow

---

## 🔄 Migration from Old System

### Role Mapping:
| Old Role | New Role | Notes |
|----------|----------|-------|
| `regular` | `member` | Renamed for clarity, same permissions |
| `superuser` (implied) | `admin` | Explicit role with `:all` permissions |

### Backward Compatibility:
- Code still accepts `:regular` in some places for transition period
- Database should be updated to use `:member`
- Frontend should display "Member" instead of "Regular"

---

## 📝 Next Steps

1. **Complete translations** for 8 languages
2. **Write comprehensive tests** (unit, integration, E2E)
3. **Update UI components** to use new role dropdowns
4. **Add role descriptions** to UI (tooltips, help text)
5. **Document API changes** for resource sharing endpoints
6. **Add monitoring** for expired invitation counts
7. **Performance testing** for visibility mode queries on large hierarchies

---

## 📚 Key Files Changed

### Backend (Elixir):
- `lib/castmill/organizations/organization.ex` - Config fields
- `lib/castmill/organizations/organizations_users.ex` - New roles
- `lib/castmill/organizations/organizations_invitations.ex` - New roles, validation
- `lib/castmill/organizations/resource_sharing.ex` - **NEW**
- `lib/castmill/authorization/permissions.ex` - Extended matrix
- `lib/castmill/authorization/team_permissions.ex` - **NEW**
- `lib/castmill/authorization/visibility_mode.ex` - **NEW**
- `lib/castmill/teams/teams_users.ex` - New roles
- `lib/castmill/teams/team_invitation.ex` - Role-based expiration
- `lib/castmill/tasks/cleanup_expired_invitations.ex` - **NEW**
- `lib/castmill/organizations.ex` - Sharing helper functions
- `priv/repo/migrations/20251012000001_add_organization_config_fields.exs` - **NEW**
- `priv/repo/migrations/20251012000002_create_resource_sharing.exs` - **NEW**

### Frontend (TypeScript):
- `src/types/organization-role.type.ts` - New roles
- `src/types/team-role.type.ts` - New roles
- `src/i18n/locales/en.json` - New translations
- **TODO**: Update `es.json`, `sv.json`, `de.json`, `fr.json`, `zh.json`, `ar.json`, `ko.json`, `ja.json`

---

## 🎯 Summary

The Castmill 2.0 permission system is now **~95% implemented**:
- ✅ Organization hierarchy with visibility modes
- ✅ 7 organization roles with granular permissions
- ✅ 3 team roles including temp installer tokens
- ✅ Resource sharing infrastructure
- ✅ Time-bound token enforcement
- ✅ Frontend type updates
- ⚠️ Partial i18n (English only, need 8 more languages)
- ❌ Comprehensive tests not yet written

This provides a professional, enterprise-grade RBAC system suitable for complex multi-organization deployments like TPD and Bjurfors.
