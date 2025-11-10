# ⚠️ Important Notes and Warnings

## 🚨 Critical: `vibe-sdk-unchanged/` Directory

### **NEVER MODIFY FILES IN `vibe-sdk-unchanged/` DIRECTORY**

The `vibe-sdk-unchanged/` folder is **READ-ONLY** and exists for the following purposes only:

1. **Reference**: Compare original codebase with modified codebase
2. **Debugging**: Identify what changed when debugging issues
3. **Verification**: Ensure no breaking changes were introduced
4. **Documentation**: Understand original implementation patterns

### Rules:

- ❌ **NEVER** edit, modify, or delete files in `vibe-sdk-unchanged/`
- ❌ **NEVER** commit changes to files in `vibe-sdk-unchanged/`
- ✅ **ALWAYS** make all changes in the main `vibesdk/` directory
- ✅ **USE** `vibe-sdk-unchanged/` only for reading/comparison
- ✅ **COMPARE** your changes with original files before committing

### Why This Matters:

- Preserves original codebase for comparison
- Enables easy rollback if needed
- Helps identify unintended changes
- Maintains a clean reference point for debugging
- Ensures original functionality remains intact

### When to Use `vibe-sdk-unchanged/`:

1. **Before Making Changes**: Read original file to understand structure
2. **During Debugging**: Compare modified file with original
3. **After Changes**: Verify no breaking changes were introduced
4. **When Stuck**: Reference original implementation patterns

### Example Workflow:

```bash
# ✅ CORRECT: Read original file for reference
cat vibe-sdk-unchanged/worker/database/database.ts

# ✅ CORRECT: Edit file in main directory
vim vibesdk/worker/database/database.ts

# ❌ WRONG: Never edit original
vim vibe-sdk-unchanged/worker/database/database.ts  # DON'T DO THIS!
```

## 🚨 Critical: `qikai-templates/` Directory

### **ONLY MODIFY WHEN WORKING WITH TEMPLATES**

The `qikai-templates/` folder contains template files used for application code generation. This folder should **ONLY** be modified when:

1. **Adding Templates**: Creating new application templates
2. **Updating Templates**: Modifying existing template structures
3. **Template Logic**: Changing how templates are generated or used

### Rules:

- ✅ **MODIFY** files in `qikai-templates/` when working on templates
- ❌ **NEVER** modify this folder for deployment logic or configuration changes
- ✅ **REFERENCE** this folder to understand template structure
- ❌ **DON'T** use this folder for deployment-related code changes
- ✅ **SEPARATE** template changes from deployment implementation

### Directory Structure:

- **Main Code**: `vibesdk/` - All deployment and application logic
- **Reference Code**: `vibe-sdk-unchanged/` - Read-only reference (NEVER modify)
- **Templates**: `qikai-templates/` - Template files (modify only for templates)
- **Documentation**: `docs/gcp-support/` - All GCP documentation

### When to Use `qikai-templates/`:

1. **Template Development**: Adding or modifying application templates
2. **Template Structure**: Understanding how templates are organized
3. **Code Generation**: Modifying template generation logic
4. **NOT for**: Deployment configuration, deployment logic, or runtime code

### Example Workflow:

```bash
# ✅ CORRECT: Modify templates in templates directory
vim qikai-templates/templates/react-app/template.json

# ✅ CORRECT: Modify deployment logic in main directory
vim vibesdk/worker/services/sandbox/sandboxSdkClient.ts

# ❌ WRONG: Don't modify templates for deployment changes
vim qikai-templates/worker/services/deployer/appengine-yaml-generator.ts  # DON'T DO THIS!
```

## 📋 Other Important Notes

### Code Organization

- **Main Directory**: `vibesdk/` - All modifications go here
- **Reference Directory**: `vibe-sdk-unchanged/` - Read-only reference (NEVER modify)
- **Templates Directory**: `qikai-templates/` - Template files (modify only for templates)
- **Documentation**: `docs/gcp-support/` - All GCP documentation

### Deployment Targets

- **Default**: App Engine (if `DEFAULT_DEPLOYMENT_TARGET` not set)
- **Cloudflare**: Set `DEFAULT_DEPLOYMENT_TARGET=cloudflare`
- **Both Must Work**: Never break existing Cloudflare deployment

### Testing Requirements

- ✅ Test Cloudflare deployment after any changes
- ✅ Test GCP deployment after any changes
- ✅ Compare behavior with original codebase
- ✅ Verify no breaking changes introduced

## 🔗 Related Documentation

- [Rules](./rules.md) - Detailed rules including this one
- [Architecture](./architecture.md) - Architecture reference
- [Implementation Summary](./implementation-summary.md) - What was changed

