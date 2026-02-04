import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import auditService from './audit.service.js';

class AccountingQueueService {
  async addToAccountingQueue(txId, ownerId, reason) {
    // Masukkan ke antrian Accounting Owner (needs_resolution)
    // Assume there's an accounting_queue table

    // For simulation, insert into a table or just log
    // Let's assume we have accounting_queue table: id, transaction_id, owner_id, reason, status

    await query(
      `INSERT INTO accounting_queue (id, transaction_id, owner_id, reason, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)`,
      [uuidv4(), txId, ownerId, reason]
    );

    auditService.logSignal(ownerId, 'ADDED_TO_ACCOUNTING_QUEUE', { txId, reason });
  }
}

export default new AccountingQueueService();