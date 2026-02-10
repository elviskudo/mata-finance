import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
import approvalContextService from '../services/approvalContext.service.js';
import approvalQueueService from '../services/approvalQueue.service.js';
import { query } from '../config/database.js';
import auditService from '../services/audit.service.js';
import emergencyService from '../services/emergency.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/approval/home-context:
 *   get:
 *     summary: Get Approval Home Context (Hidden Logic)
 *     tags: [Approval]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Home context containing pending items and workload label
 *       401:
 *         description: Unauthorized
 */
router.get('/home-context', authenticateToken, async (req, res) => {
  try {
    const approvalId = req.user.id;
    
    // Build context using service (Hidden Logic internally)
    const context = await approvalContextService.getHomeContext(approvalId);

    // Payload contains ONLY pending count, label, and generic reminder
    // No history, no metrics, no causes.
    res.json({
      success: true,
      message: 'Home context retrieved successfully',
      data: {
        pending_items: context.pendingCount,
        workload_label: context.workloadLabel,
        reminder: context.reminder
      }
    });
  } catch (error) {
    console.error('Approval context error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve home context'
    });
  }
});

/**
 * @swagger
 * /api/approval/stats:
 *   get:
 *     summary: Get Approval Statistics
 *     tags: [Approval]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const approvalId = req.user.id;

    // Today's activity
    const todayResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE action = 'APPROVE' AND DATE(created_at) = CURRENT_DATE) as approved,
        COUNT(*) FILTER (WHERE action = 'REJECT' AND DATE(created_at) = CURRENT_DATE) as rejected
      FROM activity_logs
      WHERE user_id = $1
    `, [approvalId]);

    // Pending count
    const pendingResult = await query(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE status IN ('submitted', 'resubmitted')
    `);

    // Week's activity
    const weekResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE action = 'APPROVE') as approved,
        COUNT(*) FILTER (WHERE action = 'REJECT') as rejected
      FROM activity_logs
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
        AND action IN ('APPROVE', 'REJECT')
    `, [approvalId]);

    // Average processing time (in minutes)
    const processingTimeResult = await query(`
      SELECT 
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 60),
          0
        ) as avg_minutes
      FROM transactions
      WHERE approved_at IS NOT NULL AND submitted_at IS NOT NULL
        AND approved_at > NOW() - INTERVAL '7 days'
    `);

    const weekApproved = parseInt(weekResult.rows[0].approved);
    const weekTotal = parseInt(weekResult.rows[0].total);
    const approvalRate = weekTotal > 0 ? Math.round((weekApproved / weekTotal) * 100) : 0;

    res.json({
      success: true,
      data: {
        today: {
          approved: parseInt(todayResult.rows[0].approved),
          rejected: parseInt(todayResult.rows[0].rejected),
          pending: parseInt(pendingResult.rows[0].count)
        },
        week: {
          approved: weekApproved,
          rejected: parseInt(weekResult.rows[0].rejected),
          total: weekTotal
        },
        avgProcessingTime: Math.round(parseFloat(processingTimeResult.rows[0].avg_minutes)),
        approvalRate
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

/**
 * @swagger
 * /api/approval/queue:
 *   get:
 *     summary: Get Pending Transactions Queue (Exception-Aware Routing)
 *     description: |
 *       Returns a masked queue of items. The queue ordering is system-controlled
 *       and may change between refreshes. Items are labeled with behavioral hints only.
 *       No vendor details, user identity, or exact amounts are exposed in queue view.
 *     tags: [Approval]
 *     security:
 *       - bearerAuth: []
 */
router.get('/queue', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const approvalId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Use ApprovalQueueService for exception-aware routing
    const queueResult = await approvalQueueService.buildQueue(approvalId, { limit, offset });

    res.json({
      success: true,
      data: queueResult.items,
      meta: {
        total: queueResult.total,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue'
    });
  }
});

/**
 * @swagger
 * /api/approval/transactions/{id}:
 *   get:
 *     summary: Get Transaction Details for Review
 *     tags: [Approval]
 */
router.get('/transactions/:id', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        t.*,
        u.public_alias as submitter_alias,
        u.department as submitter_department,
        er.id as emergency_id,
        er.admin_reason as emergency_reason
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN emergency_requests er ON t.id = er.transaction_id AND er.status = 'PENDING'
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Get transaction timeline
    const timeline = await query(`
      SELECT action, details, created_at, 
             (SELECT public_alias FROM users WHERE id = activity_logs.user_id) as actor_alias
      FROM activity_logs
      WHERE entity_id = $1 AND entity_type = 'transaction'
      ORDER BY created_at ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        timeline: timeline.rows
      }
    });
  } catch (error) {
    console.error('Transaction detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction'
    });
  }
});

/**
 * @swagger
 * /api/approval/transactions/{id}/approve:
 *   post:
 *     summary: Approve a Transaction
 *     tags: [Approval]
 */
router.post('/transactions/:id/approve', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const approvalId = req.user.id;

    // Update transaction status
    const result = await query(`
      UPDATE transactions 
      SET status = 'approved', 
          approved_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes || E'\n', '') || $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('submitted', 'resubmitted')
      RETURNING *
    `, [id, notes ? `[Approval Notes] ${notes}` : '']);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or already processed'
      });
    }

    const transaction = result.rows[0];

    // Create alert for admin who submitted this transaction
    try {
      await query(`
        INSERT INTO personal_alerts (id, user_id, alert_type, severity, title, message, related_entity_type, related_entity_id, created_at)
        VALUES ($1, $2, 'APPROVED', 'success', $3, $4, 'transaction', $5, CURRENT_TIMESTAMP)
      `, [
        uuidv4(),
        transaction.user_id,
        `Transaksi ${transaction.transaction_code} disetujui`,
        notes ? `Catatan: ${notes}` : 'Transaksi Anda telah disetujui.',
        transaction.id
      ]);
    } catch (alertError) {
      console.error('Failed to create alert:', alertError);
      // Don't fail the main operation if alert creation fails
    }

    // Log activity dengan entity_type='transaction' agar muncul di timeline admin
    auditService.logActivity(approvalId, 'APPROVE', 'transaction', id, {
      notes,
      previousStatus: transaction.status,
      newStatus: 'approved',
      transactionCode: transaction.transaction_code,
      message: notes ? `Disetujui dengan catatan: ${notes}` : 'Transaksi disetujui oleh Approval'
    });

    res.json({
      success: true,
      message: 'Transaction approved successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve transaction'
    });
  }
});

/**
 * @swagger
 * /api/approval/transactions/{id}/reject:
 *   post:
 *     summary: Permanently Reject a Transaction
 *     description: |
 *       Permanently rejects a transaction. Admin will be notified that transaction 
 *       is rejected and must create a new transaction from scratch.
 *       Status changes to 'rejected' (final state, cannot be revised).
 *     tags: [Approval]
 */
router.post('/transactions/:id/reject', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, rejectionType = 'permanent' } = req.body;
    const approvalId = req.user.id;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required (minimum 10 characters)'
      });
    }

    // Update transaction status to 'rejected'
    const result = await query(`
      UPDATE transactions 
      SET status = 'rejected', 
          reject_reason = $2,
          reviewed_at = CURRENT_TIMESTAMP,
          internal_flags = jsonb_set(
            jsonb_set(
              jsonb_set(COALESCE(internal_flags, '{}'), '{locked}', 'true'),
              '{rejection_type}', $3
            ),
            '{replacement_status}', $4
          ),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('submitted', 'resubmitted')
      RETURNING *
    `, [id, reason, `"${rejectionType}"`, rejectionType === 'request_new' ? '"pending"' : '"none"']);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or already processed'
      });
    }

    const transaction = result.rows[0];

    // Notification details based on rejection type
    let alertTitle, alertMessage, severity;
    if (rejectionType === 'request_new') {
      alertTitle = `Transaksi ${transaction.transaction_code} Ditolak (Mohon Buat Baru)`;
      alertMessage = `Transaksi Anda ditolak. Alasan: ${reason}. Silakan buat transaksi baru yang serupa sebagai pengganti.`;
      severity = 'warning';
    } else {
      alertTitle = `Transaksi ${transaction.transaction_code} DITOLAK PERMANEN`;
      alertMessage = `Transaksi Anda ditolak permanen. Alasan: ${reason}. Penolakan ini bersifat final dan tidak boleh dibuat baru lagi.`;
      severity = 'danger';
    }

    // Create alert for admin
    try {
      await query(`
        INSERT INTO personal_alerts (id, user_id, alert_type, severity, title, message, related_entity_type, related_entity_id, created_at)
        VALUES ($1, $2, 'REJECTED', $3, $4, $5, 'transaction', $6, CURRENT_TIMESTAMP)
      `, [
        uuidv4(),
        transaction.user_id,
        severity,
        alertTitle,
        alertMessage,
        transaction.id
      ]);
    } catch (alertError) {
      console.error('Failed to create alert:', alertError);
    }

    // Log activity
    auditService.logActivity(approvalId, 'REJECT', 'transaction', id, {
      reason,
      rejectionType,
      previousStatus: transaction.status,
      newStatus: 'rejected',
      transactionCode: transaction.transaction_code,
      message: rejectionType === 'request_new' 
        ? `Ditolak dengan permintaan buat baru: ${reason}` 
        : `Ditolak permanen: ${reason}`
    });

    res.json({
      success: true,
      message: rejectionType === 'request_new' 
        ? 'Transaction rejected with request for new submission' 
        : 'Transaction rejected permanently',
      data: transaction
    });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject transaction'
    });
  }
});

/**
 * @swagger
 * /api/approval/transactions/{id}/clarify:
 *   post:
 *     summary: Request Clarification / Return for Revision
 *     description: |
 *       Returns a transaction to admin for revision/clarification.
 *       Status changes to 'returned' so it appears in admin's revision menu.
 *       Admin can edit and resubmit the transaction.
 *     tags: [Approval]
 */
router.post('/transactions/:id/clarify', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const approvalId = req.user.id;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Clarification reason is required (minimum 10 characters)'
      });
    }

    // Update transaction status to 'returned' so it goes to admin's revision menu
    const result = await query(`
      UPDATE transactions 
      SET status = 'returned', 
          reject_reason = $2,
          reviewed_at = CURRENT_TIMESTAMP,
          revision_count = revision_count + 1,
          internal_flags = jsonb_set(COALESCE(internal_flags, '{}'), '{locked}', 'false'),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('submitted', 'resubmitted')
      RETURNING *
    `, [id, reason]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or already processed'
      });
    }

    const transaction = result.rows[0];

    // Create alert for admin - REVISION REQUIRED (can be edited)
    try {
      await query(`
        INSERT INTO personal_alerts (id, user_id, alert_type, severity, title, message, related_entity_type, related_entity_id, created_at)
        VALUES ($1, $2, 'CLARIFICATION_REQUIRED', 'warning', $3, $4, 'transaction', $5, CURRENT_TIMESTAMP)
      `, [
        uuidv4(),
        transaction.user_id,
        `Transaksi ${transaction.transaction_code} perlu klarifikasi`,
        `Transaksi Anda dikembalikan untuk klarifikasi/revisi. Silakan periksa dan submit ulang.\n\nCatatan: ${reason}`,
        transaction.id
      ]);
    } catch (alertError) {
      console.error('Failed to create alert:', alertError);
    }

    // Log activity
    auditService.logActivity(approvalId, 'CLARIFY', 'transaction', id, {
      reason,
      previousStatus: transaction.status,
      newStatus: 'returned',
      transactionCode: transaction.transaction_code,
      message: `Dikembalikan untuk klarifikasi: ${reason}`
    });

    res.json({
      success: true,
      message: 'Transaction returned for clarification',
      data: transaction
    });
  } catch (error) {
    console.error('Clarify error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request clarification'
    });
  }
});

/**
 * @swagger
 * /api/approval/emergency-list:
 *   get:
 *     summary: Get Emergency Request List
 *     tags: [Approval]
 */
router.get('/emergency-list', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const approvalId = req.user.id;
    const items = await emergencyService.buildEmergencyList(approvalId);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Emergency list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve emergency list'
    });
  }
});

export default router;
