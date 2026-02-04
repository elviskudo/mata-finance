import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seedEmergency() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding emergency requests...');

    // 1. Get an admin user
    const adminRes = await client.query("SELECT id FROM users WHERE role = 'admin_finance' LIMIT 1");
    if (adminRes.rows.length === 0) {
      console.log('❌ No admin user found');
      return;
    }
    const adminId = adminRes.rows[0].id;

    // 2. Get some transactions that are submitted/resubmitted
    const trxRes = await client.query("SELECT id, transaction_code FROM transactions WHERE status IN ('submitted', 'resubmitted') LIMIT 3");
    
    if (trxRes.rows.length === 0) {
      console.log('⚠️ No submitted transactions found to make emergency. Creating one...');
      // Create a dummy transaction
      const newTrx = await client.query(`
        INSERT INTO transactions (user_id, transaction_code, transaction_type, amount, status, description, is_latest)
        VALUES ($1, 'TRX-EMG-001', 'Payment', 25000000, 'submitted', 'Emergency payment for vendor A', true)
        RETURNING id
      `, [adminId]);
      
      trxRes.rows.push(newTrx.rows[0]);
    }

    // 3. Insert into emergency_requests
    for (const trx of trxRes.rows) {
      await client.query(`
        INSERT INTO emergency_requests (transaction_id, admin_id, admin_reason, status)
        VALUES ($1, $2, $3, 'PENDING')
        ON CONFLICT DO NOTHING
      `, [
        trx.id, 
        adminId, 
        `Need immediate approval for ${trx.transaction_code || 'this transaction'} due to month-end closing pressure.`
      ]);
    }

    console.log('✅ Emergency requests seeded successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

seedEmergency();
