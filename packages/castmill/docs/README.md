# Castmill Technical Documentation

This directory contains comprehensive technical documentation for the Castmill platform, designed for both developers and AI agents working on the codebase.

## 📚 Documentation Structure

### 🔐 Authorization & RBAC
**Location**: [`authorization/`](./authorization/)

Documentation about Castmill's role-based access control (RBAC) system, permissions, and authorization mechanisms.

#### Core Documentation
- **[RBAC Overview](./authorization/RBAC_OVERVIEW.md)** - Quick reference guide to backend RBAC system ⭐
  - Permission matrix summary
  - Key modules and request flow
  - Related documentation references
  
- **[Authorization Test Suite](./authorization/AUTHORIZATION_TEST_SUITE.md)** - Comprehensive test suite documentation for the permission matrix and RBAC system
  - Unit tests for permission matrix logic
  - Integration tests for resource access
  - Organizations module integration tests
  - Test coverage for all roles: admin, manager, member, guest

#### Implementation Guides
- **[Authorization Architecture Diagram](./authorization/AUTHORIZATION_ARCHITECTURE_DIAGRAM.md)** - Visual architecture overview
- **[Authorization Implementation Summary](./authorization/AUTHORIZATION_IMPLEMENTATION_SUMMARY.md)** - Implementation details and patterns
- **[Castmill 2.0 Permission System](./authorization/CASTMILL_2.0_PERMISSION_SYSTEM_IMPLEMENTATION.md)** - Version 2.0 permission system design
- **[Generic Resource Authorization Guide](./authorization/GENERIC_RESOURCE_AUTHORIZATION_GUIDE.md)** - Guide for implementing authorization on new resources

#### Role-Specific Documentation
- **[Manager Role Implementation](./authorization/MANAGER_ROLE_IMPLEMENTATION.md)** - Manager role design and implementation
- **[Member User Access Fix](./authorization/MEMBER_USER_ACCESS_FIX.md)** - Member role access control fixes
- **[Member User Access Fix Visual](./authorization/MEMBER_USER_ACCESS_FIX_VISUAL.md)** - Visual guide to member access fixes

#### Design & Planning
- **[RBAC Current State and Proposal](./authorization/RBAC_CURRENT_STATE_AND_PROPOSAL.md)** - Current state analysis and future proposals
- **[RBAC Implementation Issue](./authorization/RBAC_IMPLEMENTATION_ISSUE.md)** - Known issues and resolutions

### 🌐 API Documentation
**Location**: [`api/`](./api/)

REST API endpoint documentation and integration guides.

#### Permissions API
- **[Permissions Endpoint Guide](./api/PERMISSIONS_ENDPOINT_GUIDE.md)** - Complete API reference for the permissions endpoint
  - Endpoint specification and authentication
  - Request/response formats
  - HTTP status codes
  - Frontend integration examples
  - Caching strategies

- **[Permissions Endpoint Summary](./api/PERMISSIONS_ENDPOINT_SUMMARY.md)** - Implementation summary
  - What was added and why
  - Controller and router configuration
  - Test coverage details
  - Quick reference for developers

#### Frontend Integration
- **[Permissions Frontend Guide](./api/PERMISSIONS_FRONTEND_GUIDE.md)** - How to use permissions in frontend components
- **[Permissions Complete](./api/PERMISSIONS_COMPLETE.md)** - Complete permissions reference
- **[Permissions Implementation Summary](./api/PERMISSIONS_IMPLEMENTATION_SUMMARY.md)** - Implementation summary

### 🔌 AddOns & Extensions
**Location**: [`addons/`](./addons/)

Documentation for Castmill's modular addon system and widget development.

- **[Widget Icon Upload Guide](./addons/ICON-UPLOAD.md)** - How to add custom icons to widgets
  - Supported icon formats (Base64, URL, SVG)
  - Best practices for icon assets
  - Performance considerations
  - Examples and code snippets

### 🏗️ Architecture
**Location**: [`architecture/`](./architecture/)

System architecture, design patterns, and implementation strategies.

- **[URL Routing Implementation](./architecture/URL_ROUTING_IMPLEMENTATION.md)** - URL-based routing with organization context
  - Organization selection persistence
  - Deep linking support
  - State synchronization
  
- **[Team Filter URL Parameters](./architecture/TEAM_FILTER_URL_PARAMS_IMPLEMENTATION.md)** - URL synchronization for team filtering
  - Full URL synchronization
  - Shareable filtered views
  - Live-updating filters

### ⚡ Features
**Location**: [`features/`](./features/)

Feature-specific documentation and user guides.

- **[Credential Recovery](./features/CREDENTIAL_RECOVERY.md)** - Passkey-based authentication credential recovery
  - User flow
  - Security features
  - Implementation details

### 🧪 Testing
**Location**: [`testing/`](./testing/)

Test specifications, test patterns, and quality assurance documentation.

- **[Channels Component Test Spec](./testing/channels.test.md)** - Test specification for the Channels component
  - Test scenarios for channel management
  - Component integration testing
  - Service mocking patterns
  - Expected behaviors and assertions

- **[Organization Invitations Tests](./testing/organization-invitations-tests.md)** - Test documentation for organization invitations

- **[Test Coverage PR-82](./testing/TEST-COVERAGE-PR-82.md)** - Test coverage for multi-channel device assignment
  - Backend tests (Elixir)
  - Frontend tests (SolidJS)
  - Integration tests

### 📝 Miscellaneous
- **[Missing Translations](./MISSING_TRANSLATIONS.md)** - Tracking document for missing i18n translations

## 🎯 Quick Navigation

### For New Developers

#### Getting Started with RBAC
1. **Understanding RBAC**: Start with [Authorization Test Suite](./authorization/AUTHORIZATION_TEST_SUITE.md)
2. **Architecture Overview**: Read [Authorization Architecture Diagram](./authorization/AUTHORIZATION_ARCHITECTURE_DIAGRAM.md)
3. **Implementation Patterns**: Study [Generic Resource Authorization Guide](./authorization/GENERIC_RESOURCE_AUTHORIZATION_GUIDE.md)

#### API Integration
1. **Permissions API**: Start with [Permissions Endpoint Guide](./api/PERMISSIONS_ENDPOINT_GUIDE.md)
2. **Frontend Integration**: Read [Permissions Frontend Guide](./api/PERMISSIONS_FRONTEND_GUIDE.md)
3. **Implementation Summary**: Check [Permissions Implementation Summary](./api/PERMISSIONS_IMPLEMENTATION_SUMMARY.md)

#### Feature Development
1. **URL Routing**: Understand [URL Routing Implementation](./architecture/URL_ROUTING_IMPLEMENTATION.md)
2. **Team Filtering**: Learn about [Team Filter URL Parameters](./architecture/TEAM_FILTER_URL_PARAMS_IMPLEMENTATION.md)
3. **Widget Development**: See [Icon Upload Guide](./addons/ICON-UPLOAD.md)

### For AI Agents

The documentation in this directory provides essential context for:
- **Understanding permission checks and access control** - See [`authorization/`](./authorization/)
- **Implementing authorization-aware features** - Reference [`api/`](./api/) and [`authorization/`](./authorization/)
- **Working with the permissions API** - Study [`api/PERMISSIONS_ENDPOINT_GUIDE.md`](./api/PERMISSIONS_ENDPOINT_GUIDE.md)
- **Developing widgets and addons** - Explore [`addons/`](./addons/)
- **Writing comprehensive tests** - Review [`testing/`](./testing/)
- **Implementing new features** - Check [`features/`](./features/) and [`architecture/`](./architecture/)

**Key Reference**: See [`../AGENTS.md`](../AGENTS.md) for overall platform architecture and development patterns.

## 📋 Key Concepts

### Role-Based Access Control (RBAC)

Castmill implements a comprehensive RBAC system with four roles:

| Role | Access Level | Use Case |
|------|-------------|----------|
| **Admin** | Full access to all resources and actions | Organization owners, system administrators |
| **Manager** | Full access to all resources and actions | Team leaders, project managers |
| **Member** | CRUD on content resources, read-only on teams/widgets | Content creators, editors |
| **Guest** | Read-only access to content, no team access | Viewers, observers |

**Resources**: `playlists`, `medias`, `channels`, `devices`, `teams`, `widgets`

**Actions**: `list`, `show`, `create`, `update`, `delete`

### Organizations & Teams

- Users belong to **Organizations** with a specific role
- Organizations can have multiple **Teams**
- Permissions are organization-scoped
- The permission matrix is consulted before database queries

### Permission Flow

```
User Request → Authentication → Role Identification → Permission Matrix Check → Resource Access
```

## 🔍 Finding Information

### By Topic

- **Authorization/Permissions**: [`authorization/`](./authorization/) and [`api/`](./api/)
- **Widget Development**: [`addons/`](./addons/)
- **Testing Patterns**: [`testing/`](./testing/)

### By File Type

- **Implementation Guides**: Files ending in `_GUIDE.md`
- **Summaries**: Files ending in `_SUMMARY.md`
- **Test Specs**: Files ending in `.test.md`
- **Test Suites**: Files ending in `_TEST_SUITE.md`

## 🛠️ Contributing Documentation

When adding new technical documentation:

1. **Choose the right directory**:
   - `authorization/` - RBAC, permissions, access control
   - `api/` - REST endpoints, API contracts
   - `addons/` - Widget development, addon patterns
   - `testing/` - Test specs, testing patterns

2. **Follow naming conventions**:
   - Use UPPERCASE for major documentation files
   - Use descriptive names: `FEATURE_NAME_GUIDE.md`, `COMPONENT_TEST_SUITE.md`
   - Keep filenames concise but clear

3. **Include in this README**:
   - Add entry under the appropriate section
   - Provide brief description
   - Link to the new file

4. **Update AGENTS.md** if the documentation is critical for AI agents

## 📖 Related Documentation

- **[AGENTS.md](../AGENTS.md)** - Development guide for AI agents (platform architecture, i18n system, development patterns)
- **[README.md](../README.md)** - Main project README with setup instructions
- **[LICENSE.md](../LICENSE.md)** - Project license information

## 🔗 External Resources

- [Phoenix Framework Documentation](https://hexdocs.pm/phoenix/overview.html)
- [Elixir Documentation](https://elixir-lang.org/docs.html)
- [SolidJS Documentation](https://www.solidjs.com/docs/latest/api)

---

**Last Updated**: October 2025  
**Maintained By**: Castmill Team

For questions or suggestions about this documentation, please open an issue or submit a pull request.
