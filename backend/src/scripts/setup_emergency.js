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

async function setupEmergency() {
  const client = await pool.connect();
  try {
    console.log('🔄 Setting up emergency request tables...');

    await client.query('BEGIN');

    // 1. Emergency Requests Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS emergency_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        admin_id UUID NOT NULL REFERENCES users(id),
        admin_reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_transaction_id ON emergency_requests(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON emergency_requests(status);
    `);
    console.log('✅ Emergency Requests table created');

    // 2. System Signals Table (Hidden)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_signals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        signal_type VARCHAR(100) NOT NULL,
        signal_data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_system_signals_type ON system_signals(signal_type);
    `);
    console.log('✅ System Signals table created');

    // Add some mock signals if they don't exist
    await client.query(`
        INSERT INTO system_signals (signal_type, signal_data)
        VALUES 
        ('PRESSURE_METRIC', '{"frequency_pattern": "normal", "abuse_likelihood": 0.05, "stress_calibration": 0.2}'),
        ('GLOBAL_URGENCY', '{"active_emergencies": 5, "system_load": "medium"}')
        ON CONFLICT DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('🎉 Emergency setup completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Emergency setup failed:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

setupEmergency();
