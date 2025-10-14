# Castmill Agent Documentation

This directory contains comprehensive technical documentation specifically designed for AI agents, automated tools, and other intelligent systems working with the Castmill monorepo. The documentation is organized hierarchically to handle the complexity of multiple packages and interconnected systems.

## 🏗️ Directory Structure

```
agents/
├── README.md                    # This index file
├── packages/                    # Package-specific documentation
│   ├── website/                # Documentation website (Docusaurus)
│   │   ├── SOCIAL-CARDS.md    # Social media cards system
│   │   ├── BUILD-SYSTEM.md    # Build pipeline and automation
│   │   └── THEME-SYSTEM.md    # Custom theming architecture
│   ├── castmill/              # Main Elixir/Phoenix backend
│   │   ├── API-ARCHITECTURE.md
│   │   └── DATABASE-SCHEMA.md
│   ├── player/                # Media player implementations
│   │   └── PLAYER-SYSTEMS.md
│   ├── dashboard/             # Management dashboard
│   │   └── DASHBOARD-ARCH.md
│   └── ui-common/             # Shared UI components
│       └── COMPONENT-SYSTEM.md
├── systems/                   # Cross-package system documentation
│   ├── AUTHENTICATION.md     # Auth across all packages
│   ├── MEDIA-PIPELINE.md     # Content processing pipeline
│   └── REAL-TIME-SYNC.md     # Real-time communication
└── infrastructure/           # Deployment and DevOps
    ├── DEPLOYMENT.md         # CI/CD and deployment strategies
    ├── MONITORING.md         # Logging and observability
    └── DOCKER-ARCHITECTURE.md
```

## 📋 Documentation Index

### Package Documentation

#### Website (`packages/website/`)
- **[SOCIAL-CARDS.md](./packages/website/SOCIAL-CARDS.md)** - Dynamic social media cards system with automated generation

#### Castmill Backend (`packages/castmill/`)
- **[RBAC.md](./packages/castmill/RBAC.md)** - Backend permission matrix, roles, and controller flow

#### Player Systems (`packages/player/`)
- *Coming soon: Player architecture, widget systems, platform integrations*

#### Dashboard (`packages/dashboard/`)  
- *Coming soon: Management interface, user workflows, admin features*

#### UI Common (`packages/ui-common/`)
- *Coming soon: Shared component library, design system*

### System Documentation

#### Cross-Package Systems (`systems/`)
- *Coming soon: Authentication, media pipeline, real-time synchronization*

#### Infrastructure (`infrastructure/`)
- *Coming soon: Deployment, monitoring, Docker architecture*

## 🎯 Documentation Standards

### When to Create AI Documentation

**✅ Create machine docs for:**
- Complex automated systems (build tools, generators, data pipelines)
- Multi-package integrations and shared systems  
- Custom plugins, extensions, or middleware
- Non-obvious architectural decisions
- Systems with multiple configuration options
- Cross-cutting concerns (auth, logging, caching)

**❌ Don't create machine docs for:**
- Simple component implementations
- Standard configuration files
- Basic styling or content changes
- Single-purpose utility functions

### File Naming & Organization

- **Packages**: Place docs in `packages/{package-name}/FEATURE.md`
- **Systems**: Place cross-package docs in `systems/SYSTEM-NAME.md`  
- **Infrastructure**: Place DevOps docs in `infrastructure/TOPIC.md`
- **Naming**: Use ALL-CAPS with hyphens: `SOCIAL-CARDS.md`, `API-ARCHITECTURE.md`

### Content Structure Template

```markdown
# System Name

## Overview
Brief description of what this system does and why it exists.

## Architecture  
Technical implementation details, key components, data flow.

## Integration Points
How it connects with other packages/systems in the monorepo.

## Configuration
Settings, options, environment variables, build-time config.

## API/Interface
Public APIs, hooks, events, or interfaces other systems use.

## File Structure
Key files and directories, what they contain.

## Dependencies
External libraries, internal package dependencies.

## Build/Deploy
How it's built, tested, and deployed.

## Troubleshooting
Common issues, debugging approaches, known limitations.

## Future Considerations
Planned improvements, technical debt, scaling concerns.
```

## 🤖 Machine Usage Guidelines

### For AI Assistants Working on Castmill:

1. **Start Here** - Always check this index first to understand the system landscape
2. **Follow the Hierarchy** - Look for package-specific docs before creating new ones
3. **Cross-Reference** - Check systems/ docs for cross-package concerns
4. **Update Index** - When adding new docs, update this README
5. **Maintain Consistency** - Follow established patterns and architectural principles

### Navigation Tips:

- **Package-specific changes**: Check `packages/{name}/` first
- **Cross-package features**: Look in `systems/` 
- **Deployment issues**: Check `infrastructure/`
- **New features**: Review existing patterns in related docs

## 🚀 Contributing New Documentation

1. **Determine Category**: Package-specific, system-wide, or infrastructure?
2. **Follow Template**: Use the content structure above
3. **Update Index**: Add entry to this README with description
4. **Cross-Reference**: Link to related documentation
5. **Include Examples**: Provide code samples and configuration examples

## 📊 Current Status

| Package | Documentation Status | Priority |
|---------|---------------------|----------|
| website | ✅ Social Cards | Complete |
| castmill | 🟡 In Progress | High |
| player | ⭕ Planned | Medium |
| dashboard | ⭕ Planned | Medium |
| ui-common | ⭕ Planned | Low |

| System | Documentation Status | Priority |
|--------|---------------------|----------|
| Authentication | ⭕ Planned | High |
| Media Pipeline | ⭕ Planned | High |
| Real-time Sync | ⭕ Planned | Medium |

| Infrastructure | Documentation Status | Priority |
|----------------|---------------------|----------|
| Deployment | ⭕ Planned | High |
| Monitoring | ⭕ Planned | Medium |
| Docker | ⭕ Planned | Low |

---

*This documentation system ensures comprehensive technical context is preserved and accessible for future machine assistance across the entire Castmill monorepo.*
