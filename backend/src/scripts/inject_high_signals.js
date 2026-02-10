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

async function injectSignals() {
  const client = await pool.connect();
  try {
    console.log('🔄 Injecting system signals...');

    await client.query(`
      INSERT INTO system_signals (signal_type, signal_data)
      VALUES 
      ('PRESSURE_METRIC', '{"frequency_pattern": "high", "abuse_likelihood": 0.8, "stress_calibration": 0.7}'),
      ('GLOBAL_URGENCY', '{"active_emergencies": 12, "system_load": "high"}')
    `);
    
    console.log('✅ Signals injected. Behavioral posture should now be "high" for speed, stress, and risk.');
  } catch (error) {
    console.error('❌ Injection failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

injectSignals();
