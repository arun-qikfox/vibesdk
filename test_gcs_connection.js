// Test GCS connection and debug template listing issues
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

async function testGCSConnection() {
    console.log('Testing GCS connection...');
    console.log('Environment variables:');
    console.log('- GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID);
    console.log('- GCS_TEMPLATES_BUCKET:', process.env.GCS_TEMPLATES_BUCKET);

    if (!process.env.GCS_TEMPLATES_BUCKET) {
        console.error('❌ GCS_TEMPLATES_BUCKET not configured');
        return;
    }

    try {
        console.log('Creating Storage client...');
        const storage = new Storage({
            projectId: process.env.GCP_PROJECT_ID
        });

        console.log('Getting bucket reference...');
        const bucket = storage.bucket(process.env.GCS_TEMPLATES_BUCKET);

        console.log('Testing bucket access...');
        const [exists] = await bucket.exists();
        console.log('✅ Bucket exists:', exists);

        if (!exists) {
            console.error('❌ Bucket does not exist or is not accessible');
            return;
        }

        console.log('Listing ALL files in bucket (first 20)...');
        const [allFiles] = await bucket.getFiles({
            maxResults: 20
        });

        console.log(`✅ Found ${allFiles.length} files in bucket`);
        allFiles.forEach(file => {
            console.log(`  - ${file.name}`);
        });

        console.log('Listing files with prefix "templates/"...');
        const [templateFiles] = await bucket.getFiles({
            prefix: 'templates/',
            maxResults: 10
        });

        console.log(`✅ Found ${templateFiles.length} files with prefix "templates/"`);
        templateFiles.forEach(file => {
            console.log(`  - ${file.name}`);
        });

        // Check for template_catalog.json
        console.log('Checking for template_catalog.json...');
        const [catalogFiles] = await bucket.getFiles({
            prefix: 'template_catalog.json'
        });

        if (catalogFiles.length > 0) {
            console.log('✅ Found template_catalog.json');
            const catalogFile = catalogFiles[0];
            const [content] = await catalogFile.download();
            console.log('Template catalog content:');
            console.log(content.toString('utf8'));
        } else {
            console.log('❌ template_catalog.json not found');
        }

        // Check for tools/ directory
        console.log('Checking for tools/ directory...');
        const [toolsFiles] = await bucket.getFiles({
            prefix: 'tools/',
            maxResults: 5
        });

        console.log(`✅ Found ${toolsFiles.length} files in tools/ directory`);
        toolsFiles.forEach(file => {
            console.log(`  - ${file.name}`);
        });

    } catch (error) {
        console.error('❌ GCS connection failed:', error.message);
        console.error('Error details:', {
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            stack: error.stack
        });

        if (error.code === 403) {
            console.log('🔒 Permission denied - check IAM permissions');
        } else if (error.code === 404) {
            console.log('📁 Bucket not found - check bucket name');
        } else if (error.code === 'ENOTFOUND') {
            console.log('🌐 DNS/Network issue - check internet connection');
        }
    }
}

testGCSConnection();
