import { execSync } from 'child_process';
import { join } from 'path';

export interface UploadTemplatesOptions {
	templatesDir: string;
	bucketName: string;
	provider?: 'cloudflare' | 'gcp';
	accountId?: string;
	apiToken?: string;
	localMode?: boolean;
	projectId?: string;
}

/**
 * Uploads template assets to the configured object store.
 * Currently delegates to the existing deploy_templates.sh script for Cloudflare R2.
 * TODO: replace with direct adapter calls and add GCP support.
 */
let execImpl = execSync;

export function setExecSyncImplementation(fn: typeof execSync) {
    execImpl = fn;
}

export function resetExecSyncImplementation() {
    execImpl = execSync;
}

export function uploadTemplatesDirectory(options: UploadTemplatesOptions) {
	const provider = (options.provider ?? process.env.RUNTIME_PROVIDER ?? 'cloudflare').toLowerCase() as
		| 'cloudflare'
		| 'gcp';

	if (provider === 'gcp') {
		const { templatesDir, bucketName, projectId } = options;
		if (!bucketName) {
			throw new Error('GCS bucket name is required to upload templates on GCP.');
		}

		const env = {
			...process.env,
			GCLOUD_PROJECT: projectId ?? process.env.GCLOUD_PROJECT,
			GOOGLE_CLOUD_PROJECT: projectId ?? process.env.GOOGLE_CLOUD_PROJECT,
		};

		const target = `gs://${bucketName}`;
		const excludeGit = '-x "\\.git.*"';
		const rsyncCommand = `gsutil -m rsync -r -d ${excludeGit} "${templatesDir}" "${target}"`;

		try {
			execImpl(rsyncCommand, { stdio: 'inherit', cwd: templatesDir, env });
			return;
		} catch (error) {
			console.warn('⚠️  gsutil rsync failed, attempting gcloud storage upload...', error);
			const gcloudCommand = `gcloud storage rsync --recursive "${templatesDir}" "${target}"`;
			execImpl(gcloudCommand, { stdio: 'inherit', cwd: templatesDir, env });
			return;
		}
	}

	const { templatesDir: dir, bucketName, accountId, apiToken, localMode } = options;

	if (!accountId || !apiToken) {
		throw new Error('Cloudflare accountId and apiToken are required to upload templates to R2.');
	}

	const deployScript = join(dir, 'deploy_templates.sh');

	const env = {
		...process.env,
		CLOUDFLARE_API_TOKEN: apiToken,
		CLOUDFLARE_ACCOUNT_ID: accountId,
		BUCKET_NAME: bucketName,
		R2_BUCKET_NAME: bucketName,
		LOCAL_R2: localMode ? 'true' : 'false',
	};

	execImpl('./deploy_templates.sh', {
		stdio: 'inherit',
		cwd: dir,
		env,
	});
}
