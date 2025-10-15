# Bug Fix: Undefined User Names in Multi-Select Deletion Dialog

## Issue
When multi-selecting users for deletion in the organization or team members pages, the confirmation dialog showed "- undefined" instead of the actual user names.

## Root Cause
The issue occurred because:

1. The `data()` signal only contains the current page of members (e.g., 10 items per page)
2. The `selectedMembers()` Set can contain user IDs from multiple pages
3. When displaying the confirmation dialog, the code tried to find selected members by looking them up in `data()`:
   ```tsx
   const member = data().find((d) => d.user_id === memberId);
   return <div>{`- ${member?.user.name}`}</div>;
   ```
4. If a user was selected on page 1, then the user navigated to page 2, `data()` would only contain page 2 members
5. The lookup would fail for the page 1 member, resulting in `member` being `undefined`
6. String interpolation with `undefined` outputs the literal text "undefined"

## Solution
Instead of relying on `data()` to look up member names, we now maintain a separate `selectedMembersMap` that stores the full member objects when they are selected:

### Changes Made

1. **Added selectedMembersMap signal** (in both organization-members-view.tsx and team-members-view.tsx):
   ```tsx
   const [selectedMembersMap, setSelectedMembersMap] = createSignal(
     new Map<string, { user: User; user_id: string }>()
   );
   ```

2. **Updated onRowSelect handler** to maintain the map:
   ```tsx
   const onRowSelect = (rowsSelected: Set<string>) => {
     const previousSelection = selectedMembers();
     setSelectedMembers(rowsSelected);
     
     // Update the map: remove deselected items, add newly selected items
     const newMap = new Map(selectedMembersMap());
     
     // Remove deselected members
     previousSelection.forEach((id) => {
       if (!rowsSelected.has(id)) {
         newMap.delete(id);
       }
     });
     
     // Add newly selected members from current data
     rowsSelected.forEach((memberId) => {
       if (!newMap.has(memberId)) {
         const member = data().find((d) => d.user_id === memberId);
         if (member) {
           newMap.set(memberId, member);
         }
       }
     });
     
     setSelectedMembersMap(newMap);
   };
   ```

3. **Updated confirmation dialog** to use the map directly:
   ```tsx
   {Array.from(selectedMembersMap().values()).map((member) => {
     return <div>{`- ${member.user.name}`}</div>;
   })}
   ```

4. **Clear the map** when deletion completes:
   ```tsx
   setSelectedMembersMap(new Map());
   ```

### Internationalization
Also added proper i18n keys for dialog titles and messages in all 9 supported languages:
- English (en)
- Spanish (es)
- German (de)
- French (fr)
- Swedish (sv)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)
- Arabic (ar)

Dialog titles and messages now use translation keys like:
- `organization.dialogs.removeMemberTitle`
- `organization.dialogs.removeMembersTitle`
- `teams.dialogs.removeMemberTitle`
- `teams.dialogs.removeMembersTitle`

## Files Changed
1. `packages/dashboard/src/pages/organization-page/organization-members-view.tsx`
2. `packages/dashboard/src/pages/teams-page/team-members-view.tsx`
3. All locale files in `packages/dashboard/src/i18n/locales/` (ar.json, de.json, en.json, es.json, fr.json, ja.json, ko.json, sv.json, zh.json)

## Testing
The fix can be manually tested by:
1. Navigate to an organization's users page
2. Select one or more users for deletion
3. Click the multi-delete button
4. Verify the confirmation dialog shows the actual user names, not "undefined"
5. Optionally: Select users on page 1, navigate to page 2, select more users, then delete - all names should appear correctly

The same test applies to team members pages.

## Impact
This fix ensures that user names are always displayed correctly in deletion confirmation dialogs, providing better UX and preventing confusion when removing multiple members from organizations or teams.
