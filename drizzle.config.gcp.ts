import { defineConfig } from 'drizzle-kit';

const connectionString =
	process.env.GCP_DATABASE_URL ??
	process.env.DATABASE_URL ??
	'postgres://postgres:postgres@localhost:5432/vibesdk';

export default defineConfig({
	schema: './worker/database/schema.ts',
	out: './migrations/gcp',
	dialect: 'postgresql',
	dbCredentials: {
		url: connectionString,
	},
	verbose: true,
	strict: true,
});
