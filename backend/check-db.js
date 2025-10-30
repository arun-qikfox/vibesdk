const postgres = require('postgres');
require('dotenv').config({ path: '../.env' });

async function checkDatabase() {
  try {
    console.log('🔍 Checking database state...');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = postgres(process.env.DATABASE_URL, { ssl: false });

    console.log('✅ Connected to PostgreSQL database');

    // Check if basic auth tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'auth_attempts', 'sessions')
      ORDER BY table_name;
    `;

    console.log('\\n📊 Tables found:');
    if (tables.length === 0) {
      console.log('❌ No auth tables found! Need to run migrations.');
    } else {
      tables.forEach(table => {
        console.log(`✅ ${table.table_name}`);
      });
    }

    // Check auth_attempts table structure (the problematic one)
    if (tables.some(t => t.table_name === 'auth_attempts')) {
      console.log('\\n🔧 Checking auth_attempts table structure:');

      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'auth_attempts'
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;

      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });

      // Check if ip_address allows NULL
      const ipColumn = columns.find(c => c.column_name === 'ip_address');
      if (ipColumn) {
        if (ipColumn.is_nullable === 'YES') {
          console.log('✅ ip_address column allows NULL values (GOOD)');
        } else {
          console.log('❌ ip_address column does NOT allow NULL values (NEED TO FIX)');
        }
      }
    }

    // Test a simple auth_attempts insert to see if IP handling works
    try {
      console.log('\\n🧪 Testing auth attempt insertion:');
      const testResult = await sql`
        INSERT INTO auth_attempts (identifier, attempt_type, success, ip_address, user_agent)
        VALUES ('test@example.com', 'test', true, NULL, 'test-agent')
        RETURNING id;
      `;
      console.log('✅ Test insertion successful:', testResult[0]);

      // Clean up test record
      await sql`
        DELETE FROM auth_attempts
        WHERE identifier = 'test@example.com'
        AND attempt_type = 'test';
      `;
      console.log('🧹 Cleaned up test record');
    } catch (insertError) {
      console.log('❌ Test insertion failed:', insertError.message);
    }

    await sql.end();
    console.log('\\n🎯 Database check complete!');

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

checkDatabase();
