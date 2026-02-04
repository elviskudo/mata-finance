import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupSchema() {
  const client = await pool.connect();
  try {
    console.log('🔄 Setting up database schema...');

    await client.query('BEGIN');

    // 1. Update Users Table with login_id
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS login_id VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id);
    `);
    console.log('✅ Users table updated');

    // 2. Update Transactions Table
    await client.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS vendor_id UUID,
      ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100),
      ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS ocr_data JSONB,
      ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50),
      ADD COLUMN IF NOT EXISTS internal_flags JSONB,
      ADD COLUMN IF NOT EXISTS reject_reason TEXT;
    `);
    console.log('✅ Transactions table updated');

    // 3. Create Transaction Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id UUID PRIMARY KEY,
        transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
        description TEXT,
        account_code VARCHAR(50),
        quantity NUMERIC,
        unit_price NUMERIC,
        total_amount NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Transaction Items table created');

    // 4. Create Transaction Documents Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_documents (
        id UUID PRIMARY KEY,
        transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
        file_name VARCHAR(255),
        file_path TEXT,
        file_type VARCHAR(50),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ocr_result JSONB,
        status_match BOOLEAN
      );
    `);
    console.log('✅ Transaction Documents table created');

    await client.query('COMMIT');
    console.log('🎉 Schema setup completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Schema setup failed:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

setupSchema();
