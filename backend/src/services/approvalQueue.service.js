import { query } from '../config/database.js';

/**
 * Approval Queue Service
 * 
 * Simplified version - fetches transactions for approval queue
 * with proper error handling and complete data for review
 */
class ApprovalQueueService {
  
  /**
   * Build Queue for Approval
   * Main entry point - fetches pending transactions
   */
  async buildQueue(approvalId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    try {
      // Fetch transactions with status 'submitted' or 'resubmitted'
      const result = await query(`
        SELECT 
          t.id,
          t.transaction_code,
          t.transaction_type,
          t.amount,
          t.currency,
          t.status,
          t.description,
          t.recipient_name,
          t.risk_level,
          t.submitted_at,
          t.created_at,
          t.revision_count,
          (SELECT COUNT(*) > 0 FROM transaction_documents td WHERE td.transaction_id = t.id) as has_documents,
          u.public_alias as submitter_alias,
          u.department as submitter_department
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.status IN ('submitted', 'resubmitted') 
          AND t.is_latest = true
          AND NOT EXISTS (SELECT 1 FROM emergency_requests er WHERE er.transaction_id = t.id AND er.status = 'PENDING')
        ORDER BY 
          CASE WHEN t.risk_level = 'high' THEN 0
               WHEN t.risk_level = 'medium' THEN 1
               ELSE 2 END,
          t.submitted_at ASC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      // Count total
      const countResult = await query(`
        SELECT COUNT(*) as total FROM transactions t
        WHERE t.status IN ('submitted', 'resubmitted') 
          AND t.is_latest = true
          AND NOT EXISTS (SELECT 1 FROM emergency_requests er WHERE er.transaction_id = t.id AND er.status = 'PENDING')
      `);

      // Transform data with labels
      const items = result.rows.map((item, index) => ({
        id: item.id,
        queue_position: index + 1 + offset,
        
        // Transaction identifiers
        transaction_code: item.transaction_code,
        
        // Type and category
        job_type: this._simplifyTransactionType(item.transaction_type),
        transaction_type: item.transaction_type,
        category: this._categorizeTransaction(item),
        
        // Amount info
        amount: item.amount,
        nominal_range: this._getNominalRange(item.amount),
        currency: item.currency || 'IDR',
        
        // Status
        status: item.status,
        is_revision: item.revision_count > 0 || item.status === 'resubmitted',
        
        // Documents
        document_status: item.has_documents ? 'complete' : 'incomplete',
        
        // Time info
        submitted_at: item.submitted_at,
        relative_time: this._getRelativeTime(item.submitted_at),
        
        // Risk and labels
        risk_level: item.risk_level,
        soft_label: this._getSoftLabel(item),
        attention_level: item.risk_level === 'high' ? 'elevated' : 'normal',
        
        // Submitter info (masked)
        submitter_alias: item.submitter_alias,
        recipient_name: item.recipient_name,
        description: item.description
      }));

      return {
        items,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error) {
      console.error('ApprovalQueueService.buildQueue error:', error);
      throw error;
    }
  }

  /**
   * Get soft label based on transaction properties
   */
  _getSoftLabel(item) {
    if (item.risk_level === 'high') return 'Needs extra care';
    if (item.status === 'resubmitted' || item.revision_count > 0) return 'Revision';
    
    const submittedAt = new Date(item.submitted_at);
    const hoursAgo = (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60);
    if (hoursAgo > 24) return 'Time-sensitive';
    
    return 'Routine';
  }

  /**
   * Convert exact amount to nominal range
   */
  _getNominalRange(amount) {
    if (!amount) return 'unknown';
    if (amount < 1000000) return 'under_1m';
    if (amount < 5000000) return '1m_to_5m';
    if (amount < 10000000) return '5m_to_10m';
    if (amount < 25000000) return '10m_to_25m';
    if (amount < 50000000) return '25m_to_50m';
    if (amount < 100000000) return '50m_to_100m';
    return 'over_100m';
  }

  /**
   * Convert timestamp to relative time
   */
  _getRelativeTime(timestamp) {
    if (!timestamp) return 'unknown';
    const submittedAt = new Date(timestamp);
    const hoursAgo = (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60);

    if (hoursAgo < 1) return 'just_now';
    if (hoursAgo < 6) return 'recent';
    if (hoursAgo < 24) return 'today';
    if (hoursAgo < 48) return 'yesterday';
    if (hoursAgo < 168) return 'this_week';
    return 'older';
  }

  /**
   * Simplify transaction type
   */
  _simplifyTransactionType(type) {
    const typeStr = String(type || '').toLowerCase();
    if (typeStr.includes('payment')) return 'payment';
    if (typeStr.includes('transfer')) return 'transfer';
    if (typeStr.includes('reimburse')) return 'reimbursement';
    if (typeStr.includes('invoice')) return 'invoice';
    return 'other';
  }

  /**
   * Categorize transaction
   */
  _categorizeTransaction(item) {
    if (item.amount > 50000000) return 'large_value';
    if (item.revision_count > 0) return 'revision';
    if (item.status === 'resubmitted') return 'resubmission';
    return 'standard';
  }
}

export default new ApprovalQueueService();
