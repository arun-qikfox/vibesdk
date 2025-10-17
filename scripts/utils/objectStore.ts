import { execSync } from 'child_process';
import { join } from 'path';

export interface UploadTemplatesOptions {
    templatesDir: string;
    bucketName: string;
    accountId: string;
    apiToken: string;
    localMode: boolean;
}

/**
 * Uploads template assets to the configured object store.
 * Currently delegates to the existing deploy_templates.sh script for Cloudflare R2.
 * TODO: replace with direct adapter calls and add GCP support.
 */
export function uploadTemplatesDirectory(options: UploadTemplatesOptions) {
    const { templatesDir, bucketName, accountId, apiToken, localMode } = options;

    const deployScript = join(templatesDir, 'deploy_templates.sh');

    const env = {
        ...process.env,
        CLOUDFLARE_API_TOKEN: apiToken,
        CLOUDFLARE_ACCOUNT_ID: accountId,
        BUCKET_NAME: bucketName,
        R2_BUCKET_NAME: bucketName,
        LOCAL_R2: localMode ? 'true' : 'false',
    };

    execSync('./deploy_templates.sh', {
        stdio: 'inherit',
        cwd: templatesDir,
        env,
    });
}
