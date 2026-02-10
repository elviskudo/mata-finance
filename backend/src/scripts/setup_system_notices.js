import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupSystemNotices() {
  const client = await pool.connect();
  try {
    console.log('🔄 Menyiapkan tabel System Notices...');

    await client.query('BEGIN');

    // 1. System Notices Templates Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_notices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_system_notices_category ON system_notices(category);
    `);
    console.log('✅ Tabel system_notices dibuat');

    // 2. User Notice Exposure Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notice_exposure (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notice_id UUID NOT NULL REFERENCES system_notices(id) ON DELETE CASCADE,
        exposed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        context VARCHAR(255)
      );
      CREATE INDEX IF NOT EXISTS idx_notice_exposure_user_id ON user_notice_exposure(user_id);
    `);
    console.log('✅ Tabel user_notice_exposure dibuat');

    // Reset templates for fresh start
    await client.query('DELETE FROM system_notices');

    // 3. Seed initial templates (Indonesian and aligned with MVP triggers)
    const templates = [
      {
        id: uuidv4(),
        title: 'Pola Kecepatan Persetujuan',
        message: 'Kecepatan pemrosesan persetujuan menyimpang dari pola tipikal sistem.',
        category: 'speed_deviation',
        priority: 2
      },
      {
        id: uuidv4(),
        title: 'Penanganan Permintaan Mendesak',
        message: 'Permintaan darurat ditangani dengan kecepatan yang signifikan di atas rata-rata normal.',
        category: 'emergency_bias',
        priority: 3
      },
      {
        id: uuidv4(),
        title: 'Pola Klarifikasi Berulang',
        message: 'Terdeteksi penggunaan pola klarifikasi yang berulang secara periodik.',
        category: 'clarification_pattern',
        priority: 1
      },
      {
        id: uuidv4(),
        title: 'Variansi Pola Keputusan',
        message: 'Terdeteksi variansi pada pola pengambilan keputusan dalam periode ini.',
        category: 'behavioral_drift',
        priority: 2
      },
      {
         id: uuidv4(),
         title: 'Stabilitas Sistem',
         message: 'Sistem mempertahankan stabilitas melalui pemantauan pola perilaku agregat.',
         category: 'general',
         priority: 0
      }
    ];

    for (const t of templates) {
      await client.query(
        `INSERT INTO system_notices (id, title, message, category, priority)
         VALUES ($1, $2, $3, $4, $5)`,
        [t.id, t.title, t.message, t.category, t.priority]
      );
    }
    console.log('✅ Template awal (Bahasa Indonesia) berhasil di-seed');

    await client.query('COMMIT');
    console.log('🎉 Setup System Notices selesai!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Setup System Notices gagal:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

setupSystemNotices();
