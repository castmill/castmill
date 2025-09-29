# Agents Documentation Directory

This directory contains AI-optimized technical documentation for the Castmill monorepo. When working in this directory, you are maintaining documentation specifically designed for AI agents and automated tools.

## 📝 Documentation Standards

### Content Guidelines
- **Accuracy**: Information must reflect actual codebase state
- **Completeness**: Cover all major architectural decisions and patterns
- **Clarity**: Write for both human and machine understanding
- **Maintainability**: Update alongside code changes
- **Searchability**: Structure content for efficient agent navigation

### File Structure
- **README.md files**: Provide overviews and navigation for each directory
- **Specific guides**: Focus on particular systems, technologies, or processes
- **Cross-references**: Link related documentation across packages/systems

## 🎯 When Working on Agent Documentation

### Before Making Changes
1. **Understand the audience**: AI agents need different information than human developers
2. **Check current state**: Verify information is still accurate with codebase
3. **Maintain consistency**: Follow established patterns and terminology

### Content Focus Areas
- **Architecture overviews** - High-level system understanding
- **Common patterns** - Repeated architectural decisions
- **Integration points** - How systems connect and communicate
- **Build/test procedures** - Essential development workflows
- **Gotchas and pitfalls** - Known issues and their solutions

### Writing Style
- **Direct and factual**: Avoid marketing language or opinions
- **Structured information**: Use headings, lists, and tables for scannability
- **Actionable guidance**: Include specific commands, file paths, and procedures
- **Context-aware**: Explain why decisions were made, not just what they are

## 📋 Directory Organization

```
agents/
├── README.md                    # Main index and navigation
├── packages/                    # Package-specific deep documentation
│   ├── website/                 # Documentation site specifics
│   ├── castmill/               # Backend system details
│   ├── player/                 # Player architecture
│   └── [other-packages]/       # Additional package docs
├── systems/                     # Cross-cutting system documentation
│   ├── AUTHENTICATION.md       # Auth patterns across packages
│   ├── MEDIA-PIPELINE.md       # Content processing workflows
│   └── REAL-TIME-SYNC.md       # Real-time communication
└── infrastructure/             # DevOps and deployment
    ├── DEPLOYMENT.md           # CI/CD processes
    ├── MONITORING.md           # Observability setup
    └── DOCKER-ARCHITECTURE.md  # Container orchestration
```

## ✅ Quality Checklist

When updating documentation:
- [ ] Information is current and accurate
- [ ] Cross-references are updated
- [ ] Code examples work as written
- [ ] File paths and commands are correct
- [ ] Related documentation is consistent
- [ ] Changes reflect actual codebase state

## 🔄 Maintenance

This documentation should evolve with the codebase:
- **Update immediately** when making architectural changes
- **Review periodically** to ensure accuracy
- **Expand coverage** for new systems or patterns
- **Deprecate outdated** information promptly

Remember: This documentation serves as the "source of truth" for AI agents working with Castmill. Accuracy and completeness are critical for effective AI assistance.
