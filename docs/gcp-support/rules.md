# GCP Support Decision Rules

This document defines the rules and criteria for determining when to use GCP App Engine vs Cloudflare Workers deployment, and how to implement changes without affecting existing functionality.

## 🎯 Deployment Target Selection Rules

### Rule 1: Default Deployment Target
- **Default**: `app_engine` (for static frontend deployments)
- **Override**: Set `DEFAULT_DEPLOYMENT_TARGET` environment variable to `'cloudflare'` or `'app_engine'`
- **Location**: `worker/config/deployment-config.ts`

### Rule 2: Static Frontend Applications
- **Use GCP App Engine** when:
  - Application is frontend-only (React, Vue, etc.)
  - No Cloudflare-specific features required (KV, D1, Durable Objects)
  - Platform-independent code generation is desired
  - PostgreSQL-based backend is preferred

- **Use Cloudflare Workers** when:
  - Application requires Cloudflare-specific features
  - Edge computing is needed
  - Existing Cloudflare infrastructure is in use

### Rule 3: Backend Applications
- **Current Status**: Not yet implemented (Phase 2)
- **Future Rule**: Will be defined based on backend requirements

## 🏗️ Architecture Decision Rules

### Rule 4: Code Organization
- **Shared Utilities**: Place in `worker/services/deployer/appengine-yaml-generator.ts`
- **Deployment Logic**: Keep in `worker/services/sandbox/sandboxSdkClient.ts`
- **Configuration**: Centralize in `worker/config/deployment-config.ts`
- **Types**: Define in `worker/services/deployer/types.ts` (if needed)

### Rule 5: File Structure
```
worker/
├── services/
│   ├── deployer/
│   │   ├── appengine-yaml-generator.ts  # Shared YAML generation
│   │   ├── appengine-deployer.ts        # Placeholder/interface
│   │   └── deploy.ts                    # Cloudflare deployment
│   └── sandbox/
│       └── sandboxSdkClient.ts          # Actual deployment execution
├── config/
│   └── deployment-config.ts             # Deployment target selection
└── agents/
    └── core/
        └── simpleGeneratorAgent.ts       # Agent integration
```

### Rule 6: No Breaking Changes
- **NEVER modify** files in `vibe-sdk-unchanged/` directory
  - This folder is **READ-ONLY** and exists only for reference purposes
  - Used for comparison with original codebase to ensure no breaking changes
  - Used for debugging when issues arise
  - All modifications must be made in the main `vibesdk/` directory only
- **Always extend** existing functionality, don't replace
- **Maintain backward compatibility** with Cloudflare deployment
- **Test both paths** when making changes
- **Compare with original**: When in doubt, compare your changes with files in `vibe-sdk-unchanged/` to ensure compatibility

## 🔧 Implementation Rules

### Rule 7: Adding New Deployment Features
1. **Check Rules First**: Review this file and `architecture.md`
2. **Update Configuration**: Modify `deployment-config.ts` if needed
3. **Extend, Don't Replace**: Add new methods, don't modify existing ones
4. **Update Documentation**: Add changes to relevant docs in this folder
5. **Test Both Paths**: Verify Cloudflare and GCP deployments work

### Rule 8: Environment Variables
- **GCP Variables**: All prefixed with `GOOGLE_` or `GCP_`
- **Cloudflare Variables**: Keep existing naming (no changes)
- **Shared Variables**: Use generic names (e.g., `DEFAULT_DEPLOYMENT_TARGET`)
- **Documentation**: Always update `environment-variables.md`

### Rule 9: Service Name Generation
- **Always use** `generateShortServiceName()` from `appengine-yaml-generator.ts`
- **Never hardcode** service names
- **Ensure uniqueness** via hash-based suffix
- **Respect limits**: Max 63 characters for App Engine

### Rule 10: Build Output Path
- **Current**: `dist/client/` (for React/Vite builds)
- **Check First**: Verify build output location before deployment
- **Update YAML**: Modify `generateStaticAppYaml()` if path changes
- **Document**: Update architecture.md with path changes

## 🚫 Anti-Patterns (What NOT to Do)

### ❌ Don't:
1. **Duplicate Code**: Use shared utilities from `appengine-yaml-generator.ts`
2. **Modify Original Files**: **NEVER** modify files in `vibe-sdk-unchanged/` directory
   - This folder is **READ-ONLY** and exists only for reference
   - Used for comparison, debugging, and ensuring no breaking changes
   - Any modifications to original files must be made in the main `vibesdk/` directory
3. **Hardcode Paths**: Always use configuration or environment variables
4. **Skip Testing**: Always test both Cloudflare and GCP paths
5. **Break Existing Flow**: Cloudflare deployment must continue working

### ✅ Do:
1. **Use Shared Utilities**: Import from centralized modules
2. **Extend Functionality**: Add new methods/classes, don't modify existing ones
3. **Follow Patterns**: Match existing code style and patterns
4. **Document Changes**: Update relevant docs in this folder
5. **Maintain Compatibility**: Ensure backward compatibility

## 📋 Checklist for New Features

Before implementing any GCP-related feature:

- [ ] Reviewed `rules.md` and `architecture.md`
- [ ] Identified which deployment target(s) are affected
- [ ] Checked if shared utilities exist or need creation
- [ ] Verified no breaking changes to Cloudflare flow
- [ ] **Compared with original**: Checked `vibe-sdk-unchanged/` folder for reference (READ-ONLY)
- [ ] Updated relevant documentation
- [ ] Added environment variables to `environment-variables.md`
- [ ] Tested both deployment paths (if applicable)
- [ ] **Verified**: No files in `vibe-sdk-unchanged/` were modified

## 🔍 Decision Tree

```
Start: Need to add deployment feature?
│
├─ Is it platform-specific?
│  ├─ Yes → Cloudflare-specific?
│  │  ├─ Yes → Add to Cloudflare deployment only
│  │  └─ No → Add to GCP deployment only
│  │
│  └─ No → Platform-agnostic?
│     └─ Yes → Add to both, use shared utilities
│
└─ Does it affect existing flow?
   ├─ Yes → Extend, don't replace
   └─ No → Add new method/class
```

## 📝 Change Log

When making changes, update this section:

- **2024-XX-XX**: Initial rules document created
- **2024-XX-XX**: Phase 1 (static frontend) rules defined

