import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

async function seedApproval() {
  try {
    console.log('🌱 Seeding approval user with active history...');

    const hashedPassword = await bcrypt.hash('approval123', 12);
    
    // 1. Create/Update Approval User
    const userResult = await query(
      `INSERT INTO users (id, email, password, full_name, role, department, is_active, public_alias)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET role = 'approval'
       RETURNING id`,
      [uuidv4(), 'approval@matafinance.com', hashedPassword, 'Chief Approval Officer', 'approval', 'Risk Management', true, 'APPROVER-001']
    );
    
    const userId = userResult.rows[0].id;
    console.log('✅ Approval user id:', userId);

    // 2. Clear old logs to ensure clean threshold check
    await query('DELETE FROM activity_logs WHERE user_id = $1', [userId]);

    // 3. Inject 25 "APPROVE" actions to pass Level 1 Threshold (N > 20)
    console.log('📊 Injecting 25 approval decisions (Metadata only)...');
    for (let i = 0; i < 25; i++) {
        // Stimulate rapid fire for speed deviation check (intervals < 15s)
        const timestamp = new Date(Date.now() - (i * 10 * 1000)); // 10 seconds interval
        await query(
            `INSERT INTO activity_logs (id, user_id, action, created_at)
             VALUES ($1, $2, $3, $4)`,
            [uuidv4(), userId, 'APPROVE', timestamp]
        );
    }

    console.log('✅ 25 logs injected. Threshold (Level 1) & Speed Deviation (Level 2) should trigger.');
    
    console.log('\n📧 Approval credentials:');
    console.log('   Email: approval@matafinance.com');
    console.log('   Password: approval123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedApproval();
