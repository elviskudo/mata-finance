import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult, param } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles, guardPersonalData } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import ocrService from '../services/ocr.service.js';
import validationService from '../services/validation.service.js';
import auditService from '../services/audit.service.js';
import masterService from '../services/master.service.js';
import draftRevisiService from '../services/draftRevisi.service.js';
import guardService from '../services/guard.service.js';
import approvalService from '../services/approval.service.js';
import exceptionService from '../services/exception.service.js';
import accountingQueueService from '../services/accountingQueue.service.js';
import emergencyService from '../services/emergency.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Ambil daftar transaksi pribadi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Daftar transaksi
 */

/**
 * @swagger
 * /api/transactions/init:
 *   post:
 *     summary: Inisialisasi Transaksi Baru (Entry Hub)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionType:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaksi berhasil diinisialisasi
 */

/**
 * @swagger
 * /api/transactions/entry-hub:
 *   get:
 *     summary: Ambil ringkasan draft (Entry Hub)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ringkasan draft dan status
 */
// --- 0. ENTRY HUB - Draft Summary ---
router.get('/entry-hub', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get draft summary (in_progress, draft, returned)
    const draftsResult = await query(
      `SELECT id, transaction_code, transaction_type, amount, status, created_at, updated_at
       FROM transactions 
       WHERE user_id = $1 AND status IN ('in_progress', 'draft', 'returned') AND is_latest = true
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId]
    );

    // Count by status
    const countResult = await query(
      `SELECT status, COUNT(*) as count
       FROM transactions
       WHERE user_id = $1 AND status IN ('in_progress', 'draft', 'returned') AND is_latest = true
       GROUP BY status`,
      [userId]
    );

    const counts = countResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        drafts: draftsResult.rows.map(r => ({
          id: r.id,
          code: r.transaction_code,
          type: r.transaction_type,
          amount: parseFloat(r.amount),
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        summary: {
          inProgress: counts.in_progress || 0,
          draft: counts.draft || 0,
          returned: counts.returned || 0,
          total: (counts.in_progress || 0) + (counts.draft || 0) + (counts.returned || 0),
        }
      }
    });
  } catch (error) {
    console.error('Entry hub error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- 1. LIST TRANSACTIONS ---
router.get(
  '/',
  authenticateToken,
  guardPersonalData,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // ✅ Ambil query params PALING ATAS (hindari TDZ)
      const {
        status,
        type,
        limit = 20,
        offset = 0
      } = req.query;

      /* =========================
         MAIN QUERY
      ========================= */
      let queryText = `
        SELECT t.*, 
               u.public_alias as submitter_alias,
               sc.warning_hours, sc.critical_hours
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN sla_configs sc ON t.transaction_type = sc.transaction_type
        WHERE t.user_id = $1 AND t.is_latest = true
      `;

      const params = [userId];
      let paramIndex = 2;

      /* ===== Status filter ===== */
      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',').map(s => s.trim());
          queryText += ` AND t.status = ANY($${paramIndex}::text[])`;
          params.push(statuses);
        } else {
          queryText += ` AND t.status = $${paramIndex}`;
          params.push(status);
        }
        paramIndex++;
      }

      /* ===== Type filter ===== */
      if (type) {
        queryText += ` AND t.transaction_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      /* ===== Pagination ===== */
      queryText += `
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex}
        OFFSET $${paramIndex + 1}
      `;
      params.push(Number(limit), Number(offset));

      const result = await query(queryText, params);

      /* =========================
         COUNT QUERY (mirror filter)
      ========================= */
      let countQueryText = `
        SELECT COUNT(*) AS total
        FROM transactions t
        WHERE t.user_id = $1 AND t.is_latest = true
      `;

      const countParams = [userId];
      let countParamIndex = 2;

      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',').map(s => s.trim());
          countQueryText += ` AND t.status = ANY($${countParamIndex}::text[])`;
          countParams.push(statuses);
        } else {
          countQueryText += ` AND t.status = $${countParamIndex}`;
          countParams.push(status);
        }
        countParamIndex++;
      }

      if (type) {
        countQueryText += ` AND t.transaction_type = $${countParamIndex}`;
        countParams.push(type);
        countParamIndex++;
      }

      const countRes = await query(countQueryText, countParams);

      /* =========================
         RESPONSE
      ========================= */
      res.json({
        success: true,
        data: result.rows.map(r => ({
          id: r.id,
          code: r.transaction_code,
          type: r.transaction_type,
          amount: Number(r.amount),
          currency: r.currency,
          status: r.status,
          description: r.description,
          recipientName: r.recipient_name,
          dueDate: r.due_date,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          submittedAt: r.submitted_at,
          slaDueAt: r.sla_due_at,
          riskLevel: r.risk_level,
          expiredAt: r.expired_at,
          internalFlags: r.internal_flags,
          revisionCount: r.revision_count
        })),
        meta: {
          total: Number(countRes.rows[0].total),
          limit: Number(limit),
          offset: Number(offset)
        }
      });

    } catch (error) {
      console.error('List transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);


/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Ambil detail satu transaksi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail transaksi
 */
// --- 2. GET SINGLE ---
router.get('/:id', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get Trans + Items + Docs
    const tRes = await query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
    if (tRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    const transaction = tRes.rows[0];

    const iRes = await query('SELECT * FROM transaction_items WHERE transaction_id = $1', [id]);
    const dRes = await query('SELECT * FROM transaction_documents WHERE transaction_id = $1 ORDER BY uploaded_at DESC LIMIT 1', [id]);

    // Sanitize for admin finance: remove sensitive data like approver, risk if not owner or not allowed
    // For admin finance, remove riskLevel and any approver info (but currently no approver field)
    const sanitized = {
      id: transaction.id,
      code: transaction.transaction_code,
      type: transaction.transaction_type,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      status: transaction.status,
      description: transaction.description,
      recipientName: transaction.recipient_name,
      recipientAccount: transaction.recipient_account,
      dueDate: transaction.due_date,
      notes: transaction.notes,
      // riskLevel: transaction.risk_level, // Removed for sanitization
      ocrStatus: transaction.ocr_status,
      ocrResult: dRes.rows[0]?.ocr_result || null, // Latest document OCR result
      precheckReport: transaction.precheck_report || null,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
      submittedAt: transaction.submitted_at,
      items: iRes.rows.map(i => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        accountCode: i.account_code,
        price: parseFloat(i.unit_price),
        total_amount: parseFloat(i.total_amount)
      })),
      documents: dRes.rows
    };

    res.json({
      success: true,
      data: sanitized
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/timeline:
 *   get:
 *     summary: Ambil timeline aktivitas transaksi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timeline transaksi
 */
// --- 2.5. GET TIMELINE ---
router.get('/:id/timeline', authenticateToken, authorizeRoles('admin_finance'), guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check owner
    const check = await query('SELECT id FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

    // Get public events: activity logs for this transaction, excluding sensitive actions
    const eventsRes = await query(
      `SELECT action, details, created_at
       FROM activity_logs
       WHERE entity_type = 'transaction' AND entity_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // Also add transaction status events
    const txRes = await query(
      `SELECT status, submitted_at, reviewed_at, approved_at, completed_at, created_at, updated_at
       FROM transactions WHERE id = $1`,
      [id]
    );
    const tx = txRes.rows[0];

    const timeline = [];

    // Add creation
    timeline.push({
      event: 'Created',
      timestamp: tx.created_at,
      details: 'Transaction created'
    });

    // Add submission
    if (tx.submitted_at) {
      timeline.push({
        event: 'Submitted',
        timestamp: tx.submitted_at,
        details: 'Transaction submitted for approval'
      });
    }

    // Add review
    if (tx.reviewed_at) {
      timeline.push({
        event: 'Reviewed',
        timestamp: tx.reviewed_at,
        details: 'Transaction reviewed'
      });
    }

    // Add approval
    if (tx.approved_at) {
      timeline.push({
        event: 'Approved',
        timestamp: tx.approved_at,
        details: 'Transaction approved'
      });
    }

    // Add completion
    if (tx.completed_at) {
      timeline.push({
        event: 'Completed',
        timestamp: tx.completed_at,
        details: 'Transaction completed'
      });
    }

    // Add activity events (public ones, sanitize)
    eventsRes.rows.forEach(e => {
      timeline.push({
        event: e.action,
        timestamp: e.created_at,
        details: e.details?.message || e.action
      });
    });

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- 3. INIT TRANSACTION (STEP 1) ---
router.post('/init', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;
    // Step 1: Create Stub
    // Diagram: "Buat transaksi status=IN_PROGRESS"
    const { transactionType } = req.body; // Required: 'payment' | 'expense' | 'general'

    if (!transactionType) {
      return res.status(400).json({ success: false, message: 'Transaction type is required' });
    }

    // Get schema for transaction type (field requirements & validation rules)
    const schema = masterService.getTransactionTypeSchema(transactionType);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `TRX-${dateStr}-${randomStr}`;

    const result = await query(
      `INSERT INTO transactions (id, user_id, transaction_type, transaction_code, status, amount, currency, created_at)
       VALUES ($1, $2, $3, $4, 'in_progress', 0, 'IDR', CURRENT_TIMESTAMP)
       RETURNING id, transaction_code, status`,
      [uuidv4(), userId, transactionType, code]
    );

    // Save schema to internal_flags for reference
    await query(
      `UPDATE transactions SET internal_flags = $1 WHERE id = $2`,
      [JSON.stringify({ schema, approvalPath: schema.defaultApprovalPath }), result.rows[0].id]
    );

    auditService.logActivity(userId, 'INIT_TRANSACTION', 'transaction', result.rows[0].id, { type: transactionType });

    res.status(201).json({
      success: true,
      message: 'Transaksi diinisialisasi',
      data: {
        id: result.rows[0].id,
        code: result.rows[0].transaction_code,
        status: result.rows[0].status,
        schema, // Return schema to frontend for form rendering
      }
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- HELPER: Verify Editable Status ---
const ensureEditable = async (id, userId) => {
  const res = await query('SELECT status FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
  if (res.rows.length === 0) throw new Error('Transaction not found');
  const status = res.rows[0].status;
  if (!['in_progress', 'draft', 'returned'].includes(status)) {
    throw new Error('Transaction is LOCKED. Cannot edit submitted or final transactions.');
  }
};

/**
 * @swagger
 * /api/transactions/{id}/header:
 *   put:
 *     summary: Simpan data utama (header) transaksi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendorName:
 *                 type: string
 *               invoiceDate:
 *                 type: string
 *                 format: date
 *               invoiceNumber:
 *                 type: string
 *               costCenter:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *     responses:
 *       200:
 *         description: Header berhasil diupdate
 */
// --- 4. SAVE HEADER (STEP 2) ---
router.put('/:id/header', authenticateToken, guardPersonalData, [
  body('vendorName').notEmpty(),
  body('invoiceDate').isDate(),
  body('amount').isNumeric()
], async (req, res) => {
  try {
    const { id } = req.params;
    await ensureEditable(id, req.user.id); // LOCK CHECK

    const { vendorName, invoiceDate, invoiceNumber, costCenter, description, amount, currency } = req.body;

    // Master Data: Auto-suggest & validate vendor
    const vendorCheck = await masterService.suggestVendor(vendorName);
    let vendorId = vendorCheck.vendorId || null;
    const vendorFlag = vendorCheck.flag; // 'VENDOR_RARELY_USED' | 'VENDOR_SIMILAR_FOUND' | null

    // Master Data: Validate cost center
    const costCenterCheck = await masterService.validateCostCenter(costCenter);
    if (!costCenterCheck.valid && costCenter) {
      // Log warning but don't block
      auditService.logSignal(req.user.id, 'INVALID_COST_CENTER', { txId: id, code: costCenter }, 'WARNING');
    }

    // Silent checks (observasi halus tanpa memblokir)
    const isFuture = new Date(invoiceDate) > new Date();
    const isBackdate = new Date(invoiceDate) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // > 90 days ago

    // Build internal flags
    const internalFlags = {
      vendorFlag,
      futureDate: isFuture,
      backdate: isBackdate,
      costCenterValid: costCenterCheck.valid,
    };

    await query(
      `UPDATE transactions
       SET recipient_name = $1, due_date = $2, invoice_number = $3,
           cost_center = $4, description = $5, amount = $6, currency = $7,
           vendor_id = $8, internal_flags = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [
        vendorName, invoiceDate, invoiceNumber, costCenter, description,
        amount, currency || 'IDR', vendorId, JSON.stringify(internalFlags), id
      ]
    );

    // Extend TTL on save
    await query('UPDATE transactions SET expired_at = CURRENT_TIMESTAMP + INTERVAL \'24 hours\' WHERE id = $1', [id]);

    // Audit log for save
    auditService.logActivity(req.user.id, 'SAVE_DRAFT', 'transaction', id, { action: 'header_update' });

    // Silent audit signals
    if (isFuture) {
      auditService.logSignal(req.user.id, 'FUTURE_DATE_DETECTED', { txId: id, date: invoiceDate }, 'WARNING');
    }
    if (isBackdate) {
      auditService.logSignal(req.user.id, 'BACKDATE_DETECTED', { txId: id, date: invoiceDate }, 'WARNING');
    }
    if (vendorFlag) {
      auditService.logSignal(req.user.id, vendorFlag, { txId: id, vendor: vendorName }, 'INFO');
    }

    res.json({ 
      success: true, 
      message: 'Header updated',
      flags: {
        vendor: vendorFlag,
        date: isFuture ? 'FUTURE' : isBackdate ? 'BACKDATE' : null,
      }
    });
  } catch (error) {
    console.error('Header update error:', error);
    res.status(error.message.includes('LOCKED') ? 403 : 500).json({ success: false, message: error.message || 'Server error' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/items:
 *   post:
 *     summary: Simpan item-item transaksi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     accountCode:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     price:
 *                       type: number
 *     responses:
 *       200:
 *         description: Item berhasil disimpan
 */
// --- 5. ADD ITEM (STEP 3) ---
router.post('/:id/items', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    await ensureEditable(id, req.user.id); // LOCK CHECK

    const { items } = req.body; // Array of items
    
    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items required' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.description || item.price < 0 || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid item data' });
      }
    }

    // SYNC MODE: Delete existing items first to allow edits/re-save without duplicates
    await query('DELETE FROM transaction_items WHERE transaction_id = $1', [id]);

    // Insert items and validate GL accounts
    const itemFlags = [];
    for (const item of items) {
      // Validate GL account if provided
      const glCheck = await masterService.suggestGLAccount(item.accountCode);
      const glValid = glCheck.suggestions.some(acc => acc.code === item.accountCode);
      
      if (item.accountCode && !glValid) {
        itemFlags.push({ item: item.description, flag: 'INVALID_GL_ACCOUNT' });
      }

      await query(
        `INSERT INTO transaction_items (id, transaction_id, description, account_code, quantity, unit_price, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), id, item.description, item.accountCode, item.quantity, item.price, item.quantity * item.price]
      );
    }
    
    // Calculate totals (auto-calculate subtotal/total)
    const totalSum = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    
    // Check debit-kredit balance (for accounting transactions)
    // In this simplified version, we just check if total > 0
    const isBalanced = totalSum > 0;
    
    // Check rounding patterns
    const hasRoundingIssue = items.some(item => {
      const total = item.quantity * item.price;
      const rounded = Math.round(total);
      return Math.abs(total - rounded) > 0.01;
    });

    // Update Transaction Amount based on Items Sum
    if (totalSum > 0) {
      await query('UPDATE transactions SET amount = $1 WHERE id = $2', [totalSum, id]);
    }

    // Update internal flags
    const currentFlags = await query('SELECT internal_flags FROM transactions WHERE id = $1', [id]);
    const flags = currentFlags.rows[0]?.internal_flags || {};
    flags.itemsCalculated = true;
    flags.itemsBalanced = isBalanced;
    flags.roundingIssue = hasRoundingIssue;
    flags.itemFlags = itemFlags;

    await query('UPDATE transactions SET internal_flags = $1 WHERE id = $2', [JSON.stringify(flags), id]);

    // Extend TTL on save
    await query('UPDATE transactions SET expired_at = CURRENT_TIMESTAMP + INTERVAL \'24 hours\' WHERE id = $1', [id]);

    // Audit log for save
    auditService.logActivity(req.user.id, 'SAVE_DRAFT', 'transaction', id, { action: 'items_update' });

    res.json({
      success: true,
      message: 'Items saved successfully',
      calculated: {
        total: totalSum,
        itemCount: items.length,
        balanced: isBalanced,
      },
      flags: itemFlags.length > 0 ? itemFlags : null,
    });
  } catch (error) {
    console.error('Add items error:', error);
    res.status(error.message.includes('LOCKED') ? 403 : 500).json({ success: false, message: error.message || 'Server error' });
  }
});

// --- LEGACY/COMPATIBILITY: Create Transaction (Mapped to Init) ---
/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Buat transaksi baru (Legacy/Alias to Init)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     description: Endpoint ini dipertahankan untuk kompatibilitas. Akan membuat transaksi IN_PROGRESS.
 *     responses:
 *       201:
 *         description: Transaksi dibuat
 */
router.post('/', authenticateToken, guardPersonalData, async (req, res) => {
  // Forward logic to Init
  try {
    const userId = req.user.id;
    const { transactionType, amount, description, recipientName, recipientAccount, dueDate, currency } = req.body;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `TRX-${dateStr}-${randomStr}`;

    // Create directly with more data if legacy frontend sends it all at once
    const result = await query(
      `INSERT INTO transactions 
       (id, user_id, transaction_type, transaction_code, amount, currency, status, 
        description, recipient_name, recipient_account, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', $7, $8, $9, $10, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        uuidv4(), userId, transactionType || 'general', code, amount || 0, 
        currency || 'IDR', description, recipientName, recipientAccount, dueDate
      ]
    );

    auditService.logActivity(userId, 'CREATE_TRANSACTION', 'transaction', result.rows[0].id, { legacy: true });

    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil dibuat (Legacy Mode)',
      data: {
        id: result.rows[0].id,
        code: result.rows[0].transaction_code,
        status: result.rows[0].status
      }
    });
  } catch (error) {
    console.error('Create Legacy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/upload:
 *   post:
 *     summary: Upload dokumen transaksi dan jalankan OCR
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File berhasil diupload dan diproses
 */
// --- 6. UPLOAD DOC & OCR (STEP 4) ---
router.post('/:id/upload', authenticateToken, guardPersonalData, upload.single('document'), async (req, res) => {
  try {
    const { id } = req.params;
    await ensureEditable(id, req.user.id); // LOCK CHECK
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    console.log(`📁 Saving file metadata for Tx: ${id}, File: ${file.filename}`);
    
    // Save metadata
    await query(
      `INSERT INTO transaction_documents (id, transaction_id, file_name, file_path, file_type, ocr_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), id, file.filename, file.path, file.mimetype, 'processing']
    );

    auditService.logActivity(req.user.id, 'UPLOAD_DOCUMENT', 'transaction', id, { fileName: file.filename, fileType: file.mimetype });

    // Trigger OCR Service
    const ocrResult = await ocrService.processDocument(id, file);

    // Note: ocrService.processDocument already updates transaction_documents and transactions
    // with the result, ocr_status, and internal_flags (ocr_mismatch).
    // We only need to return the result to the frontend.

    res.json({
      success: true,
      message: 'File uploaded and processed',
      data: {
        document: file.filename,
        ocr: ocrResult
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(error.message.includes('LOCKED') ? 403 : 500).json({ success: false, message: error.message || 'Server error' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/pre-check:
 *   get:
 *     summary: Jalankan validasi pre-check transaksi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hasil pre-check
 */
// --- 7. PRE-CHECK (STEP 5) ---
router.get('/:id/pre-check', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check owner
    const check = await query('SELECT id FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

    const report = await validationService.validateTransaction(id);

    // Save precheck report to transaction
    await query(
      `UPDATE transactions SET precheck_report = $1 WHERE id = $2`,
      [JSON.stringify(report), id]
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Pre-check error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/submit:
 *   post:
 *     summary: Submit transaksi untuk approval
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               isEmergency:
 *                 type: boolean
 *               emergencyReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaksi berhasil disubmit
 */
// --- 8. SUBMIT ---
router.post('/:id/submit', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      notes,
      isEmergency: isEmergencyRaw,
      emergencyReason
    } = req.body;
    const userId = req.user.id;

    // Convert isEmergency to boolean if it's a string
    const isEmergency = isEmergencyRaw === true || isEmergencyRaw === 'true';

    console.log(`[Submit Flow] Processing tx:${id}, isEmergency:${isEmergency} (raw:${isEmergencyRaw})`);

    // =========================
    // 1. VALIDATE ACCESS
    // =========================
    await guardService.validateTransactionAccess(id, userId);

    // =========================
    // 2. TRANSACTION LOGIC (using pool.query for simplicity here as services use it)
    // =========================

    // =========================
    // 3. LOCK TRANSACTION
    // =========================
    await query(
      `UPDATE transactions
       SET status = 'precheck_locked',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // =========================
    // 4. GET LATEST DOCUMENT
    // =========================
    const docResult = await query(
      `SELECT ocr_result
       FROM transaction_documents
       WHERE transaction_id = $1
       ORDER BY uploaded_at DESC
       LIMIT 1`,
      [id]
    );

    if (docResult.rows.length === 0) {
      throw new Error('No document found for transaction');
    }

    const doc = docResult.rows[0];

    if (!doc.ocr_result) {
      throw new Error('OCR data not found - please upload document again');
    }

    // =========================
    // 5. SAFE OCR PARSE
    // =========================
    let ocrResult;
    try {
      ocrResult = typeof doc.ocr_result === 'string' ? JSON.parse(doc.ocr_result) : doc.ocr_result;
    } catch (err) {
      console.error('OCR parse error:', err, doc.ocr_result);
      throw new Error('Invalid OCR data format in database');
    }

    // =========================
    // 6. LOAD IMMUTABLE TX DATA
    // =========================
    const txResult = await query(
      `SELECT * FROM transactions WHERE id = $1`,
      [id]
    );

    if (txResult.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    const tx = txResult.rows[0];

    // =========================
    // 7. VALIDATE OCR vs TX
    // =========================
    // Extract the 'parsed' part which contains fields like vendor, grandTotal, etc.
    const ocrFields = ocrResult.parsed || ocrResult; 
    const validationResult = await validationService.validateOCRData(ocrFields, tx);

    auditService.logActivity(userId, 'SUBMIT_TRANSACTION', 'transaction', id);
    auditService.logSignal(userId, 'PRECHECK_START', {
      txId: id
    });

    // =========================
    // 8. BRANCH: FAIL / PASS
    // =========================
    if (!validationResult.match && !isEmergency) {
      // ---- FAIL → EXCEPTION CASE (ONLY if NOT emergency)
      const mismatches = validationResult.mismatches;

      const caseId = await exceptionService.createCase(
        id,
        userId,
        mismatches,
        mismatches,
        validationResult.summary
      );

      auditService.logSignal(userId, 'PRECHECK_FAIL', {
        txId: id,
        caseId,
        mismatches,
      });

      return res.json({
        success: true,
        message: 'Submit ditahan - Exception Case dibuat',
        data: {
          status: 'precheck_locked',
          caseId,
          locked: true,
          message: 'Transaksi tidak bisa diubah. Arahkan ke My Exceptions',
        },
        validationResult,
      });
    }

    // ---- PASS OR EMERGENCY BYPASS → SUBMIT FOR APPROVAL
    // If it's an emergency with mismatches, we still proceed but log it
    if (!validationResult.match && isEmergency) {
       auditService.logSignal(userId, 'PRECHECK_BYPASS_EMERGENCY', {
         txId: id,
         mismatches: validationResult.mismatches
       });
    }

    // ---- PASS → SUBMIT FOR APPROVAL
    if (tx.status === 'returned' || tx.status === 'rejected') {
      await approvalService.resubmitToApproval(id, userId, notes);
    } else {
      await approvalService.submitForApproval(id, userId);
      await query(
        `UPDATE transactions
         SET status = 'submitted',
             submitted_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
    }

    auditService.logSignal(userId, 'PRECHECK_PASS', {
      txId: id
    });

    // Handle emergency declaration before returning
    if (isEmergency) {
      console.log(`[Submit Flow] Declaring emergency for tx:${id}`);
      try {
        const emergencyResult = await emergencyService.declareEmergency(id, userId, emergencyReason || notes || 'Admin declared emergency');
        console.log(`[Submit Flow] Emergency declared successfully:`, emergencyResult);
      } catch (err) {
        console.error('[Submit Flow] Failed to declare emergency on submit:', err);
      }
    }

    return res.json({
      success: true,
      message: 'Transaction submitted successfully',
      data: {
        status: 'submitted',
        locked: true,
        message: 'Submitted – Menunggu Review',
      },
      validationResult,
    });

  } catch (error) {
    console.error('[Submit Flow] Error during submission:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});


/**
 * @swagger
 * /api/transactions/{id}/review:
 *   post:
 *     summary: Simulasi review transaksi (Approve/Reject/Return)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject, return]
 *               reason:
 *                 type: string
 *               editableFields:
 *                 type: array
 *                 items:
 *                   type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Review berhasil diproses
 */
// --- 9. APPROVAL SIMULATION (Approve / Reject / Return) ---
// In a real app, this would be guarded by 'guardApproverRole'. 
// Here we allow the user to simulate it on their own transactions or strict separated role.
router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, editableFields, deadline } = req.body; // action: 'approve' | 'reject' | 'return'

    if (!['approve', 'reject', 'return'].includes(action)) {
       return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    // Check transaction exists and get owner
    const txCheck = await query('SELECT user_id, status FROM transactions WHERE id = $1', [id]);
    if (txCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const ownerId = txCheck.rows[0].user_id;
    const currentStatus = txCheck.rows[0].status;

    // Must be in submitted/under_review state to review
    if (!['submitted', 'under_review'].includes(currentStatus)) {
      return res.status(400).json({ success: false, message: 'Transaction is not in reviewable state' });
    }

    let newStatus = '';
    let unlockFields = null;
    let deadlineDate = null;

    if (action === 'approve') {
      newStatus = 'approved';
    } else if (action === 'reject') {
      newStatus = 'rejected';
      // Lock permanently on reject
      await query(
        `UPDATE transactions 
         SET status = $1, 
             reject_reason = $2,
             internal_flags = jsonb_set(COALESCE(internal_flags, '{}'), '{locked}', 'true'),
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [newStatus, reason, id]
      );

      // Create exception for owner
      await query(
        `INSERT INTO personal_alerts (id, user_id, alert_type, title, message, severity, related_entity_type, related_entity_id)
         VALUES ($1, $2, 'TRANSACTION_REJECTED', 'Transaksi Ditolak', $3, 'error', 'transaction', $4)`,
        [uuidv4(), ownerId, reason || 'Transaksi Anda ditolak', id]
      );

      auditService.logSignal(req.user.id, 'REVIEW_REJECT', { txId: id, reason, ownerId });
      
      return res.json({ 
        success: true, 
        message: `Transaction ${newStatus}`, 
        status: newStatus,
        locked: true,
      });
    } else if (action === 'return') {
      newStatus = 'returned';
      unlockFields = editableFields || ['header', 'items', 'documents']; // Fields yang boleh diedit
      deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Default 2 days

      // Unlock specific fields and set deadline
      await query(
        `UPDATE transactions 
         SET status = $1, 
             notes = $2,
             expired_at = $3,
             revision_count = COALESCE(revision_count, 0) + 1,
             internal_flags = jsonb_set(
               jsonb_set(
                 COALESCE(internal_flags, '{}'), 
                 '{locked}', 
                 'false'
               ),
               '{editableFields}',
               $4
             ),
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5`,
        [newStatus, reason, deadlineDate, JSON.stringify(unlockFields), id]
      );

      // Create exception for owner
      await query(
        `INSERT INTO personal_alerts (id, user_id, alert_type, title, message, severity, related_entity_type, related_entity_id)
         VALUES ($1, $2, 'TRANSACTION_RETURNED', 'Transaksi Dikembalikan', $3, 'warning', 'transaction', $4)`,
        [uuidv4(), ownerId, reason || 'Transaksi Anda dikembalikan untuk diperbaiki', id]
      );

      auditService.logSignal(req.user.id, 'REVIEW_RETURN', { txId: id, reason, ownerId, editableFields: unlockFields });
      
      return res.json({ 
        success: true, 
        message: `Transaction ${newStatus}`, 
        status: newStatus,
        locked: false,
        editableFields: unlockFields,
        deadline: deadlineDate,
      });
    }

    // For approve
    await query(
       `UPDATE transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
       [newStatus, id]
    );
    
    auditService.logSignal(req.user.id, `REVIEW_${action.toUpperCase()}`, { txId: id, reason });

    res.json({ success: true, message: `Transaction ${newStatus}`, status: newStatus });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/draft:
 *   put:
 *     summary: Simpan transaksi sebagai draft
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaksi disimpan sebagai draft
 */
// --- SAVE AS DRAFT ---
router.put('/:id/draft', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    await ensureEditable(id, req.user.id); // Ensure can edit

    await query(
      `UPDATE transactions SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Extend TTL on save
    await query('UPDATE transactions SET expired_at = CURRENT_TIMESTAMP + INTERVAL \'24 hours\' WHERE id = $1', [id]);

    auditService.logActivity(req.user.id, 'SAVE_DRAFT', 'transaction', id, { action: 'save_draft' });

    res.json({ success: true, message: 'Transaction saved as draft' });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(error.message.includes('LOCKED') ? 403 : 500).json({ success: false, message: error.message || 'Server error' });
  }
});

// --- REVISION ENDPOINTS ---

/**
 * @swagger
 * /api/transactions/{id}/revision-details:
 *   get:
 *     summary: Ambil detail revisi transaksi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail revisi
 */
// Get revision details
router.get('/:id/revision-details', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const details = await draftRevisiService.getRevisionDetails(id, userId);

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Revision details error:', error);
    res.status(error.message.includes('not found') ? 404 : error.message.includes('denied') ? 403 : 400).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/save-revision:
 *   put:
 *     summary: Simpan perubahan revisi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               header:
 *                 type: object
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Revisi tersimpan
 */
// Save revision - dengan validasi allowlist dan deadline
router.put('/:id/save-revision', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const changes = req.body; // e.g. { header: {...}, items: [...] }

    // Validasi allowlist + deadline + simpan (header & items) via DraftRevisiService
    await draftRevisiService.saveRevision(id, userId, changes);

    res.json({ success: true, message: 'Revisi tersimpan' });
  } catch (error) {
    console.error('Save revision error:', error);
    const statusCode = error.message.includes('tidak diizinkan') || error.message.includes('deadline') ? 403 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/resubmit:
 *   post:
 *     summary: Kirim ulang transaksi yang telah direvisi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               isEmergency:
 *                 type: boolean
 *               emergencyReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaksi berhasil dikirim ulang
 */
// Resubmit
router.post('/:id/resubmit', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { notes, isEmergency: isEmergencyRaw, emergencyReason } = req.body;
    
    // Ensure isEmergency is a boolean
    const isEmergency = isEmergencyRaw === true || isEmergencyRaw === 'true';
    
    console.log(`[Resubmit Flow] Processing tx:${id}, isEmergency:${isEmergency} (raw:${isEmergencyRaw})`);

    // Sesuai diagram: S -> G: Validasi window + aturan revisi
    // dan lanjut proses resubmit
    const result = await draftRevisiService.resubmit(id, userId, notes, { isEmergency, emergencyReason });

    res.json({
      success: true,
      message: 'Resubmitted (locked)',
      data: result
    });
  } catch (error) {
    console.error('Resubmit error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/transactions/jobs/check-expired-revisions:
 *   post:
 *     summary: (Job) Cek dan tutup revisi yang telah melewati deadline
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Job berhasil dijalankan
 */
// --- JOB: Check Expired Revisions ---
// Endpoint ini dipanggil oleh cron job atau scheduler untuk mengecek deadline revisi
// Sesuai diagram: S -> DB: Job cek deadline revisi
router.post('/jobs/check-expired-revisions', authenticateToken, authorizeRoles('admin_finance', 'system'), async (req, res) => {
  try {
    const result = await draftRevisiService.checkExpiredRevisions();

    res.json({
      success: true,
      message: `Processed ${result.processed} expired revisions`,
      data: result
    });
  } catch (error) {
    console.error('Check expired revisions job error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/transactions/{id}/revision-status:
 *   get:
 *     summary: Ambil status deadline revisi
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status revisi
 */
// --- GET Revision Deadline Status ---
// Check apakah masih dalam window revisi
router.get('/:id/revision-status', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get transaction
    const txRes = await query(
      `SELECT status, expired_at, internal_flags, revision_count
       FROM transactions
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (txRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const tx = txRes.rows[0];

    // Check if in revision state
    if (tx.status !== 'returned') {
      return res.json({
        success: true,
        data: {
          canRevise: false,
          reason: 'Transaction is not in revision state',
          status: tx.status
        }
      });
    }

    // Check deadline
    const deadline = tx.expired_at ? new Date(tx.expired_at) : null;
    const now = new Date();
    const isExpired = deadline ? deadline < now : false;

    // Calculate remaining time
    let remainingTime = null;
    if (deadline && !isExpired) {
      const diff = deadline - now;
      remainingTime = {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        totalMs: diff
      };
    }

    const editableFields = tx.internal_flags?.editableFields || ['header', 'items', 'documents'];

    res.json({
      success: true,
      data: {
        canRevise: !isExpired,
        canResubmit: !isExpired,
        isExpired,
        deadline: deadline?.toISOString(),
        remainingTime,
        editableFields,
        revisionCount: tx.revision_count || 1,
        status: tx.status
      }
    });
  } catch (error) {
    console.error('Get revision status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

