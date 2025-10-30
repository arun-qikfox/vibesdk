import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client(process.env.DATABASE_URL);

async function runMigration() {
    try {
        console.log('Connecting to DB...');
        await client.connect();
        console.log('Connected, running GCP migration...');

        const sql = fs.readFileSync(path.join('migrations', 'gcp', '0000_fuzzy_dust.sql'), 'utf8');
        console.log('Running GCP migration');

        await client.query(sql);
        console.log('✅ GCP migration completed!');
    } catch (error) {
        console.error('Migration error:', error.message);
    } finally {
        await client.end();
    }
}

runMigration();
