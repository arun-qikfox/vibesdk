# Disabled Features Tracker

This document tracks all features that were temporarily disabled during the migration to get the frontend build working with custom branding "qfx cloud app".

## Priority: Frontend First, Backend Later

**Current Status**: Frontend build in progress, backend services temporarily disabled
**Brand Name**: "qfx cloud app"

## Database Services (Temporarily Disabled)

### Core Database Services
- `worker/database/services/AppService.ts` - App management
- `worker/database/services/AuthService.ts` - Authentication
- `worker/database/services/UserService.ts` - User management
- `worker/database/services/SessionService.ts` - Session management
- `worker/database/services/AnalyticsService.ts` - Analytics
- `worker/database/services/BaseService.ts` - Base service class
- `worker/database/services/ModelConfigService.ts` - Model configuration
- `worker/database/services/ModelTestService.ts` - Model testing
- `worker/database/services/SecretsService.ts` - Secrets management
- `worker/database/services/ApiKeyService.ts` - API key management
- `worker/database/services/ModelProvidersService.ts` - Model providers

### Database Runtime
- `worker/database/runtime/factory.ts` - Database client factory
- `worker/database/runtime/postgresClient.ts` - PostgreSQL client
- `worker/database/clients/d1Client.ts` - D1 client (commented out)
- `worker/database/database.ts` - Core database service (partially disabled)

## API Controllers (Temporarily Disabled)

### Authentication Controller
- `worker/api/controllers/auth/controller.ts` - All auth endpoints disabled
  - register, login, refreshToken, getProfile, updateProfile
  - changePassword, requestPasswordReset, resetPassword
  - logout, deleteAccount, getCsrfToken, getAuthProviders
  - verifyEmail, resendVerificationOtp, checkAuth
  - getActiveSessions, revokeSession, initiateOAuth, handleOAuthCallback

### App Management Controllers
- `worker/api/controllers/apps/controller.ts` - All app endpoints disabled
  - getUserApps, getRecentApps, getFavoriteApps, toggleFavorite
  - getPublicApps, getApp, updateAppVisibility, deleteApp

### App View Controller
- `worker/api/controllers/appView/controller.ts` - App viewing disabled
  - getAppDetails, toggleAppStar (partially disabled)

### Model Configuration Controllers
- `worker/api/controllers/modelConfig/controller.ts` - All model config endpoints disabled
  - getModelConfigs, updateModelConfig, deleteModelConfig, testModelConfig
  - getSecrets, createSecret, updateSecret, deleteSecret
  - getDefaults, getByokProviders, getModelConfig, resetAllConfigs

### Model Providers Controller
- `worker/api/controllers/modelProviders/controller.ts` - All provider endpoints disabled
  - getModelProviders, getModelProvider, createModelProvider, updateModelProvider
  - deleteModelProvider, testModelProvider, getProviders, getProvider
  - createProvider, updateProvider, deleteProvider, testProvider

### Secrets Controller
- `worker/api/controllers/secrets/controller.ts` - All secrets endpoints disabled
  - getSecrets, storeSecret, deleteSecret, getSecretTemplates
  - getAllSecrets, getTemplates

### Stats Controller
- `worker/api/controllers/stats/controller.ts` - All stats endpoints disabled
  - getUserStats, getUserActivity

### User Controller
- `worker/api/controllers/user/controller.ts` - All user endpoints disabled
  - getUserApps, updateProfile, getApps

## Agent Services (Partially Disabled)

### Simple Generator Agent
- `worker/agents/core/simpleGeneratorAgent.ts` - Database service usage disabled
  - AppService usage in saveToDatabase(), updateApp(), updateDeploymentId()
  - ModelConfigService usage in getModelConfigsInfo()
  - AppService usage in updateGitHubRepository(), updateAppScreenshot()

## Middleware (Partially Disabled)

### Authentication Middleware
- `worker/middleware/auth/auth.ts` - AuthService usage disabled
- `worker/middleware/auth/routeAuth.ts` - AppService usage disabled

## Main Application (Partially Disabled)

### Index File
- `worker/index.ts` - Database service usage disabled
  - AppService and DeploymentService usage in proxyCloudRunAppRequest()
  - Cloud Run proxy functionality temporarily disabled

## Helper Services (Partially Disabled)

### BYOK Helper
- `worker/api/controllers/modelConfig/byokHelper.ts` - SecretsService usage disabled

## Files Modified for Frontend Build

### TypeScript Configuration
- `tsconfig.worker.json` - Relaxed strict type checking
  - Removed deprecated `suppressImplicitAnyIndexErrors`
  - Added `noImplicitAny: false`, `strictNullChecks: false`, etc.

### Package Configuration
- `package.json` - Fixed JSON syntax error (trailing comma)

### Schema Files
- `worker/database/schema.ts` - Fixed duplicate exports

### Type Definitions
- `worker-configuration.d.ts` - Added global Env declaration
- `worker/types/env.d.ts` - Env type re-export

## Re-enablement Plan

### Phase 1: Frontend Deployment (Current Priority)
1. ✅ Fix TypeScript compilation errors
2. ✅ Get basic build working
3. 🔄 Deploy frontend with "qfx cloud app" branding
4. 🔄 Verify frontend functionality

### Phase 2: Backend Re-enablement (After Frontend Verification)
1. Re-enable database services one by one
2. Re-enable API controllers
3. Re-enable agent services
4. Re-enable middleware
5. Re-enable main application features
6. Test end-to-end functionality

## Notes

- All disabled features return 503 "Feature temporarily disabled" responses
- Database-dependent features are completely bypassed
- Frontend should work independently of backend services
- Custom branding "qfx cloud app" should be applied during frontend deployment
- All commented code is preserved for easy re-enablement

## Next Steps

1. Complete frontend build fixes
2. Deploy frontend with custom branding
3. Verify frontend functionality
4. Begin systematic backend re-enablement
