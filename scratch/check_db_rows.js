import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set!');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    // Check linked_accounts
    const linkRes = await client.query('SELECT * FROM linked_accounts');
    console.log('linked_accounts rows count:', linkRes.rows.length);
    console.log('linked_accounts rows:', JSON.stringify(linkRes.rows, null, 2));

    client.release();
  } catch (err) {
    console.error('Database Error:', err.message);
  }
  process.exit(0);
}

run();
