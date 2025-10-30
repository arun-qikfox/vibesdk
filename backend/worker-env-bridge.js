// Environment Bridge: Adapt Cloudflare Worker environment for Node.js
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables
const envPath = path.resolve(__dirname, '..\\.env');
console.log('🔄 Loading dotenv from:', envPath);
const dotenvResult = dotenv.config({ path: envPath });
// console.log('📄 dotenv result:', dotenvResult);
console.log('🔄 process.env.DATABASE_URL after dotenv:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

// Global polyfills (Cloudflare Worker APIs in Node.js)
global.fetch = fetch;
global.crypto = {
  subtle: require('crypto').webcrypto.subtle,
  getRandomValues: require('crypto').webcrypto.getRandomValues,
  randomUUID: () => require('crypto').randomUUID()
};

// Map process.env to Worker-style environment object
global.env = {
  RUNTIME_PROVIDER: process.env.RUNTIME_PROVIDER || 'gcp', // Force to GCP since we're using Cloud SQL
  JWT_SECRET: process.env.JWT_SECRET || 'your-default-jwt-secret-here-for-dev',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://vibesdk-user@127.0.0.1:5432/vibesdk?sslmode=disable',
  GCS_TEMPLATES_BUCKET: process.env.GCS_TEMPLATES_BUCKET,
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
  FIRESTORE_COLLECTION: process.env.FIRESTORE_COLLECTION || 'user-data',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Placeholder for services (will be set by setup-env.js)
global.env.__services__ = {
  database: null,
  storage: null,
  kv: null
};

console.log(`🚀 Environment bridge initialized for ${global.env.RUNTIME_PROVIDER} runtime`);

module.exports = { env: global.env };
