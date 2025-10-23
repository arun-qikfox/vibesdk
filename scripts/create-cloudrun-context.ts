#!/usr/bin/env tsx
/**
 * Generates a Docker build context for Cloud Run deployments by combining a generated
 * VibSDK application with the template Docker assets in templates/cloudrun-app.
 *
 * Usage:
 *   npm run cloudrun:context -- --src ./dist/app --out ./cloudrun-context.tar.gz
 */

import { readdirSync, statSync, cpSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type CliOptions = {
	sourceDir: string;
	outputPath: string;
	templateDir: string;
};

function parseArgs(): CliOptions {
	const args = process.argv.slice(2);
	let sourceDir = process.cwd();
	let outputPath = resolve(process.cwd(), 'cloudrun-context.tar.gz');

	const scriptDir = resolve(fileURLToPath(import.meta.url), '..');
	const templateDirDefault = resolve(scriptDir, '..', 'templates', 'cloudrun-app');
	let templateDir = templateDirDefault;

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === '--src' || arg === '--source') {
			sourceDir = resolve(process.cwd(), args[i + 1] ?? '');
			i += 1;
		} else if (arg === '--out' || arg === '--output') {
			outputPath = resolve(process.cwd(), args[i + 1] ?? '');
			i += 1;
		} else if (arg === '--template') {
			templateDir = resolve(process.cwd(), args[i + 1] ?? '');
			i += 1;
		}
	}

	if (!existsSync(sourceDir)) {
		throw new Error(`Source directory "${sourceDir}" does not exist.`);
	}
	if (!existsSync(templateDir)) {
		throw new Error(`Template directory "${templateDir}" does not exist.`);
	}

	return { sourceDir, outputPath, templateDir };
}

function copyContents(src: string, dest: string) {
	const entries = readdirSync(src);
	for (const entry of entries) {
		const srcPath = join(src, entry);
		const destPath = join(dest, entry);
		const stats = statSync(srcPath);
		if (stats.isDirectory()) {
			mkdirSync(destPath, { recursive: true });
			copyContents(srcPath, destPath);
		} else {
			cpSync(srcPath, destPath);
		}
	}
}

function main() {
	const { sourceDir, outputPath, templateDir } = parseArgs();

	const stagingRoot = mkdtempSync(join(tmpdir(), 'vibesdk-cloudrun-'));
	const contextDir = join(stagingRoot, 'context');
	mkdirSync(contextDir, { recursive: true });

	try {
		// Copy only the worker bundle (compiled output)
		const workerBundleDir = join(sourceDir, 'dist', 'worker-bundle');
		if (existsSync(workerBundleDir)) {
			const destBundleDir = join(contextDir, 'dist', 'worker-bundle');
			mkdirSync(join(contextDir, 'dist'), { recursive: true });
			copyContents(workerBundleDir, destBundleDir);
		} else {
			throw new Error(`Worker bundle not found at ${workerBundleDir}. Run 'npm run build:worker' first.`);
		}

		// Copy only necessary Docker files
		const dockerfile = join(sourceDir, 'container', 'Dockerfile.workerd');
		const workerdConfig = join(sourceDir, 'container', 'workerd');
		
		if (existsSync(dockerfile)) {
			cpSync(dockerfile, join(contextDir, 'Dockerfile.workerd'));
		} else {
			throw new Error(`Dockerfile not found at ${dockerfile}`);
		}
		
		if (existsSync(workerdConfig)) {
			copyContents(workerdConfig, join(contextDir, 'workerd'));
		} else {
			throw new Error(`Workerd config not found at ${workerdConfig}`);
		}

		const tarResult = spawnSync('tar', ['-czf', outputPath, '-C', contextDir, '.'], {
			stdio: 'inherit',
		});
		if (tarResult.status !== 0) {
			throw new Error('tar command failed while creating the Cloud Run context archive.');
		}

		// eslint-disable-next-line no-console
		console.log(`Cloud Run build context written to ${outputPath}`);
	} finally {
		rmSync(stagingRoot, { recursive: true, force: true });
	}
}

main();
