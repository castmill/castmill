# Manager Role Implementation

## Overview
This PR adds a new "manager" role to the organization role hierarchy, positioned between admin and regular roles.

## Role Hierarchy
```
Admin > Manager > Regular > Guest
```

## Manager Permissions

### ✅ Managers CAN:
- Create teams in the organization
- Add members to teams
- Remove members from teams  
- Update team settings
- List organization members (needed to add them to teams)
- List team members and resources
- Add/remove resources from teams (channels, playlists, devices, etc.)

### ❌ Managers CANNOT:
- Invite new members to the organization (admin-only)
- Remove organization invitations (admin-only)
- Update organization settings (admin-only)
- Delete widgets (admin-only)
- Create widgets (admin-only)
- Update widgets (admin-only)

## Changes Made

### Backend (Elixir/Phoenix)

**Schema Updates:**
1. `lib/castmill/organizations/organizations_users.ex`
   - Added `:manager` to role enum values: `[:admin, :manager, :regular, :guest]`

2. `lib/castmill/organizations/organizations_invitations.ex`
   - Added `:manager` to role enum values: `[:admin, :manager, :regular, :guest]`

3. `lib/castmill/accounts/user.ex`
   - Added `:manager` to virtual role enum: `[:admin, :manager, :regular, :guest]`

**Context Functions:**
4. `lib/castmill/organizations.ex`
   - Added `is_manager?/2` function to check if user has manager role
   - Updated `has_access/4` to allow managers to create teams
   - Kept invite permissions admin-only

**Controller Authorization:**
5. `lib/castmill_web/controllers/organization_controller.ex`
   - Updated `check_access/3` for `:list_members` to include `:manager` role
   - Kept `:invite_member` restricted to admins only

6. `lib/castmill_web/controllers/team_controller.ex`
   - Updated `isOrganizationAdmin?/2` to include managers (allows team management)
   - Updated `isOrganizationMember?/2` to include managers (allows viewing teams)

### Frontend (TypeScript/React/SolidJS)

**Type Definitions:**
1. `packages/dashboard/src/types/organization-role.type.ts`
   - Updated type: `export type OrganizationRole = 'admin' | 'manager' | 'regular' | 'guest'`

**UI Components:**
2. `packages/dashboard/src/pages/organization-page/organization-invite-form.tsx`
   - Added "Manager" option to role dropdown in invite form

**Internationalization (i18n):**
3. Added `roleManager` translations to all 9 locale files:
   - `en.json`: "Manager"
   - `es.json`: "Gerente"
   - `sv.json`: "Chef"
   - `de.json`: "Manager"
   - `fr.json`: "Gestionnaire"
   - `zh.json`: "经理"
   - `ar.json`: "مدير"
   - `ko.json`: "매니저"
   - `ja.json`: "マネージャー"

### Database

**No migration required:**
- The `role` field in both `organizations_users` and `organizations_invitations` tables is defined as `:string` at the database level
- Ecto.Enum validation happens at the application layer
- Adding `:manager` to the enum requires no schema changes

## Testing Recommendations

### Backend Tests
- [ ] Test that managers can create teams
- [ ] Test that managers can add/remove team members
- [ ] Test that managers CANNOT invite users to organization
- [ ] Test that managers can list organization members
- [ ] Test that managers can manage team resources

### Frontend Tests
- [ ] Test that manager role appears in invite form dropdown
- [ ] Test that manager role is properly translated in all languages
- [ ] Test that invitations with manager role are created correctly

## Future Work (Separate PR)

The following feature was discussed but deferred to a separate PR:
- **Simplify team invitations**: Remove separate team invitation system. When inviting to team, auto-invite to organization first (if not member), then add to team. Only organization-level invitations needed.

## Usage Example

### Inviting a Manager via Dashboard:
1. Navigate to Organization > Members
2. Click "Invite Member"
3. Enter email address
4. Select "Manager" from role dropdown
5. Click "Add"

### Manager can then:
- Go to Teams section
- Create new teams
- Add existing organization members to teams
- Manage team resources

### Manager cannot:
- Invite new members to the organization (will see "Invite Member" button disabled or hidden)

## Verification

To verify the implementation:

```bash
# Backend - Check schema
cd packages/castmill
grep -A2 "field :role" lib/castmill/organizations/organizations_users.ex
grep -A2 "field :role" lib/castmill/organizations/organizations_invitations.ex

# Frontend - Check type
cat packages/dashboard/src/types/organization-role.type.ts

# Check translations
cd packages/dashboard
node scripts/check-missing-translations.cjs
```

## Notes

- Translation coverage: 99.7% (2 cognates flagged as "untranslated" - false positives)
  - Spanish "Regular" (same in English and Spanish)
  - German "Manager" (same in English and German)
- These are valid translations and can be ignored
