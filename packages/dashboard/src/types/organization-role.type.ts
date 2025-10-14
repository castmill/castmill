// Castmill 2.0 Organization Roles
// - admin: Full access including org management
// - manager: Elevated access, can manage teams
// - member: Standard user (default), can manage content
// - editor: Full CRUD on content, cannot manage teams/org
// - publisher: Like editor + publish action for workflow
// - device_manager: Full device/channel management
// - guest: Read-only access
export type OrganizationRole =
  | 'admin'
  | 'manager'
  | 'member'
  | 'editor'
  | 'publisher'
  | 'device_manager'
  | 'guest';
