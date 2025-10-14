# Missing Translations Found During Alert → Toast Migration

## Summary

During the merge from main, several hardcoded strings were found in toast messages that should be using translation keys. These were likely lost when converting from `alert()` calls to `toast` components.

## Files Modified

### 1. `/packages/dashboard/src/pages/teams-page/teams-invitations-view.tsx`

**Changes Made:**
- `toast.success(\`Invitation for \${invitation.email} removed successfully\`)` → `toast.success(t('teams.invitationRemovedSuccessfully', { email: invitation.email }))`
- `toast.success('Invitations removed successfully')` → `toast.success(t('teams.invitationsRemovedSuccessfully'))`
- `title={\`Remove Invitation From Team\`}` → `title={t('teams.removeInvitationFromTeam')}`
- `message={\`Are you sure...\`}` → `message={t('teams.confirmRemoveInvitation', { email: ... })}`
- `title={\`Remove members From Team\`}` → `title={t('teams.removeMembersFromTeam')}`
- `message={\`Are you sure...\`}` → `message={t('teams.confirmRemoveMembers')}`

### 2. `/packages/dashboard/src/pages/teams-page/teams-page.tsx`

**Changes Made:**
- `toast.success('Teams removed successfully')` → `toast.success(t('teams.teamsRemovedSuccessfully'))`

## Required Translation Keys

You need to add these keys to your i18n translation files:

```json
{
  "teams": {
    "invitationRemovedSuccessfully": "Invitation for {email} removed successfully",
    "invitationsRemovedSuccessfully": "Invitations removed successfully",
    "teamsRemovedSuccessfully": "Teams removed successfully",
    "removeInvitationFromTeam": "Remove Invitation From Team",
    "confirmRemoveInvitation": "Are you sure you want to remove the invitation of member \"{email}\" from the team?",
    "removeMembersFromTeam": "Remove members From Team",
    "confirmRemoveMembers": "Are you sure you want to remove the following members from the team?"
  }
}
```

## Additional Findings

While examining the codebase, I also found other hardcoded strings in toast messages that should be translated:

### Device Components (`/packages/castmill/lib/castmill/addons/devices/components/`)

**channels.tsx:**
- `'Failed to fetch device channels'`
- `'This channel is already assigned to the device.'`
- `'At least one channel must be assigned to the device.'`
- `'Channel removed successfully'`

**device-view.tsx:**
- `'Device updated successfully'`

**index.tsx:**
- `'Device "${device.name}" removed successfully'`
- `'${selectedDevices().size} device(s) removed successfully'`

**maintainance.tsx:**
- `'Command "${command}" sent successfully'`
- `'An error occurred while processing your request: ${error}'`

### Media Components (`/packages/castmill/lib/castmill/addons/medias/components/`)

**index.tsx:**
- `'Media "${resource.name}" removed successfully'`
- `'${selectedMedias().size} media(s) removed successfully'`

**upload.tsx:**
- `'No supported files found in the dropped files.'`

### Playlist Components (`/packages/castmill/lib/castmill/addons/playlists/components/`)

**index.tsx:**
- `'Playlist "${resource.name}" removed successfully'`
- `'${selectedPlaylists().size} playlist(s) removed successfully'`
- `'Playlist "${name}" created successfully'`

## Recommendations

1. **Immediate Action**: Add the translation keys listed above to your i18n files for the teams functionality.

2. **Follow-up**: Consider creating a comprehensive audit of all hardcoded strings in toast messages and replace them with proper translation keys.

3. **Pattern**: Follow the existing pattern where success messages are under their respective module (e.g., `teams.`, `devices.`, `medias.`, etc.) and error messages are typically under `[module].errors.`.

## Location of i18n Files

Based on the imports (`import { useI18n } from '../../i18n'`), the i18n configuration should be in `/packages/dashboard/src/i18n/` directory. Look for files like:
- `index.ts` (main i18n configuration)
- `locales/en.json` or similar locale files
- Translation files in JSON or similar format

The translation keys should be added to these files to complete the migration from hardcoded strings to proper internationalization.