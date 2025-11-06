# Google Cloud Platform (GCP) Support Documentation

This directory contains all documentation, architecture references, and guidelines for GCP App Engine deployment support in VibeSDK.

## 📚 Documentation Structure

- **[README.md](./README.md)** - This file (overview and quick links)
- **[architecture.md](./architecture.md)** - Reference architecture for GCP deployment flow
- **[rules.md](./rules.md)** - Decision rules and criteria for deployment target selection
- **[phases.md](./phases.md)** - Implementation phases and roadmap
- **[environment-variables.md](./environment-variables.md)** - Required environment variables and setup
- **[decision-tree.md](./decision-tree.md)** - Quick decision guide for deployment target selection
- **[quick-start.md](./quick-start.md)** - 5-minute quick setup guide
- **[implementation-summary.md](./implementation-summary.md)** - High-level implementation summary
- **[original-plan.md](./original-plan.md)** - Original detailed implementation plan (Phase 1)
- **[IMPORTANT-NOTES.md](./IMPORTANT-NOTES.md)** - ⚠️ Critical warnings and important notes

## 🎯 Quick Start

1. **New to GCP Support?** Start with [quick-start.md](./quick-start.md) for 5-minute setup
2. **Planning Changes?** Check [decision-tree.md](./decision-tree.md) and [rules.md](./rules.md)
3. **Understanding Flow?** Read [architecture.md](./architecture.md) for detailed flow
4. **Implementing Features?** Review [phases.md](./phases.md) for the implementation roadmap
5. **Setting Up?** Follow [environment-variables.md](./environment-variables.md) for configuration

## 🔄 Current Status

- ✅ **Phase 1**: Static frontend deployment to App Engine (COMPLETED)
- ⏳ **Phase 2**: Backend API deployment (PLANNED)
- ⏳ **Phase 3**: Database and storage integration (PLANNED)
- ⏳ **Phase 4**: Full-stack application deployment (PLANNED)

## 📖 Key Principles

1. **Platform Independence**: Generated applications should be platform-agnostic
2. **No Breaking Changes**: GCP support must not affect existing Cloudflare functionality
3. **Consistent API**: Both deployment targets should use the same interfaces
4. **Single Source of Truth**: Configuration and utilities are centralized
5. **Documentation First**: All changes must be documented before implementation
6. **Original Code Reference**: The `vibe-sdk-unchanged/` folder is **READ-ONLY** and exists only for reference
   - Never modify files in this directory
   - Use it for comparison and debugging purposes
   - All changes must be made in the main `vibesdk/` directory

## 🚀 Getting Started Workflow

When starting new GCP-related work:

```
1. Read IMPORTANT-NOTES.md → ⚠️ Understand critical warnings
2. Read decision-tree.md → Determine if GCP is right choice
3. Check rules.md → Understand implementation rules
4. Review architecture.md → Understand current flow
5. Check phases.md → Verify feature is in scope
6. Review environment-variables.md → Ensure setup is complete
7. Compare with vibe-sdk-unchanged/ → Reference original code (READ-ONLY)
8. Start implementation → Follow rules and patterns
9. Update documentation → Document changes made
10. Verify → No files in vibe-sdk-unchanged/ were modified
```

## 📋 Documentation Maintenance

- **When Adding Features**: Update relevant docs in this folder
- **When Changing Flow**: Update `architecture.md`
- **When Adding Rules**: Update `rules.md`
- **When Completing Phases**: Update `phases.md`
- **When Adding Variables**: Update `environment-variables.md`

