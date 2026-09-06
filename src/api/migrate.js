import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Shrey%4013569@db.bxebfeyqchjukibgfeqs.supabase.co:5432/postgres';

export async function runMigration() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('[Migration] Connected to PostgreSQL...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS skin_owners (
        skin_id VARCHAR(100) NOT NULL,
        skin_name VARCHAR(100) NOT NULL,
        player_id VARCHAR(100) NOT NULL,
        player_name VARCHAR(100) NOT NULL,
        player_short_id VARCHAR(50) NOT NULL,
        amount INT NOT NULL DEFAULT 1,
        is_linked BOOLEAN DEFAULT FALSE,
        last_updated TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (skin_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS idx_skin_owners_name ON skin_owners (LOWER(skin_name));
      CREATE INDEX IF NOT EXISTS idx_skin_owners_id ON skin_owners (skin_id);
    `);

    console.log('✅ [Migration] skin_owners table verified and indexed successfully!');
  } catch (err) {
    console.error('❌ [Migration] Error creating skin_owners table:', err.message);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigration();
}
