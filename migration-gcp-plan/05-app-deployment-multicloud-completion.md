# 05 - App Deployment Multi-Cloud Completion Guide

## Current Status Analysis

Based on the migration plan in `05-app-deployment-multicloud.md`, here's what's been completed and what needs to be done:

### ✅ Completed (Steps 1-2)
- [x] **Step 1**: Deployment Target Abstraction - Interface and adapters implemented
- [x] **Step 2**: Build Artifacts for Cloud Run - Docker templates and Cloud Build config ready

### 🔄 In Progress / Needs Completion
- [ ] **Step 3**: Metadata and Routing (Critical for deployment tracking)
- [ ] **Step 4**: DNS and TLS (Required for production access)
- [ ] **Step 5**: UI and Configuration Defaults (User experience)
- [ ] **Step 6**: Rollback and Cleanup (Operational safety)
- [ ] **Step 7**: Documentation (Knowledge transfer)

## Step-by-Step Completion Plan

### Phase 1: Critical Infrastructure Completion (Steps 3-4)

#### Step 3A: Create App Deployments Database Table
```bash
# In WSL terminal at /home/arunr/projects/vibesdk
cd /home/arunr/projects/vibesdk

# Connect to Cloud SQL and create the table
gcloud sql connect vibesdk-db --user=postgres --database=vibesdk --region=us-central1

# Run this SQL:
CREATE TABLE IF NOT EXISTS app_deployments (
    app_id VARCHAR(255) PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    target VARCHAR(50) NOT NULL CHECK (target IN ('gcp-cloud-run', 'cloudflare-workers')),
    service_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'active', 'failed', 'removed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_deployments_target ON app_deployments(target);
CREATE INDEX IF NOT EXISTS idx_app_deployments_status ON app_deployments(status);
CREATE INDEX IF NOT EXISTS idx_app_deployments_created_at ON app_deployments(created_at);

# Exit psql
\q
```

#### Step 3B: Update Database Schema Files
Update `worker/database/schema.ts` to include the new table:

```typescript
// Add to worker/database/schema.ts
export const appDeployments = pgTable('app_deployments', {
  appId: text('app_id').primaryKey(),
  version: text('version').notNull(),
  target: text('target').notNull().$type<'gcp-cloud-run' | 'cloudflare-workers'>(),
  serviceUrl: text('service_url'),
  status: text('status').notNull().default('pending').$type<'pending' | 'deploying' | 'active' | 'failed' | 'removed'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});
```

#### Step 3C: Create Deployment Service
Create `worker/database/services/DeploymentService.ts`:

```typescript
import { eq, and } from 'drizzle-orm';
import { db } from '../database';
import { appDeployments } from '../schema';

export class DeploymentService {
  async createDeployment(appId: string, version: string, target: 'gcp-cloud-run' | 'cloudflare-workers') {
    return await db.insert(appDeployments).values({
      appId,
      version,
      target,
      status: 'pending'
    }).returning();
  }

  async updateDeploymentStatus(appId: string, status: 'pending' | 'deploying' | 'active' | 'failed' | 'removed', serviceUrl?: string) {
    return await db.update(appDeployments)
      .set({ 
        status, 
        serviceUrl,
        updatedAt: new Date()
      })
      .where(eq(appDeployments.appId, appId))
      .returning();
  }

  async getDeployment(appId: string) {
    const result = await db.select()
      .from(appDeployments)
      .where(eq(appDeployments.appId, appId))
      .limit(1);
    return result[0];
  }

  async getDeploymentsByTarget(target: 'gcp-cloud-run' | 'cloudflare-workers') {
    return await db.select()
      .from(appDeployments)
      .where(eq(appDeployments.target, target));
  }
}
```

#### Step 3D: Update GCP Cloud Run Target
Update `shared/platform/deployment/targets/gcpCloudRun.ts` to use the database:

```typescript
// Add at the top
import { DeploymentService } from '../../../worker/database/services/DeploymentService';

// Update the deploy method to record in database
async deploy(input: DeploymentInput) {
  try {
    logger.info('Starting GCP Cloud Run deployment', {
      instanceId: input.instanceId,
      projectName: input.projectName
    });

    // Record deployment start
    const deploymentService = new DeploymentService();
    await deploymentService.createDeployment(input.instanceId, '1.0.0', 'gcp-cloud-run');
    await deploymentService.updateDeploymentStatus(input.instanceId, 'deploying');

    // ... existing deployment logic ...

    // Record successful deployment
    await deploymentService.updateDeploymentStatus(input.instanceId, 'active', serviceUrl);

    return {
      success: true,
      deploymentId: input.instanceId,
      deployedUrl: serviceUrl,
      message: `Successfully deployed ${input.projectName} to Google Cloud Run`
    };
  } catch (error) {
    // Record failed deployment
    await deploymentService.updateDeploymentStatus(input.instanceId, 'failed');
    throw error;
  }
}
```

#### Step 3E: Update Worker Routing
Update `worker/index.ts` around line 52-119 to handle Cloud Run routing:

```typescript
// Add import
import { DeploymentService } from './database/services/DeploymentService';

// Update handleUserAppRequest function
async function handleUserAppRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  // Check if this is a preview domain request
  if (hostname.includes('apps.vibesdk') || hostname.includes('preview.vibesdk')) {
    const appId = extractAppIdFromHostname(hostname);
    
    if (appId) {
      const deploymentService = new DeploymentService();
      const deployment = await deploymentService.getDeployment(appId);
      
      if (deployment && deployment.target === 'gcp-cloud-run' && deployment.serviceUrl) {
        // Proxy request to Cloud Run service
        const cloudRunUrl = new URL(deployment.serviceUrl);
        const targetUrl = new URL(request.url);
        targetUrl.hostname = cloudRunUrl.hostname;
        
        return fetch(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
      }
    }
  }
  
  // Fall back to existing Cloudflare Workers dispatch logic
  // ... existing code ...
}

function extractAppIdFromHostname(hostname: string): string | null {
  // Extract app ID from subdomain like "myapp.apps.vibesdk.example.com"
  const match = hostname.match(/^([^.]+)\.apps\.vibesdk/);
  return match ? match[1] : null;
}
```

### Phase 2: DNS and TLS Configuration (Step 4)

#### Step 4A: Reserve Domain in Cloud DNS
```bash
# Create DNS zone for apps subdomain
gcloud dns managed-zones create vibesdk-apps \
  --description="DNS zone for VibSDK generated apps" \
  --dns-name="apps.vibesdk.example.com." \
  --visibility=public

# Get the nameservers
gcloud dns managed-zones describe vibesdk-apps --format="value(nameServers)"
```

#### Step 4B: Configure Load Balancer
```bash
# Create global static IP
gcloud compute addresses create vibesdk-apps-ip --global

# Create HTTPS load balancer with Cloud Run backend
gcloud compute backend-services create vibesdk-apps-backend \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED

# Create URL map
gcloud compute url-maps create vibesdk-apps-urlmap \
  --default-service=vibesdk-apps-backend

# Create HTTPS proxy
gcloud compute target-https-proxies create vibesdk-apps-https-proxy \
  --url-map=vibesdk-apps-urlmap \
  --ssl-certificates=vibesdk-apps-ssl-cert

# Create forwarding rule
gcloud compute forwarding-rules create vibesdk-apps-forwarding-rule \
  --global \
  --target-https-proxy=vibesdk-apps-https-proxy \
  --address=vibesdk-apps-ip \
  --ports=443
```

### Phase 3: UI and Configuration (Step 5)

#### Step 5A: Add Frontend Toggle
Update the admin UI to include deployment target selection:

```typescript
// In src/components/admin/DeploymentSettings.tsx
export function DeploymentSettings() {
  const [deploymentTarget, setDeploymentTarget] = useState<'gcp-cloud-run' | 'cloudflare-workers'>('gcp-cloud-run');
  
  return (
    <div className="deployment-settings">
      <h3>Deployment Target</h3>
      <select 
        value={deploymentTarget} 
        onChange={(e) => setDeploymentTarget(e.target.value as any)}
      >
        <option value="gcp-cloud-run">Google Cloud Run (Default)</option>
        <option value="cloudflare-workers">Cloudflare Workers</option>
      </select>
    </div>
  );
}
```

#### Step 5B: Update Setup Wizard
Update `scripts/setup.ts` to collect GCP deployment settings:

```typescript
// Add GCP deployment configuration collection
async function collectGcpDeploymentSettings() {
  const settings = {
    gcpProjectId: await prompt('GCP Project ID (qfxcloud-app-builder): ') || 'qfxcloud-app-builder',
    gcpRegion: await prompt('GCP Region (us-central1): ') || 'us-central1',
    artifactRegistryRepo: await prompt('Artifact Registry Repository (vibesdk-apps): ') || 'vibesdk-apps',
    defaultDeploymentTarget: await prompt('Default Deployment Target (gcp-cloud-run): ') || 'gcp-cloud-run'
  };
  
  return settings;
}
```

### Phase 4: Testing and Verification

#### Step 6A: Test Deployment Flow
```bash
# 1. Create a test app
npm run dev
# Navigate to UI and create a simple app

# 2. Deploy to GCP
# The deployment should automatically use GCP Cloud Run target

# 3. Verify deployment
gcloud run services list --region=us-central1
# Check that your app service is running

# 4. Test access
curl https://your-app-id-apps.vibesdk.example.com
# Should return your deployed app
```

#### Step 6B: Test Cloudflare Fallback
```bash
# 1. Change deployment target to cloudflare-workers in UI
# 2. Deploy another test app
# 3. Verify it uses Cloudflare Workers dispatch
```

### Phase 5: Cleanup and Documentation

#### Step 7A: Implement Cleanup Methods
Update `shared/platform/deployment/targets/gcpCloudRun.ts`:

```typescript
async remove(appId: string): Promise<void> {
  try {
    logger.info('Starting GCP Cloud Run removal', { appId });

    // Delete Cloud Run service
    await runGcloudCommand([
      'run', 'services', 'delete', appId,
      '--region=us-central1',
      '--quiet'
    ]);

    // Update database status
    const deploymentService = new DeploymentService();
    await deploymentService.updateDeploymentStatus(appId, 'removed');

    logger.info('GCP Cloud Run removal completed', { appId });
  } catch (error) {
    logger.error('GCP Cloud Run removal failed', error, { appId });
    throw error;
  }
}
```

#### Step 7B: Add Cleanup Scheduler
Create a Cloud Scheduler job to clean up old preview services:

```bash
# Create cleanup job
gcloud scheduler jobs create http vibesdk-cleanup-preview-apps \
  --schedule="0 2 * * *" \
  --uri="https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/admin/cleanup-preview-apps" \
  --http-method=POST \
  --headers="Authorization=Bearer $(gcloud auth print-access-token)"
```

## Recovery and Troubleshooting

### If Deployment Fails
1. **Check Cloud Build logs**: `gcloud builds log [BUILD_ID]`
2. **Check Cloud Run service status**: `gcloud run services describe [SERVICE_NAME] --region=us-central1`
3. **Check database**: Query `app_deployments` table for status
4. **Check logs**: `gcloud logging read "resource.type=cloud_run_revision" --limit=50`

### If DNS Issues
1. **Check DNS propagation**: `nslookup apps.vibesdk.example.com`
2. **Check load balancer**: `gcloud compute forwarding-rules describe vibesdk-apps-forwarding-rule --global`
3. **Check SSL certificate**: `gcloud compute ssl-certificates describe vibesdk-apps-ssl-cert`

### Rollback Procedure
1. **Change default target**: Set `DEFAULT_DEPLOYMENT_TARGET=cloudflare-workers` in environment
2. **Redeploy control plane**: `npm run deploy:gcp`
3. **Verify fallback**: Test that new apps deploy to Cloudflare Workers

## Next Steps After Completion

1. **Update rules.md**: Mark Step 5 as `done` and move to Step 6
2. **Run integration tests**: Verify both deployment targets work
3. **Document operations**: Create runbook for production operations
4. **Monitor**: Set up alerts for deployment failures

## Commands Summary

```bash
# Essential commands for completion
cd /home/arunr/projects/vibesdk

# Database setup
gcloud sql connect vibesdk-db --user=postgres --database=vibesdk --region=us-central1

# Check current services
gcloud run services list --region=us-central1

# Deploy updated worker
npm run deploy:gcp

# Test deployment
npm run cloudrun:context -- --src ./test-app --out ./test-context.tar.gz
gcloud builds submit --config cloudbuild/app-deploy.yaml --substitutions="_SERVICE_NAME=test-app,_CONTEXT_TAR=./test-context.tar.gz"
```

This guide provides a complete, resumable path to finish the deployment implementation. Each step can be executed independently and includes verification steps to ensure success.
