import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, guardPersonalData } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Ambil ringkasan beranda (hanya data pribadi)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ringkasan beranda
 *       401:
 *         description: Unauthorized
 */
router.get('/summary', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Count transactions today
    const todayTransactionsResult = await query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = $1 AND created_at >= $2 AND is_latest = true`,
      [userId, today.toISOString()]
    );

    // 2. Count active drafts (not expired)
    const activeDraftsResult = await query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = $1 AND status = 'draft' 
       AND (expired_at IS NULL OR expired_at > CURRENT_TIMESTAMP) AND is_latest = true`,
      [userId]
    );

    // 3. Count pending transactions (submitted/reviewed)
    const pendingResult = await query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = $1 AND status IN ('submitted', 'under_review') AND is_latest = true`,
      [userId]
    );

    // 4. Count revisions (returned)
    const revisionsResult = await query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = $1 AND status = 'returned' AND is_latest = true`,
      [userId]
    );

    // 4. Get SLA warnings (approaching deadline)
    const slaWarningsResult = await query(
      `SELECT t.id, t.transaction_code, t.transaction_type, t.due_date, 
              sc.warning_hours, sc.critical_hours
       FROM transactions t
       LEFT JOIN sla_configs sc ON t.transaction_type = sc.transaction_type
       WHERE t.user_id = $1 
         AND t.status IN ('submitted', 'under_review')
         AND t.due_date IS NOT NULL
         AND t.due_date <= CURRENT_TIMESTAMP + INTERVAL '48 hours'
         AND t.is_latest = true
       ORDER BY t.due_date ASC
       LIMIT 10`,
      [userId]
    );

    // 5. Get personal alerts
    const alertsResult = await query(
      `SELECT id, alert_type, title, message, severity, created_at 
       FROM personal_alerts 
       WHERE user_id = $1 AND is_read = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    // 6. Get activity summary
    const activitySummaryResult = await query(
      `SELECT 
        COUNT(*) as total_activities,
        COUNT(CASE WHEN action = 'CREATE_TRANSACTION' THEN 1 END) as transactions_created,
        COUNT(CASE WHEN action = 'REVISION' THEN 1 END) as revisions,
        MIN(created_at) as first_activity_today,
        MAX(created_at) as last_activity_today
       FROM activity_logs 
       WHERE user_id = $1 AND created_at >= $2`,
      [userId, today.toISOString()]
    );

    // 7. Transaction stats by status
    const statusStatsResult = await query(
      `SELECT status, COUNT(*) as count 
       FROM transactions 
       WHERE user_id = $1 AND is_latest = true
       GROUP BY status`,
      [userId]
    );

    // 8. Recent transactions
    const recentTransactionsResult = await query(
      `SELECT id, transaction_code, transaction_type, amount, status, created_at 
       FROM transactions 
       WHERE user_id = $1 AND is_latest = true
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId]
    );

    // Sanitize and prepare response (remove forbidden data)
    const summaryData = {
      today: {
        transactionsCount: parseInt(todayTransactionsResult.rows[0].count),
        date: today.toISOString().split('T')[0]
      },
      drafts: {
        activeCount: parseInt(activeDraftsResult.rows[0].count)
      },
      pending: {
        count: parseInt(pendingResult.rows[0].count)
      },
      revisions: {
        count: parseInt(revisionsResult.rows[0].count)
      },
      slaWarnings: slaWarningsResult.rows.map(row => ({
        id: row.id,
        transactionCode: row.transaction_code,
        type: row.transaction_type,
        dueDate: row.due_date,
        status: calculateSlaStatus(row.due_date, row.warning_hours, row.critical_hours)
      })),
      alerts: alertsResult.rows.map(row => ({
        id: row.id,
        type: row.alert_type,
        title: row.title,
        message: row.message,
        severity: row.severity,
        createdAt: row.created_at
      })),
      activitySummary: {
        totalToday: parseInt(activitySummaryResult.rows[0].total_activities),
        transactionsCreated: parseInt(activitySummaryResult.rows[0].transactions_created || 0),
        revisions: parseInt(activitySummaryResult.rows[0].revisions || 0),
        workingHours: calculateWorkingHours(
          activitySummaryResult.rows[0].first_activity_today,
          activitySummaryResult.rows[0].last_activity_today
        )
      },
      statusBreakdown: statusStatsResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      recentTransactions: recentTransactionsResult.rows.map(row => ({
        id: row.id,
        code: row.transaction_code,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        status: row.status,
        createdAt: row.created_at
      }))
    };

    res.json({
      success: true,
      message: 'Ringkasan beranda berhasil diambil',
      data: summaryData,
      meta: {
        accessScope: 'personal_data_only',
        userId: userId,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data dashboard'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/company-data:
 *   get:
 *     summary: Akses data keuangan perusahaan (DITOLAK untuk Admin Finance)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       403:
 *         description: Akses ditolak
 */
router.get('/company-data', authenticateToken, (req, res) => {
  // This endpoint simulates the forbidden access scenario
  // Admin Finance cannot access company financial data
  res.status(403).json({
    success: false,
    message: 'Akses ditolak. Anda tidak memiliki izin untuk melihat data keuangan perusahaan.',
    error: {
      code: 'ACCESS_DENIED',
      reason: 'Akun Admin Finance hanya memiliki akses ke data transaksi pribadi',
      requiredRole: 'finance_manager',
      currentRole: req.user.role
    }
  });
});

/**
 * @swagger
 * /api/dashboard/activity:
 *   get:
 *     summary: Ambil log aktivitas pribadi
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Jumlah maksimal data
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset untuk pagination
 *     responses:
 *       200:
 *         description: Log aktivitas
 */
router.get('/activity', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT id, action, entity_type, entity_id, details, created_at 
       FROM activity_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM activity_logs WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: row.details,
        createdAt: row.created_at
      })),
      meta: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil log aktivitas'
    });
  }
});

// Helper functions
function calculateSlaStatus(dueDate, warningHours = 24, criticalHours = 48) {
  if (!dueDate) return 'normal';
  
  const now = new Date();
  const due = new Date(dueDate);
  const hoursRemaining = (due - now) / (1000 * 60 * 60);
  
  if (hoursRemaining <= 0) return 'overdue';
  if (hoursRemaining <= warningHours) return 'critical';
  if (hoursRemaining <= criticalHours) return 'warning';
  return 'normal';
}

function calculateWorkingHours(firstActivity, lastActivity) {
  if (!firstActivity || !lastActivity) return null;
  
  const first = new Date(firstActivity);
  const last = new Date(lastActivity);
  const hours = (last - first) / (1000 * 60 * 60);
  
  return {
    start: first.toISOString(),
    end: last.toISOString(),
    durationHours: Math.round(hours * 100) / 100
  };
}

export default router;
