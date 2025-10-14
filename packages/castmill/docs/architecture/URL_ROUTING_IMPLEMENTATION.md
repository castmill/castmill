# URL-Based Routing Implementation

## Summary

This document describes the implementation of URL-based routing with organization context in the Castmill Dashboard.

## Problem Statement

Prior to this implementation, the Dashboard had issues with organization switching:
- Organization selection was not persisted across page refreshes
- Data did not reload when switching between organizations
- Addon pages (Playlists, Medias, Devices) showed stale data after organization changes
- Deep linking to organization-specific pages was not possible

## Solution Overview

Implemented comprehensive URL-based routing where all authenticated routes include the organization ID as a URL parameter (`/org/:orgId/path`).

## Key Changes

### 1. Route Structure

Changed from:
```
/teams
/content/playlists
```

To:
```
/org/:orgId/teams
/org/:orgId/content/playlists
```

**Files Modified:**
- `packages/dashboard/src/index.tsx` - Route definitions updated

### 2. ProtectedRoute Synchronization

Added `createEffect` in `ProtectedRoute` component to sync URL parameters to the global store:

```tsx
createEffect(() => {
  const urlOrgId = params.orgId;
  if (store.organizations.loaded && urlOrgId && urlOrgId !== store.organizations.selectedId) {
    const org = store.organizations.data.find(o => o.id === urlOrgId);
    if (org) {
      setStore('organizations', {
        selectedId: org.id,
        selectedName: org.name,
      });
    }
  }
});
```

**Files Modified:**
- `packages/dashboard/src/components/protected-route.tsx`

### 3. Navigation Updates

Updated all navigation to include organization ID:

```tsx
// Organization dropdown
navigate(`/org/${newOrgId}${currentPath}`);

// Sidebar links
<PanelItem to={`/org/${store.organizations.selectedId}/teams`} />

// Addon links
<PanelItem to={`/org/${orgId}${addon.mount_path}`} />
```

**Files Modified:**
- `packages/dashboard/src/components/sidepanel/sidepanel.tsx`

### 4. Root Redirect

Implemented redirect from `/` to first organization:

```tsx
const RootRedirect: Component = () => {
  const navigate = useNavigate();
  
  createEffect(() => {
    if (store.organizations.loaded && store.organizations.data.length > 0) {
      const firstOrg = store.organizations.data[0];
      navigate(`/org/${firstOrg.id}/`, { replace: true });
    }
  });
  
  return <div>{t('common.loading')}</div>;
};
```

**Files Modified:**
- `packages/dashboard/src/index.tsx`

### 5. Addon Component Remounting

**Critical Fix**: SolidJS Router doesn't remount components when route params change. Solution uses `Show` with `keyed` attribute:

```tsx
const KeyedComponent = (props: any) => {
  const params = useParams();
  return (
    <Show when={params.orgId} keyed>
      {(orgId) => {
        const Component = wrapLazyComponent(addon);
        return <Component {...props} key={orgId} />;
      }}
    </Show>
  );
};

<Route path={addon.mount_path} component={KeyedComponent} />
```

This forces the addon component to **unmount and remount** when the organization ID changes, ensuring fresh data loads.

**Files Modified:**
- `packages/dashboard/src/index.tsx`

### 6. Store Structure for i18n

Added i18n functions to the store interface to support addon components:

```typescript
interface CastmillStore {
  // ... existing fields
  i18n?: {
    t: (key: string, params?: Record<string, any>) => string;
    tp: (key: string, count: number, params?: Record<string, any>) => string;
    formatDate: (date: Date, format?: string) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatCurrency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
    locale: () => string;
    setLocale: (locale: any) => void;
  };
}
```

i18n functions are set using `setStore()` in the addon wrapper:

```tsx
setStore('i18n', {
  t: i18n.t,
  tp: i18n.tp,
  formatDate: i18n.formatDate,
  // ... other functions
});
```

**Files Modified:**
- `packages/dashboard/src/store/store.tsx`
- `packages/dashboard/src/index.tsx`

### 7. Data Reloading

**Dashboard Core Pages** (Teams, Channels, Usage):
- Use `createEffect` with `on()` helper to watch `store.organizations.selectedId`
- Reload data when organization changes

**Addon Pages** (Playlists, Medias, Devices):
- Component remounts when organization changes (due to `keyed Show`)
- `onMount()` loads fresh data automatically
- `createEffect` pattern included as fallback

**Files Modified:**
- `packages/dashboard/src/pages/channels-page/channels-page.tsx`
- `packages/dashboard/src/pages/usage-page/usage-page.tsx`
- `packages/castmill/lib/castmill/addons/playlists/components/index.tsx`
- `packages/castmill/lib/castmill/addons/medias/components/index.tsx`
- `packages/castmill/lib/castmill/addons/devices/components/index.tsx`

## Technical Challenges Solved

### Challenge 1: Reactivity Across Component Boundaries

**Problem**: Passing the store as a prop to addon components broke reactivity. Store changes weren't detected.

**Attempted Solutions**:
1. Object spread (`{...store, i18n}`) - broke reactivity (creates snapshot)
2. Proxy wrapper - broke SolidJS reactivity tracking
3. createMemo with object spread - same issue as #1

**Final Solution**: 
- Pass store directly without wrapping
- Add i18n to store structure using `setStore()`
- Force component remounting with `Show keyed` instead of relying on reactivity

### Challenge 2: SolidJS Router Behavior

**Problem**: SolidJS Router keeps components mounted when route params change (e.g., `/org/abc/playlists` → `/org/xyz/playlists` stays on same route).

**Solution**: Use `Show` component with `keyed` attribute to force remounting when `params.orgId` changes.

### Challenge 3: Store Mutations

**Problem**: Attempted direct store mutation (`store.i18n = {...}`) caused "Cannot mutate a Store directly" warning.

**Solution**: Use `setStore()` for all store updates, including nested properties.

## Benefits

1. ✅ **Persistence**: Organization selection survives page refreshes
2. ✅ **Deep linking**: Can share URLs to specific organization pages
3. ✅ **Browser history**: Back/forward buttons work correctly
4. ✅ **Data consistency**: All pages reload data when switching organizations
5. ✅ **URL as source of truth**: No mismatch between URL and selected organization

## Testing Checklist

When testing organization-related features:

- [ ] URL changes when switching organizations
- [ ] Data reloads for new organization (check network requests)
- [ ] Page refresh maintains selected organization
- [ ] Browser back/forward buttons work correctly
- [ ] Deep links work (share URL to specific org's page)
- [ ] All navigation includes organization ID
- [ ] Addon pages remount and reload data

## Debugging Tips

If organization switching isn't working:

1. Check URL contains `/org/:orgId/` pattern
2. Verify `ProtectedRoute` `createEffect` syncs params to store
3. Confirm all `navigate()` calls include organization ID
4. For addons: Verify route uses `Show keyed` wrapper
5. Check `store.organizations.selectedId` updates when URL changes
6. Look for "Cannot mutate a Store directly" warnings (use `setStore`)
7. Add console.logs to track component mounting/unmounting

## Documentation Updated

- `packages/dashboard/AGENTS.md` - Added "URL-Based Routing & Organization Switching" section
- `AGENTS.md` (root) - Added URL routing section to main documentation
- `.github/copilot-instructions.md` - Added URL routing guidelines
- `URL_ROUTING_IMPLEMENTATION.md` (this file) - Implementation details

## Future Considerations

1. **Performance**: Component remounting is less efficient than reactive updates. If performance becomes an issue, consider:
   - Investigating why reactivity doesn't work across addon boundaries
   - Caching data per organization to reduce reload overhead

2. **Organization Validation**: Consider adding middleware to validate organization access before rendering pages

3. **Error Handling**: Add proper error handling for invalid organization IDs in URLs

4. **Analytics**: Track organization switching patterns to understand user behavior

## Related Issues

This implementation resolves the following user-reported issues:
- Data not reloading when switching organizations
- 403 Forbidden errors due to stale organization context
- Selected organization lost on page refresh
- Addon pages showing stale data after organization change

---

**Date**: 2025-10-09
**Author**: AI Assistant (with user collaboration)
**Status**: Implemented and Tested ✅
