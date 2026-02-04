import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create demo user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const userResult = await query(
      `INSERT INTO users (id, email, password, full_name, role, department, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [uuidv4(), 'admin@matafinance.com', hashedPassword, 'Admin Finance Demo', 'admin_finance', 'Finance', true]
    );
    
    const userId = userResult.rows[0].id;
    console.log('✅ Demo user created:', userId);

    // Create sample transactions
    const transactionTypes = ['payment', 'transfer', 'invoice', 'reimbursement'];
    const statuses = ['draft', 'submitted', 'under_review', 'approved', 'completed'];
    
    for (let i = 0; i < 15; i++) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      const transactionCode = `TRX-${dateStr}-${randomStr}`;
      
      const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const amount = Math.floor(Math.random() * 50000000) + 100000;
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 14));
      
      await query(
        `INSERT INTO transactions 
         (id, user_id, transaction_code, transaction_type, amount, currency, status, 
          description, recipient_name, due_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          uuidv4(), userId, transactionCode, type, amount, 'IDR', status,
          `Transaksi ${type} - ${i + 1}`, `Vendor ${i + 1}`, 
          status !== 'draft' ? dueDate : null,
          new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        ]
      );
    }
    console.log('✅ Sample transactions created');

    // Create sample alerts
    const alertTypes = [
      { type: 'draft_expiring', title: 'Draft Hampir Kedaluwarsa', severity: 'warning' },
      { type: 'revision_pending', title: 'Revisi Tertunda', severity: 'info' },
      { type: 'sla_warning', title: 'Peringatan SLA', severity: 'critical' },
      { type: 'repeated_error', title: 'Kesalahan Berulang Terdeteksi', severity: 'warning' }
    ];

    for (let i = 0; i < 5; i++) {
      const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      await query(
        `INSERT INTO personal_alerts (id, user_id, alert_type, title, message, severity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(), userId, alert.type, alert.title,
          `Pesan peringatan untuk ${alert.title.toLowerCase()}`,
          alert.severity
        ]
      );
    }
    console.log('✅ Sample alerts created');

    // Create sample activity logs
    const actions = ['LOGIN', 'CREATE_TRANSACTION', 'SUBMIT_TRANSACTION', 'VIEW_DASHBOARD'];
    
    for (let i = 0; i < 20; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      await query(
        `INSERT INTO activity_logs (id, user_id, action, created_at)
         VALUES ($1, $2, $3, $4)`,
        [
          uuidv4(), userId, action,
          new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
        ]
      );
    }
    console.log('✅ Sample activity logs created');

    console.log('\n🎉 Database seeding completed!');
    console.log('\n📧 Demo credentials:');
    console.log('   Email: admin@matafinance.com');
    console.log('   Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seed();
