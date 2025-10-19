import { execSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse } from 'jsonc-parser';

const OUTPUT_DIR = resolve(process.cwd(), 'dist/worker-bundle');
const EXPECTED_FILES = [resolve(OUTPUT_DIR, 'index.js')];
const TEMP_WRANGLER_CONFIG = resolve(
	process.cwd(),
	'.wrangler-bundle.jsonc'
);

const ensureFile = (filePath: string, content: string) => {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	const existing = existsSync(filePath)
		? readFileSync(filePath, 'utf-8')
		: null;
	if (existing !== content) {
		writeFileSync(filePath, content, 'utf-8');
	}
};

const patchZodClassicModule = () => {
	const zodCoreIndex = resolve(
		process.cwd(),
		'node_modules/zod/v4/core/index.js'
	);
	ensureFile(
		zodCoreIndex,
		[
			"export * from './core.js';",
			"export * from './parse.js';",
			"export * from './errors.js';",
			"export * from './schemas.js';",
			"export * from './checks.js';",
			"export * from './versions.js';",
			"export * as util from './util.js';",
			"export * as regexes from './regexes.js';",
			"export * as locales from '../locales/index.js';",
			"export * from './registries.js';",
			"export * from './doc.js';",
			"export * from './api.js';",
			"export * from './function.js';",
			"export * from './to-json-schema.js';",
			"export * as JSONSchema from './json-schema.js';",
			"",
		].join('\n')
	);

	const zodCoreApi = resolve(
		process.cwd(),
		'node_modules/zod/v4/core/api.cjs'
	);
	ensureFile(
		zodCoreApi,
		"module.exports = require('./index.cjs');\n"
	);

	const localesDir = resolve(process.cwd(), 'node_modules/zod/v4/locales');
	const localesIndex = resolve(localesDir, 'index.js');
	const localesIndexCjs = resolve(localesDir, 'index.cjs');
	const localesEn = resolve(localesDir, 'en.js');

	ensureFile(
		localesEn,
		"const messages = {};\nexport function en() {\n\treturn messages;\n}\nexport default en;\nexport { messages };\n"
	);

	ensureFile(
		localesIndex,
		"import en from './en.js';\nexport { en };\nexport default { en };\n"
	);

	ensureFile(
		localesIndexCjs,
		"const messages = {};\nfunction en() {\n\treturn messages;\n}\nmodule.exports = { en, messages, default: en };\n"
	);
};

const createWranglerBundleConfig = () => {
	const wranglerPath = resolve(process.cwd(), 'wrangler.jsonc');
	const contents = readFileSync(wranglerPath, 'utf-8');
	const parsed = parse(contents) as Record<string, unknown>;
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Failed to parse wrangler.jsonc for bundle build');
	}

	const sanitized: Record<string, unknown> = { ...parsed };
	delete sanitized.containers;

	writeFileSync(
		TEMP_WRANGLER_CONFIG,
		`${JSON.stringify(sanitized, null, 2)}\n`,
		'utf-8'
	);
};

const cleanupTempConfig = () => {
	rmSync(TEMP_WRANGLER_CONFIG, { force: true });
};

try {
	rmSync(OUTPUT_DIR, { recursive: true, force: true });
} catch (error) {
	console.warn('Warning: unable to clean previous bundle', error);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
patchZodClassicModule();
createWranglerBundleConfig();

console.log('Building Worker bundle with Wrangler (dry run)...');
try {
	execSync(
		`npx wrangler deploy --dry-run --config ${TEMP_WRANGLER_CONFIG} --outdir dist/worker-bundle --tsconfig tsconfig.worker.json`,
		{
			stdio: 'inherit',
			env: {
				...process.env,
				NODE_ENV: 'production',
			},
		}
	);
} finally {
	cleanupTempConfig();
}

const missing = EXPECTED_FILES.filter((file) => !existsSync(file));
if (missing.length > 0) {
	throw new Error(
		`Worker bundle is missing expected files:\n${missing
			.map((file) => ` - ${file}`)
			.join('\n')}`
	);
}

console.log('Worker bundle generated in dist/worker-bundle');
