# Backend RBAC Overview

## Summary
Castmill uses a centralized role-based access control (RBAC) matrix to govern what authenticated users can do inside an organization. The matrix lives in `packages/castmill/lib/castmill/authorization/permissions.ex` and is surfaced through helper modules so controllers and services do not need to duplicate authorization checks.

| Role  | Content (playlists/medias/channels/devices) | Teams | Widgets |
|-------|---------------------------------------------|-------|---------|
| admin | Full CRUD                                   | Full CRUD | Full CRUD |
| manager | Full CRUD                                | Full CRUD | Full CRUD |
| member | Full CRUD                                 | Read-only | Read-only |
| guest | Read-only                                  | None      | Read-only |

> **Terminology note:** the role now called **member** replaced the legacy **regular** role. Legacy documentation files were renamed to `MEMBER_USER_ACCESS_FIX*.md` to preserve the historical debugging context.

## Key Modules
- `Castmill.Authorization.Permissions`
  - Pure functions around the permission matrix (`can?/3`, `allowed_actions/2`, `accessible_resources/1`).
- `Castmill.Authorization.ResourceAccess`
  - Convenience layer that looks up the caller’s organization role and proxies to the permission matrix.
- `Castmill.Organizations.has_access/4`
  - Entry point used by controllers; normalizes resource/action names and falls back to legacy overrides when needed.
- `CastmillWeb.ResourceController` & addon controllers
  - Call `check_access/3` which delegates to `AuthorizeDash` → `Organizations.has_access/4`.

## Request Flow
1. Dashboard/API request hits a controller using `CastmillWeb.AccessActorBehaviour`.
2. `AuthorizeDash` plug inspects the current actor and calls `controller.check_access/3`.
3. `check_access/3` delegates to `Organizations.has_access/4`.
4. `has_access/4` resolves the user’s role, converts resource/action into atoms, and queries `Permissions.can?/3`.
5. If the matrix does not cover a case, it falls back to explicit database grants (`organizations_users_access`).

The full walkthrough of this flow, including the fix that unlocked member users, is documented in `MEMBER_USER_ACCESS_FIX.md` and its companion visual guide.

## Tests You Can Trust
- `packages/castmill/test/castmill/authorization/permissions_test.exs`
- `packages/castmill/test/castmill/authorization/resource_access_test.exs`
- `packages/castmill/test/castmill_web/controllers/resource_controller/*_test.exs`

When updating RBAC behavior, add or adjust tests in those suites to avoid regressions.

## Related Documentation
- `AUTHORIZATION_IMPLEMENTATION_SUMMARY.md`
- `GENERIC_RESOURCE_AUTHORIZATION_GUIDE.md`
- `MEMBER_USER_ACCESS_FIX.md`
- `MEMBER_USER_ACCESS_FIX_VISUAL.md`

These files contain the authoritative details about the permission matrix, migration notes, and debugging history. Keep them in sync whenever the RBAC rules change.
