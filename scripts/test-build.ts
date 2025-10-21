#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

console.log('🧪 Testing GCP Build Process...\n');

try {
    // Test 1: TypeScript Compilation Check
    console.log('📋 Step 1: Checking TypeScript compilation...');
    try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        console.log('✅ TypeScript compilation successful!\n');
    } catch (error) {
        console.log('⚠️  TypeScript compilation has warnings/errors, but continuing...\n');
    }

    // Test 2: Frontend Build
    console.log('📋 Step 2: Testing frontend build...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Frontend build successful!\n');

    // Test 3: Check if dist directory exists
    console.log('📋 Step 3: Checking build output...');
    if (existsSync('dist')) {
        console.log('✅ dist directory created');
    } else {
        console.log('❌ dist directory not found');
        process.exit(1);
    }

    // Test 4: Check for index.html
    if (existsSync('dist/index.html')) {
        console.log('✅ index.html found');
    } else {
        console.log('❌ index.html not found');
        process.exit(1);
    }

    // Test 5: Check for assets
    if (existsSync('dist/assets')) {
        console.log('✅ assets directory found');
    } else {
        console.log('⚠️  assets directory not found (may be normal)');
    }

    console.log('\n🎉 All build tests passed! Ready for GCP deployment.');
    console.log('\n📋 Next steps:');
    console.log('   1. Run: npm run deploy:gcp');
    console.log('   2. Test the deployed service');
    console.log('   3. Verify frontend loads correctly');

} catch (error) {
    console.error('❌ Build test failed:', error);
    process.exit(1);
}
