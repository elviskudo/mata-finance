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

async function clearExposure() {
  const client = await pool.connect();
  try {
    console.log('🔄 Membersihkan riwayat paparan System Notice untuk testing...');
    await client.query('DELETE FROM user_notice_exposure');
    console.log('✅ Riwayat dibersihkan.');
  } catch (error) {
    console.error('❌ Gagal membersihkan riwayat:', error);
  } finally {
    client.release();
    pool.end();
  }
}

clearExposure();
