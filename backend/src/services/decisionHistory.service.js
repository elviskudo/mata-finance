import { query } from '../config/database.js';

class DecisionHistoryService {
  /**
   * Main entry point to fetch personal decision history
   * Follows sequence diagram logic:
   * 1. MSM (Memory Scope Manager) - Filter by ID and time window
   * 2. ELE (Exception & Learning Engine) - Hidden impact check
   * 3. DRE (Data Reduction Engine) - Field removal and masking
   */
  async getPersonalDecisions(approvalId) {
    try {
      // 1. MSM: Personal decisions only, limited time window (60 days)
      const daysWindow = 60;
      const historyResult = await query(`
        SELECT 
          al.id as log_id,
          al.action,
          al.created_at,
          al.entity_id,
          al.details,
          t.transaction_type,
          (
            CASE 
              WHEN er.id IS NOT NULL THEN 'emergency'
              WHEN t.revision_count > 0 THEN 'revision'
              ELSE 'new'
            END
          ) as item_context
        FROM activity_logs al
        JOIN transactions t ON al.entity_id = t.id
        LEFT JOIN emergency_requests er ON t.id = er.transaction_id
        WHERE al.user_id = $1 
          AND al.action IN ('APPROVE', 'REJECT', 'CLARIFY')
          AND al.created_at > NOW() - INTERVAL '1 day' * $2
        ORDER BY al.created_at DESC
        LIMIT 100
      `, [approvalId, daysWindow]);

      const rawDecisions = historyResult.rows;

      // 2. ELE: Hidden Learning Engine (Internal logic only)
      // This is where the system would check downstream outcomes or correctness
      // But according to the diagram, this payload NEVER flows back to the UI.
      await this.runInternalLearning(rawDecisions);

      // 3. DRE: Data Reduction Engine
      // Exposed: item type, decision outcome, relative time
      // Removed: nominal, vendor, category, labels, downstream status
      const reducedDecisions = rawDecisions.map(d => ({
        id: d.log_id,
        item_type: d.item_context, // new / revision / correction / emergency
        outcome: d.action.toLowerCase(), // approved / rejected / clarification
        timestamp: d.created_at,
        // Relative time will be computed on frontend for UX
        transaction_mask: `TRX-${d.entity_id.substring(0, 4)}...` 
      }));

      return reducedDecisions;
    } catch (error) {
      console.error('Error in DecisionHistoryService:', error);
      throw error;
    }
  }

  /**
   * ELE (Exception & Learning Engine)
   * Hidden system-wide learning. No data is returned to the user.
   */
  async runInternalLearning(decisions) {
    // Process patterns for bias detection, correctness evaluation, etc.
    // results are stored in SS (System Signals) or used for internal models.
    // Logically silent for the caller.
    return true;
  }
}

export default new DecisionHistoryService();
