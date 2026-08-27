/**
 * Team role type - roles within a specific team (Castmill 2.0)
 * - admin: Team administrator, can manage team members and resources
 * - member: Regular team member, can access team resources
 * - installer: Temporary role for device registration (24h expiration tokens)
 *
 * Note: This is different from OrganizationRole
 */
export type TeamRole = 'admin' | 'member' | 'installer';
