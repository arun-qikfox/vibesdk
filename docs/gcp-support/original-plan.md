<!-- 03e03fed-e178-44c6-8d4e-7f9a7f15b2ac baca8c7f-6ae1-4b19-af44-5eb85601f2cb -->
# Phased App Engine Deployment Plan - Frontend First

> **Note**: This is the original implementation plan for Phase 1. For current status and updated documentation, see [phases.md](./phases.md) and [implementation-summary.md](./implementation-summary.md).

## Overview

Incremental migration strategy starting with static frontend deployment to App Engine. This approach has **zero impact** on KV storage or SQLite database since static frontends don't require backend services.

## Phase 1: Static Frontend Deployment (COMPLETED)

### Goal

Deploy static frontend applications (React/Vite builds) to Google App Engine Standard environment with zero backend dependencies.

### Scope

- **Only Frontend Apps**: React/Vite applications with no backend API calls
- **Static Assets**: HTML, CSS, JavaScript bundles
- **No Database**: No SQLite or KV usage
- **No Backend**: No Workers, API routes, or server-side code

### Impact Analysis

✅ **No Impact On:**

- KV storage (VibecoderStore) - not used by static frontends
- SQLite/D1 database - not accessed by static frontends
- Backend services - no backend code generated
- Existing Cloudflare deployment - remains unchanged

✅ **Only Changes:**

- Deployment target selection (Cloudflare vs App Engine)
- Deployment configuration generation (wrangler.jsonc → app.yaml)
- Deployment execution (Workers API → App Engine API)

### Implementation Steps

#### Step 1.1: Add Deployment Target Configuration

**File**: `worker/config/deployment-config.ts` (NEW)

```typescript
export type DeploymentTarget = 'cloudflare' | 'app_engine';

export interface DeploymentConfig {
  target: DeploymentTarget;
  isStaticFrontend: boolean; // For Phase 1, always true
}

export function getDeploymentConfig(env: Env): DeploymentConfig {
  // Default to App Engine for frontend-only deployments
  const target = (env.DEFAULT_DEPLOYMENT_TARGET || 'app_engine') as DeploymentTarget;
  
  return {
    target,
    isStaticFrontend: true, // Phase 1: static frontend only
  };
}
```

**File**: `worker-configuration.d.ts`

```typescript
interface Env {
  // ... existing vars
  DEFAULT_DEPLOYMENT_TARGET?: 'cloudflare' | 'app_engine';
}
```

#### Step 1.2: Modify Deployment Prompt to Identify Static Frontends

**File**: `worker/agents/prompts.ts`

**Location**: Add to `CONSTRAINTS` section

```typescript
CONSTRAINTS: `<PHASE GENERATION CONSTRAINTS>
    **STATIC FRONTEND DEPLOYMENT (Phase 1):**
    - Generate ONLY frontend code (React components, UI)
    - NO backend API routes or server code
    - NO database access or SQL queries
    - NO Cloudflare Workers API usage
    - Use mock data or static JSON for data
    - All API calls should be mocked or commented out
    - Focus on UI/UX implementation only
    
    **DEPLOYMENT CONFIGURATION:**
    - Frontend will be deployed as static site
    - No runtime dependencies beyond frontend framework
    - Build output goes to dist/ directory
    - Static files served from dist/ or public/
    
    {{existingConstraints}}
</PHASE GENERATION CONSTRAINTS>`
```

#### Step 1.3: Create App Engine Deployment Service

**File**: `worker/services/deployer/appengine-deployer.ts` (NEW)

```typescript
import { createLogger } from '../../logger';

const logger = createLogger('AppEngineDeployer');

export interface AppEngineDeployConfig {
  projectId: string;
  serviceAccountKey: string; // JSON key file content
  appName: string;
  staticFiles: Map<string, Buffer>; // path -> content
  appYaml: string;
}

export class AppEngineDeployer {
  private readonly projectId: string;
  private readonly serviceAccountKey: string;

  constructor(projectId: string, serviceAccountKey: string) {
    this.projectId = projectId;
    this.serviceAccountKey = serviceAccountKey;
  }

  /**
   * Deploy static frontend to App Engine
   * Only handles static files - no backend code
   */
  async deployStaticFrontend(config: AppEngineDeployConfig): Promise<{
    success: boolean;
    url?: string;
    versionId?: string;
    error?: string;
  }> {
    try {
      logger.info('Deploying static frontend to App Engine', { appName: config.appName });

      // Step 1: Create app.yaml for static site
      const appYaml = this.generateStaticAppYaml(config.appName);
      
      // Step 2: Package static files
      const packagePath = await this.packageStaticFiles(config.staticFiles, appYaml);
      
      // Step 3: Deploy via gcloud CLI or Admin API
      const result = await this.deployViaAPI(packagePath);
      
      // Step 4: Get deployment URL
      const url = `https://${config.appName}.${this.projectId}.appspot.com`;
      
      return {
        success: true,
        url,
        versionId: result.versionId,
      };
    } catch (error) {
      logger.error('App Engine deployment failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private generateStaticAppYaml(appName: string): string {
    return `runtime: nodejs20
service: ${appName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 2
handlers:
  - url: /.*
    static_files: dist/index.html
    upload: dist/index.html
  - url: /(.*)
    static_files: dist/\\1
    upload: dist/.*
env_variables:
  NODE_ENV: production
`;
  }

  private async packageStaticFiles(
    files: Map<string, Buffer>,
    appYaml: string
  ): Promise<string> {
    // Create temporary directory structure
    // Copy all static files to dist/
    // Add app.yaml to root
    // Return path to packaged directory
    // Implementation details...
  }

  private async deployViaAPI(packagePath: string): Promise<{ versionId: string }> {
    // Use App Engine Admin API to deploy
    // Or execute gcloud CLI command
    // Implementation details...
  }
}
```

#### Step 1.4: Update Sandbox Service for App Engine Deployment

**File**: `worker/services/sandbox/sandboxSdkClient.ts`

**Changes**: Add method for App Engine static deployment

```typescript
/**
 * Deploy static frontend to Google App Engine
 * Phase 1: Frontend-only deployment with no backend dependencies
 */
async deployToAppEngine(instanceId: string): Promise<DeploymentResult> {
  try {
    this.logger.info('Starting App Engine static frontend deployment', { instanceId });

    // Get project metadata
    const metadata = await this.getInstanceMetadata(instanceId);
    const projectName = metadata?.projectName || instanceId;

    // Get GCP credentials from environment
    const projectId = env.GOOGLE_CLOUD_PROJECT_ID;
    const serviceAccountKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!projectId || !serviceAccountKey) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID and GOOGLE_SERVICE_ACCOUNT_KEY must be set');
    }

    const sandbox = this.getSandbox();
    this.logger.info('Processing static frontend deployment', { instanceId });

    // Step 1: Build frontend only (no backend build)
    this.logger.info('Building frontend');
    const buildResult = await this.executeCommand(instanceId, 'npm run build');
    if (buildResult.exitCode !== 0) {
      throw new Error(`Frontend build failed: ${buildResult.stderr}`);
    }

    // Step 2: Read static files from dist directory
    this.logger.info('Reading static files');
    const distPath = `${instanceId}/dist`;
    const staticFiles = await this.readStaticFilesFromSandbox(distPath);

    // Step 3: Generate app.yaml for static site
    const appYaml = this.generateStaticAppYaml(projectName);

    // Step 4: Deploy to App Engine
    const deployer = new AppEngineDeployer(projectId, serviceAccountKey);
    const deployResult = await deployer.deployStaticFrontend({
      projectId,
      serviceAccountKey,
      appName: projectName,
      staticFiles,
      appYaml,
    });

    if (!deployResult.success) {
      throw new Error(deployResult.error || 'Deployment failed');
    }

    const deployedUrl = deployResult.url || `https://${projectName}.${projectId}.appspot.com`;

    this.logger.info('App Engine deployment successful', {
      instanceId,
      deployedUrl,
      versionId: deployResult.versionId,
    });

    return {
      success: true,
      message: `Successfully deployed static frontend to App Engine`,
      deployedUrl,
      deploymentId: deployResult.versionId,
      output: `Deployed to ${deployedUrl}`,
    };
  } catch (error) {
    this.logger.error('deployToAppEngine failed', error, { instanceId });
    return {
      success: false,
      message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Read static files from sandbox dist directory
 */
private async readStaticFilesFromSandbox(distPath: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const sandbox = this.getSandbox();

  // List all files in dist directory
  const listResult = await sandbox.exec(`find ${distPath} -type f`);
  if (listResult.exitCode !== 0) {
    throw new Error(`Failed to list dist files: ${listResult.stderr}`);
  }

  const filePaths = listResult.stdout.trim().split('\n').filter(path => path);

  for (const fullPath of filePaths) {
    const relativePath = fullPath.replace(`${distPath}/`, '');
    const fileResult = await sandbox.readFile(fullPath);
    
    if (fileResult.success && fileResult.content) {
      files.set(relativePath, Buffer.from(fileResult.content, 'utf8'));
    }
  }

  return files;
}

/**
 * Generate app.yaml for static frontend deployment
 */
private generateStaticAppYaml(appName: string): string {
  return `runtime: nodejs20
service: ${appName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 2
handlers:
  - url: /.*
    static_files: dist/index.html
    upload: dist/index.html
  - url: /(.*)
    static_files: dist/\\1
    upload: dist/.*
env_variables:
  NODE_ENV: production
`;
}
```

#### Step 1.5: Update Base Service Interface

**File**: `worker/services/sandbox/BaseSandboxService.ts`

**Changes**: Add abstract method for App Engine deployment

```typescript
/**
 * Deploy static frontend instance to Google App Engine
 * Phase 1: Frontend-only deployment
 * Returns: { success: boolean, message: string, deployedUrl?: string, deploymentId?: string, error?: string }
 */
abstract deployToAppEngine(instanceId: string): Promise<DeploymentResult>;
```

#### Step 1.6: Update Agent to Support App Engine Deployment

**File**: `worker/agents/core/simpleGeneratorAgent.ts`

**Changes**: Add App Engine deployment method

```typescript
/**
 * Deploy the generated static frontend to Google App Engine
 * Phase 1: Frontend-only deployment (no backend)
 */
async deployToAppEngine(): Promise<{ deploymentUrl?: string } | null> {
  try {
    this.logger().info('Starting App Engine deployment');
    
    await this.waitForPreview();
    this.broadcast(WebSocketMessageResponses.APP_ENGINE_DEPLOYMENT_STARTED, {
      message: 'Starting deployment to Google App Engine...',
      instanceId: this.state.sandboxInstanceId,
    });

    if (!this.state.sandboxInstanceId) {
      await this.deployToSandbox([], false);
      if (!this.state.sandboxInstanceId) {
        throw new Error('Sandbox service unavailable');
      }
    }

    const deploymentResult = await this.getSandboxServiceClient()
      .deployToAppEngine(this.state.sandboxInstanceId);

    if (deploymentResult.success && deploymentResult.deployedUrl) {
      this.broadcast(WebSocketMessageResponses.APP_ENGINE_DEPLOYMENT_COMPLETED, {
        message: 'Successfully deployed to App Engine!',
        deploymentUrl: deploymentResult.deployedUrl,
        instanceId: this.state.sandboxInstanceId,
      });

      return {
        deploymentUrl: deploymentResult.deployedUrl,
      };
    } else {
      throw new Error(deploymentResult.error || 'Deployment failed');
    }
  } catch (error) {
    this.logger().error('App Engine deployment failed', error);
    this.broadcast(WebSocketMessageResponses.APP_ENGINE_DEPLOYMENT_ERROR, {
      message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
```

#### Step 1.7: Add WebSocket Message Types

**File**: `worker/agents/constants.ts`

**Changes**: Add App Engine deployment message types

```typescript
APP_ENGINE_DEPLOYMENT_STARTED: 'app_engine_deployment_started',
APP_ENGINE_DEPLOYMENT_COMPLETED: 'app_engine_deployment_completed',
APP_ENGINE_DEPLOYMENT_ERROR: 'app_engine_deployment_error',
```

#### Step 1.8: Update Frontend UI

**File**: `src/routes/chat/components/deployment-controls.tsx`

**Changes**: Add App Engine deploy button (or replace Cloudflare button)

```typescript
// Add state for App Engine deployment
const [isAppEngineDeploying, setIsAppEngineDeploying] = useState(false);

// Add handler
const handleDeployToAppEngine = useCallback(async () => {
  if (!instanceId || isAppEngineDeploying) return;
  
  setIsAppEngineDeploying(true);
  try {
    await apiClient.deployToAppEngine(instanceId);
    // Handle success
  } catch (error) {
    // Handle error
  } finally {
    setIsAppEngineDeploying(false);
  }
}, [instanceId, isAppEngineDeploying]);

// Update button
<Button
  onClick={handleDeployToAppEngine}
  disabled={isAppEngineDeploying}
>
  {isAppEngineDeploying ? 'Deploying...' : 'Deploy to App Engine'}
</Button>
```

**File**: `src/lib/api-client.ts`

**Changes**: Add API method

```typescript
async deployToAppEngine(instanceId: string): Promise<ApiResponse<{ deploymentUrl: string }>> {
  return this.request<{ deploymentUrl: string }>(
    `/api/agent/${instanceId}/deploy/appengine`,
    { method: 'POST' }
  );
}
```

#### Step 1.9: Add API Route

**File**: `worker/api/routes/codegenRoutes.ts`

**Changes**: Add App Engine deployment route

```typescript
app.post('/api/agent/:agentId/deploy/appengine', 
  setAuthLevel(AuthConfig.authenticated), 
  adaptController(CodingAgentController, CodingAgentController.deployToAppEngine)
);
```

**File**: `worker/api/controllers/agent/controller.ts`

**Changes**: Add controller method

```typescript
static async deployToAppEngine(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<ControllerResponse<ApiResponse<{ deploymentUrl: string }>>> {
  try {
    const agentId = request.param('agentId');
    if (!agentId) {
      return CodingAgentController.createErrorResponse('Agent ID required', 400);
    }

    const agent = await getAgent(env, agentId, this.logger);
    const result = await agent.deployToAppEngine();

    if (result?.deploymentUrl) {
      return {
        success: true,
        data: {
          success: true,
          data: { deploymentUrl: result.deploymentUrl },
        },
      };
    } else {
      return CodingAgentController.createErrorResponse('Deployment failed', 500);
    }
  } catch (error) {
    this.logger.error('Error deploying to App Engine', error);
    return CodingAgentController.createErrorResponse('Deployment failed', 500);
  }
}
```

### Testing Phase 1

**Test Cases:**

1. ✅ Generate a simple static React app (no backend)
2. ✅ Deploy to App Engine
3. ✅ Verify app loads correctly
4. ✅ Verify no KV or database calls are made
5. ✅ Verify static assets are served correctly
6. ✅ Test deployment URL accessibility

**Success Criteria:**

- Static frontend deploys successfully to App Engine
- App loads and renders correctly
- No errors related to KV or database
- Deployment URL is accessible

## Phase 2: Backend Integration (Future)

**After Phase 1 is tested and validated:**

- Add Express.js backend support
- Add PostgreSQL database integration
- Migrate from mock data to real API calls
- Implement full-stack application deployment

## Phase 3: Database Migration (Future)

**After Phase 2 is tested:**

- Migrate from SQLite to PostgreSQL
- Update schema for PostgreSQL compatibility
- Migrate data if needed

## Files Created/Modified

**New Files:**

- `worker/config/deployment-config.ts` - Deployment configuration
- `worker/services/deployer/appengine-deployer.ts` - App Engine deployment service

**Modified Files:**

- `worker/services/sandbox/sandboxSdkClient.ts` - Add `deployToAppEngine()` method
- `worker/services/sandbox/BaseSandboxService.ts` - Add abstract method
- `worker/agents/core/simpleGeneratorAgent.ts` - Add `deployToAppEngine()` method
- `worker/agents/constants.ts` - Add message types
- `worker/agents/prompts.ts` - Add static frontend constraints
- `worker/api/routes/codegenRoutes.ts` - Add route
- `worker/api/controllers/agent/controller.ts` - Add controller method
- `src/routes/chat/components/deployment-controls.tsx` - Add UI button
- `src/lib/api-client.ts` - Add API method
- `worker-configuration.d.ts` - Add env vars

## Environment Variables Required

```bash
# GCP Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_SERVICE_ACCOUNT_KEY=base64-encoded-json-key

# Deployment Target (optional, defaults to app_engine)
DEFAULT_DEPLOYMENT_TARGET=app_engine
```

## Risk Mitigation

**Phase 1 Risks:**

- ✅ **Low Risk**: No backend changes, no database changes
- ✅ **Isolated**: Only affects deployment target, not code generation
- ✅ **Reversible**: Can switch back to Cloudflare deployment anytime
- ✅ **Testable**: Easy to test static frontend deployment

**Rollback Plan:**

- Set `DEFAULT_DEPLOYMENT_TARGET=cloudflare` to revert
- No code changes needed for rollback
- Existing Cloudflare deployment continues to work

## 📝 Implementation Notes

### Actual Implementation Differences from Plan

The actual implementation differed from this plan in the following ways:

1. **YAML Generation**: Centralized in `appengine-yaml-generator.ts` instead of being in multiple places
2. **Service Name**: Uses short service name generation to avoid domain size limits
3. **Build Path**: Uses `dist/client/` instead of `dist/` (Vite/React output structure)
4. **Deployment Method**: Uses gcloud CLI directly in sandbox instead of Admin API
5. **URL Format**: Uses `-dot-` format for service URLs
6. **File Exclusion**: Uses `.gcloudignore` to exclude source files

### Current Status

- ✅ All Phase 1 steps completed
- ✅ Implementation matches plan goals
- ✅ Additional improvements made (short service names, .gcloudignore, etc.)

## 🔗 Related Documentation

- [Phases](./phases.md) - Current phase status and roadmap
- [Implementation Summary](./implementation-summary.md) - What was actually implemented
- [Architecture](./architecture.md) - Reference architecture
- [Rules](./rules.md) - Decision rules and criteria

