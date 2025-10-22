# Organization Logo Feature

## Overview
This feature allows organizations to upload and display a custom logo that will be shown in the dashboard's topbar, making it easier for users working with multiple organizations to identify which organization they're currently in.

## Implementation Details

### Backend (Elixir/Phoenix)

1. **Database Migration** (`20251014000001_add_logo_to_organizations.exs`)
   - Added `logo_media_id` field to the `organizations` table
   - Field references the `medias` table with `on_delete: :nilify_all` 
   - Created index on `logo_media_id` for performance

2. **Organization Schema** (`lib/castmill/organizations/organization.ex`)
   - Added `belongs_to(:logo_media, Castmill.Resources.Media, ...)`
   - Updated changeset to accept `logo_media_id` in cast fields

3. **Media Deletion Protection** (`lib/castmill/resources.ex`)
   - Modified `delete_media/1` to check if media is being used as an organization logo
   - Returns `{:error, :media_in_use_as_logo}` when attempting to delete a logo media
   - Controller returns HTTP 409 Conflict with appropriate error message

### Frontend (TypeScript/SolidJS)

1. **Organization Interface** (`src/interfaces/organization.ts`)
   - Added optional `logo_media_id?: string` field

2. **Logo Settings Component** (`src/pages/organization-page/logo-settings.tsx`)
   - Modal-based media selector for choosing organization logo
   - Displays current logo with preview
   - Filters medias to show only images
   - Allows removing logo
   - Updates organization via API

3. **Organization Page Integration** (`src/pages/organization-page/organization-page.tsx`)
   - Added LogoSettings component to organization settings
   - Tracks logo media ID state
   - Respects user permissions (disabled if user can't update organization)

4. **Topbar Display** (`src/components/topbar/topbar.tsx`)
   - Fetches and displays organization logo when available
   - Shows logo next to Castmill logo with separator
   - Automatically updates when organization changes
   - Responsive design with max dimensions

### Internationalization (i18n)

Added translations in all 9 supported languages (en, es, sv, de, fr, zh, ar, ko, ja):
- `organization.logo` - "Logo"
- `organization.logoSettings` - "Logo Settings"
- `organization.selectLogo` - "Select Logo"
- `organization.removeLogo` - "Remove Logo"
- `organization.logoDescription` - Description text
- `organization.logoUpdated` - Success message
- `organization.logoRemoved` - Removal success message
- `organization.noLogo` - No logo placeholder text
- `organization.noMediasAvailable` - Empty state message
- `organization.errors.loadMedias` - Error message
- `organization.errors.mediaInUseAsLogo` - Deletion prevention message

## Usage

### Setting an Organization Logo

1. Navigate to the Organization settings page (sidebar > Organization)
2. Scroll to the "Logo Settings" section
3. Click "Select Logo" button
4. Choose an image from your uploaded medias
5. Click "Save" to apply the logo

### Removing an Organization Logo

1. Navigate to the Organization settings page
2. In the "Logo Settings" section, click "Remove Logo"
3. Logo will be removed immediately

### Viewing the Logo

- The organization logo appears in the topbar next to the Castmill logo
- A vertical separator divides the two logos
- The logo updates automatically when switching organizations
- Maximum dimensions: 3em height, 10em width (scales to fit)

## API Endpoints Used

- `PUT /dashboard/organizations/:id` - Update organization with logo_media_id
- `GET /dashboard/organizations/:id/medias` - List medias for logo selection
- `GET /dashboard/organizations/:id/medias/:media_id` - Fetch specific media details
- `DELETE /dashboard/organizations/:id/medias/:media_id` - Protected deletion (returns 409 if used as logo)

## Permissions

- Requires `organizations:update` permission to change logo
- Logo settings UI is disabled for users without update permissions
- Logo is visible to all members of the organization

## Technical Notes

- Logo media is fetched reactively when organization changes
- Uses thumbnail URI if available, falls back to main file URI
- Only image mimetypes are shown in the logo selector
- Proper error handling for network failures and missing media
- Clean cascade deletion (logo_media_id set to null if media is deleted via other means)
