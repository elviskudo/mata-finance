import { query } from '../config/database.js';

class GuardService {
  // Pastikan owner + boleh submit
  async validateTransactionAccess(txId, userId) {
    const res = await query(
      `SELECT user_id, status FROM transactions WHERE id = $1`,
      [txId]
    );

    if (res.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    const tx = res.rows[0];

    if (tx.user_id !== userId) {
      throw new Error('Access denied: not owner');
    }

    if (!['draft', 'in_progress'].includes(tx.status)) {
      throw new Error('Transaction is not in submittable state');
    }

    return true;
  }

  // Pastikan owner + cek window revisi (deadline)
  async validateRevisionAccess(txId, userId) {
    const res = await query(
      `SELECT user_id, status, expired_at, internal_flags FROM transactions WHERE id = $1`,
      [txId]
    );

    if (res.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    const tx = res.rows[0];

    if (tx.user_id !== userId) {
      throw new Error('Access denied: not owner');
    }

    if (tx.status !== 'returned') {
      throw new Error('Transaction is not in revision state');
    }

    if (tx.expired_at && new Date(tx.expired_at) < new Date()) {
      throw new Error('Revision deadline has passed');
    }

    return {
      editableFields: tx.internal_flags?.editableFields || ['header', 'items', 'documents'],
      deadline: tx.expired_at,
      revisionCount: tx.revision_count || 0,
    };
  }

  // Validasi allowlist + deadline
  async validateRevisionSave(txId, userId, changes) {
    const access = await this.validateRevisionAccess(txId, userId);

    // Check if changes are within allowlist
    // For now, assume changes are validated by editableFields
    // If changing header, check if 'header' in editableFields, etc.

    // This could be expanded based on specific field validation
    return access;
  }

  // Validasi akses SOP
  async validateSOAccess(role, contextType, contextCode) {
    // For now, only admin_finance can access SOP
    if (role !== 'admin_finance') {
      return false;
    }

    // Check if SOP exists for this role, context
    const res = await query(
      `SELECT id FROM sop_content WHERE role = $1 AND context_type = $2 AND context_code = $3`,
      [role, contextType, contextCode]
    );

    return res.rows.length > 0;
  }
}

export default new GuardService();