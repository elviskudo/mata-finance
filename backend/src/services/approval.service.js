import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import auditService from './audit.service.js';

class ApprovalService {
  async submitForApproval(txId, userId, options = {}) {
    // Kirim ke approval
    const approvalRequestId = uuidv4();

    let queryText = `
      UPDATE transactions
      SET status = 'submitted',
          submitted_at = CURRENT_TIMESTAMP,
          internal_flags = jsonb_set(COALESCE(internal_flags, '{}'), '{locked}', 'true')
    `;

    const params = [txId];

    // If submitted via exception case resolution, attach the patch for approver review
    if (options.exceptionAttachment) {
      queryText += `, internal_flags = jsonb_set(COALESCE(internal_flags, '{}'), '{exception_patch}', $2::jsonb)`;
      queryText += `, notes = COALESCE(notes, '') || ' [SUBMITTED_WITH_EXCEPTION_ATTACHMENT]'`;
      params.push(JSON.stringify(options.exceptionAttachment));
    }

    queryText += ` WHERE id = $1`;

    await query(queryText, params);

    auditService.logSignal(userId, 'SUBMIT_TO_APPROVAL', { txId, approvalRequestId, options });

    return { approvalRequestId };
  }

  async resubmitToApproval(txId, userId, notes) {
    const approvalRequestId = uuidv4();

    // 1. Get current transaction state for versioning
    const txRes = await query('SELECT * FROM transactions WHERE id = $1', [txId]);
    if (txRes.rows.length === 0) throw new Error('Transaction not found');
    const tx = txRes.rows[0];
    const oldVersion = tx.version || 1;

    // 2. Perform archival cloning
    // We create a clone with a new ID and old version, marked as is_latest = false
    const archiveId = uuidv4();
    
    // We filter out columns that are explicitly set in the INSERT statement
    const columns = Object.keys(tx).filter(
      k => !['id', 'is_latest', 'version', 'status', 'updated_at'].includes(k)
    );
    const placeholders = columns.map((_, i) => `$${i + 4}`).join(', ');
    const values = columns.map(k => tx[k]);

    // 3. Update the main record to next version and set as latest FIRST
    // This frees up the (code, oldVersion) slot for the archive record
    await query(
      `UPDATE transactions
       SET status = 'resubmitted',
           notes = $1,
           version = version + 1,
           is_latest = true,
           submitted_at = CURRENT_TIMESTAMP,
           internal_flags = jsonb_set(COALESCE(internal_flags, '{}'), '{locked}', 'true'),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [notes, txId]
    );

    // 4. Perform archival cloning of the state (using the tx object from BEFORE the update)
    // Placeholder map: $1=archiveId, $2=oldVersion, $3=updatedAt, $4...=rest of columns
    await query(`
      INSERT INTO transactions (id, is_latest, version, status, updated_at, ${columns.join(', ')})
      VALUES ($1, false, $2, 'superseded', $3, ${placeholders})
    `, [archiveId, oldVersion, tx.updated_at, ...values]);

    auditService.logSignal(userId, 'RESUBMIT_TO_APPROVAL', { 
      txId, 
      approvalRequestId, 
      notes,
      version: oldVersion + 1,
      archivedId: archiveId 
    });

    return { approvalRequestId, newVersion: oldVersion + 1 };
  }
}

export default new ApprovalService();