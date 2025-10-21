#!/usr/bin/env tsx

import { existsSync } from 'node:fs';
import { join } from 'node:path';

console.log('🧪 Testing GCP Build Configuration...\n');

// Test 1: Check if TypeScript configs exist
console.log('📋 Step 1: Checking TypeScript configuration...');
const configs = [
    'tsconfig.json',
    'tsconfig.worker.json', 
    'tsconfig.node.json',
    'tsconfig.app.json'
];

for (const config of configs) {
    if (existsSync(config)) {
        console.log(`✅ ${config} exists`);
    } else {
        console.log(`❌ ${config} missing`);
    }
}

// Test 2: Check if key files exist
console.log('\n📋 Step 2: Checking key files...');
const keyFiles = [
    'worker/index.ts',
    'worker/app.ts',
    'shared/platform/rateLimit/gcpBackend.ts',
    'scripts/deploy-gcp.ts',
    'package.json'
];

for (const file of keyFiles) {
    if (existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
    }
}

// Test 3: Check if dist directory exists (from previous builds)
console.log('\n📋 Step 3: Checking build artifacts...');
if (existsSync('dist')) {
    console.log('✅ dist directory exists');
    if (existsSync('dist/index.html')) {
        console.log('✅ index.html exists');
    }
    if (existsSync('dist/assets')) {
        console.log('✅ assets directory exists');
    }
} else {
    console.log('ℹ️  dist directory not found (run npm run build first)');
}

console.log('\n🎉 Configuration check complete!');
console.log('\n📋 Manual Commands to Run:');
console.log('   1. npm run build');
console.log('   2. npm run deploy:gcp');
console.log('   3. Test the deployed service');
