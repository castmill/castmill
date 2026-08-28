# AI Documentation Directory

This directory contains technical documentation specifically designed for AI assistants and automated tools working with the Castmill documentation website. These documents provide deep technical context, implementation details, and architectural guidance that help AIs understand and maintain the codebase effectively.

## Purpose

AI-specific documentation serves several key purposes:

1. **Context Preservation** - Maintains detailed technical context about design decisions, architecture, and implementation details
2. **Future Maintenance** - Enables AI assistants to make informed decisions about updates and improvements
3. **Consistency** - Ensures AI-driven changes align with existing patterns and architectural principles
4. **Onboarding** - Provides comprehensive technical foundation for new AI assistants working on the project

## Documentation Standards

### File Naming Convention
- Use descriptive, hyphenated names: `SOCIAL-CARDS.md`, `BUILD-SYSTEM.md`
- Include version dates when documenting major changes
- Use ALL-CAPS for file names to distinguish from regular docs

### Content Structure
Each AI documentation file should include:

1. **System Overview** - High-level description of the feature/system
2. **Technical Architecture** - Detailed implementation details
3. **Integration Points** - How it connects with other systems
4. **Configuration** - Settings, options, and customization points
5. **Troubleshooting** - Common issues and debugging approaches
6. **Future Considerations** - Planned improvements or known limitations

### When to Create AI Documentation

Create AI documentation when:
- ✅ Implementing complex automated systems (build tools, generators, etc.)
- ✅ Creating intricate integrations between multiple technologies
- ✅ Building custom plugins or extensions
- ✅ Establishing patterns that should be consistent across the codebase
- ✅ Solving non-obvious technical challenges
- ✅ Creating systems with multiple configuration options

Don't create AI documentation for:
- ❌ Simple component implementations
- ❌ Standard configuration files
- ❌ Basic styling changes
- ❌ Content updates

## Current Documentation

| File | Purpose | Last Updated |
|------|---------|--------------|
| [SOCIAL-CARDS.md](./SOCIAL-CARDS.md) | Dynamic social media cards system | 2025-09-27 |

## Future Documentation Candidates

As the project grows, consider creating AI documentation for:

- **BUILD-SYSTEM.md** - Comprehensive build pipeline and automation
- **DEPLOYMENT.md** - GitHub Pages deployment and CI/CD processes  
- **SEARCH-SYSTEM.md** - Local search implementation and optimization
- **THEME-SYSTEM.md** - Custom theming and design system architecture
- **PLUGIN-ARCHITECTURE.md** - Guidelines for creating Docusaurus plugins
- **CONTENT-MANAGEMENT.md** - Documentation content organization and automation
- **TESTING-STRATEGY.md** - Testing approaches for documentation sites
- **PERFORMANCE.md** - Optimization strategies and performance monitoring

## Usage Guidelines for AIs

When working with Castmill documentation website:

1. **Always check this directory first** for relevant technical context
2. **Refer to existing patterns** documented here when implementing new features
3. **Update documentation** when making significant architectural changes
4. **Follow established conventions** outlined in these documents
5. **Consider future maintainability** as described in the documentation

## Contributing

When adding new AI documentation:

1. Follow the content structure outlined above
2. Include comprehensive technical details
3. Document integration points and dependencies
4. Provide troubleshooting guidance
5. Update this README with the new file reference

---

*This directory helps ensure consistent, informed AI assistance for the Castmill documentation website project.*
