import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import guardService from './guard.service.js';
import auditService from './audit.service.js';
import accountingQueueService from './accountingQueue.service.js';
import exceptionService from './exception.service.js';
import approvalService from './approval.service.js';

class DraftRevisiService {
  async getRevisionDetails(txId, userId) {
    // Pastikan owner + cek window revisi
    const access = await guardService.validateRevisionAccess(txId, userId);

    // Get tx + paketRevisi (allowlist, deadline)
    const res = await query(
      `SELECT id, transaction_code, transaction_type, amount, currency, status,
              description, recipient_name, due_date, invoice_number,
              expired_at, revision_count, internal_flags, notes
       FROM transactions WHERE id = $1`,
      [txId]
    );

    if (res.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    const tx = res.rows[0];

    // Get items
    const itemsRes = await query(
      `SELECT id, description, account_code as "accountCode", quantity, unit_price as price, total_amount
       FROM transaction_items WHERE transaction_id = $1`,
      [txId]
    );

    // Get documents
    const docsRes = await query(
      `SELECT id, file_name, file_path, file_type, ocr_status
       FROM transaction_documents WHERE transaction_id = $1
       ORDER BY uploaded_at DESC`,
      [txId]
    );

    return {
      id: tx.id,
      code: tx.transaction_code,
      type: tx.transaction_type,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      recipientName: tx.recipient_name,
      dueDate: tx.due_date,
      invoiceNumber: tx.invoice_number,
      notes: tx.notes, // Catatan dari approver
      items: itemsRes.rows || [],
      documents: docsRes.rows || [],
      paketRevisi: {
        editableFields: access.editableFields,
        deadline: access.deadline,
        revisionCount: access.revisionCount,
        isExpired: access.deadline ? new Date(access.deadline) < new Date() : false,
      },
    };
  }

  /**
   * Job untuk cek deadline revisi yang terlewati (dipanggil secara periodik)
   * Sesuai diagram: S -> DB: Job cek deadline revisi
   */
  async checkExpiredRevisions() {
    console.log('🕐 [JOB] Checking expired revisions...');

    try {
      // Cari transaksi dengan status 'returned' yang deadline-nya sudah lewat
      const expiredRes = await query(
        `SELECT id, user_id, transaction_code
         FROM transactions
         WHERE status = 'returned'
           AND expired_at IS NOT NULL
           AND expired_at < CURRENT_TIMESTAMP
           AND is_latest = true`,
        []
      );

      const expiredItems = expiredRes.rows;
      console.log(`📋 Found ${expiredItems.length} expired revisions`);

      for (const item of expiredItems) {
        await this.closeExpiredRevision(item.id, item.user_id, item.transaction_code);
      }

      return { processed: expiredItems.length };
    } catch (error) {
      console.error('Error checking expired revisions:', error);
      throw error;
    }
  }

  /**
   * Tutup revisi yang deadline-nya terlewati
   * Sesuai diagram:
   * - status = CLOSED_NEEDS_ACCOUNTING_RESOLUTION (lock)
   * - Masukkan ke antrian Accounting Owner
   * - Buat exception silent
   * - Catat event auto-close + escalate
   */
  async closeExpiredRevision(txId, ownerId, txCode) {
    console.log(`🔒 [AUTO-CLOSE] Closing expired revision: ${txCode}`);

    try {
      // 1. Update status ke CLOSED_NEEDS_ACCOUNTING_RESOLUTION dan lock
      await query(
        `UPDATE transactions
         SET status = 'closed_needs_accounting_resolution',
             internal_flags = jsonb_set(COALESCE(internal_flags, '{}'), '{locked}', 'true'),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [txId]
      );

      // 2. Masukkan ke antrian Accounting Owner (needs_resolution)
      await accountingQueueService.addToAccountingQueue(
        txId,
        ownerId,
        'needs_resolution'
      );

      // 3. Buat exception silent (miss_deadline / no_action)
      await exceptionService.createSilentException(
        txId,
        ownerId,
        'MISS_DEADLINE',
        `Transaksi ${txCode} melewati deadline revisi dan ditutup secara otomatis. Memerlukan resolusi dari Accounting.`
      );

      // 4. Catat event auto-close + escalate
      await auditService.logActivity(
        ownerId,
        'AUTO_CLOSE_REVISION',
        'transaction',
        txId,
        { reason: 'deadline_expired', escalatedTo: 'accounting_queue' }
      );

      await auditService.logSignal(
        ownerId,
        'REVISION_DEADLINE_MISSED',
        { txId, txCode, action: 'auto_closed_and_escalated' },
        'WARNING'
      );

      console.log(`✅ [AUTO-CLOSE] Closed and escalated: ${txCode}`);
    } catch (error) {
      console.error(`Error closing expired revision ${txId}:`, error);
      throw error;
    }
  }

  /**
   * Validasi dan simpan revisi
   * Sesuai diagram:
   * - Validasi allowlist + deadline
   * - Simpan versi revisi
   * - Catat log revisi
   */
  async saveRevision(txId, userId, changes) {
    // 1. Validasi allowlist + deadline via guard
    const access = await guardService.validateRevisionSave(txId, userId, changes);

    // 2. Cek deadline
    if (access.deadline && new Date(access.deadline) < new Date()) {
      throw new Error('Perubahan tidak diizinkan - deadline telah terlewati');
    }

    // 3. Validasi field yang diubah ada dalam allowlist
    const editableFields = access.editableFields || [];

    // 4. Simpan perubahan header
    if (changes.header) {
      if (!editableFields.includes('header')) {
        throw new Error('Perubahan tidak diizinkan - field header tidak dalam daftar yang boleh diedit');
      }

      await query(
        `UPDATE transactions 
         SET recipient_name = COALESCE($1, recipient_name),
             due_date = COALESCE($2, due_date),
             invoice_number = COALESCE($3, invoice_number),
             description = COALESCE($4, description),
             amount = COALESCE($5, amount),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
          changes.header.vendorName,
          changes.header.invoiceDate,
          changes.header.invoiceNumber,
          changes.header.description,
          changes.header.amount,
          txId
        ]
      );
    }

    // 5. Simpan perubahan items
    if (changes.items) {
      if (!editableFields.includes('items')) {
        throw new Error('Perubahan tidak diizinkan - field items tidak dalam daftar yang boleh diedit');
      }

      await query('DELETE FROM transaction_items WHERE transaction_id = $1', [txId]);
      
      for (const item of changes.items) {
        await query(
          `INSERT INTO transaction_items (id, transaction_id, description, account_code, quantity, unit_price, total_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(), 
            txId, 
            item.description, 
            item.accountCode, 
            item.quantity, 
            item.price, 
            (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)
          ]
        );
      }

      // Update total amount dari items
      const totalSum = changes.items.reduce((acc, item) => 
        acc + (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0), 0);
      
      if (totalSum > 0) {
        await query('UPDATE transactions SET amount = $1 WHERE id = $2', [totalSum, txId]);
      }
    }

    // 6. Catat log revisi
    await auditService.logActivity(userId, 'SAVE_REVISION', 'transaction', txId, {
      changedFields: Object.keys(changes),
      revisionCount: access.revisionCount,
    });

    return { success: true };
  }

  /**
   * Kirim ulang transaksi yang telah direvisi
   * Sesuai diagram:
   * - Validasi window + aturan revisi
   * - status=RESUBMITTED, lock=true
   * - Kirim ulang ke approval
   * - Catat resubmit
   */
   async resubmit(txId, userId, notes, options = {}) {
    const isEmergency = options.isEmergency === true || options.isEmergency === 'true';
    const { emergencyReason } = options;

    // 1. Validasi window + aturan revisi via guard
    await guardService.validateRevisionAccess(txId, userId);

    // 2. Kirim ulang ke approval (ini menghandle status, versioning, dan locking)
    // Sesuai diagram: status=RESUBMITTED, lock=true
    const result = await approvalService.resubmitToApproval(txId, userId, notes);

    // 3. Handle emergency declaration on resubmit
    if (isEmergency) {
      try {
        const emergencyService = (await import('./emergency.service.js')).default;
        await emergencyService.declareEmergency(txId, userId, emergencyReason || notes || 'Admin declared emergency on resubmit');
      } catch (err) {
        console.error('Failed to declare emergency on resubmit:', err);
      }
    }

    // 4. Catat resubmit (sudah dilakukan di approvalService.resubmitToApproval via logSignal)
    await auditService.logActivity(userId, 'RESUBMIT_REVISION', 'transaction', txId, {
      notes,
      newVersion: result.newVersion,
      isEmergency
    });

    return { success: true, ...result };
  }
}

export default new DraftRevisiService();
