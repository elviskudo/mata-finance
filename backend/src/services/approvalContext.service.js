import { query } from '../config/database.js';

/**
 * Approval Context Service
 * 
 * Builds the Home Context for Approval Officer.
 * All internal logic is HIDDEN - approval only sees:
 * - pending count (may include noise injection)
 * - workload label (coarse, non-explanatory)
 * - behavioral reminder (time-based, generic)
 */
class ApprovalContextService {
  /**
   * Build the Home Context for Approval
   * @param {string} approvalId - User ID of the approval officer
   */
  async getHomeContext(approvalId) {
    const pendingCount = await this._getPendingCount();
    const pressure = await this._evaluateSystemPressure(approvalId);
    const workloadLabel = this._mapPressureToLabel(pressure);
    const reminder = await this._checkBehavioralReminder(approvalId);

    return {
      pendingCount,
      workloadLabel,
      reminder
    };
  }

  /**
   * Workload Aggregator
   * Returns count of items waiting for decision
   * 
   * HIDDEN: Count may be influenced by noise injection
   * to maintain approval vigilance
   */
  async _getPendingCount() {
    const result = await query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE status IN ('submitted', 'resubmitted') AND is_latest = true`
    );
    let count = parseInt(result.rows[0].count);

    // Noise injection (simulated system pressure)
    // Sometimes the system "inflates" the workload slightly
    // This is NEVER exposed as the reason
    const noiseSeed = Math.random();
    if (noiseSeed > 0.85) {
      count += Math.floor(Math.random() * 2) + 1;
    }

    return count;
  }


  /**
   * Exception & Pressure Engine
   * Evaluates system pressure based on hidden signals
   * 
   * Signals (HIDDEN from approval):
   * 1. Anomaly escalation (high number of recent alerts)
   * 2. Pending volume
   * 3. Approval speed bias (if approval has been too fast)
   * 4. Global system posture
   */
  async _evaluateSystemPressure(approvalId) {
    // Signal 1: High alert frequency
    const highAlerts = await query(
      `SELECT COUNT(*) FROM personal_alerts 
       WHERE severity IN ('warning', 'critical')
       AND created_at > NOW() - INTERVAL '24 hours'`
    );
    
    // Signal 2: Pending volume
    const totalPending = await this._getPendingCount();

    // Signal 3: Approval speed bias
    // If approval has been making decisions too quickly, flag as potential rubber-stamping
    const recentApprovals = await query(
      `SELECT 
         COUNT(*) as count,
         COALESCE(AVG(gap), 300) as avg_gap
       FROM (
         SELECT EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) as gap
         FROM activity_logs 
         WHERE user_id = $1 
           AND action IN ('APPROVE', 'REJECT')
           AND created_at > NOW() - INTERVAL '2 hours'
       ) t`,
      [approvalId]
    );

    let pressureLevel = 'normal';
    
    // Evaluate pressure based on hidden signals
    const alertCount = parseInt(highAlerts.rows[0].count);
    const avgDecisionGap = parseFloat(recentApprovals.rows[0]?.avg_gap || 300);
    
    if (alertCount > 5 || totalPending > 15) {
      pressureLevel = 'elevated';
    }

    // Additional pressure if approval is rushing
    if (avgDecisionGap < 60 && pressureLevel === 'normal') {
      pressureLevel = 'cautionary';
    }

    return pressureLevel;
  }

  /**
   * Workload Label Determination
   * 
   * Labels are:
   * - Coarse (not specific)
   * - Non-explanatory (no reason given)
   * - Behavior-shaping only
   */
  _mapPressureToLabel(pressure) {
    switch (pressure) {
      case 'elevated':
        return 'Higher attention required';
      case 'cautionary':
        return 'Please review carefully';
      default:
        return 'Normal workload';
    }
  }

  /**
   * Behavioral Signal Engine
   * Returns generic reminder based on:
   * - Time of day
   * - Global system posture
   * - Random behavioral nudges
   * 
   * NEVER provides explanatory context
   */
  async _checkBehavioralReminder(approvalId) {
    const hour = new Date().getHours();
    
    // Morning reminder (fresh attention)
    if (hour < 10) {
      return {
        show: true,
        type: 'info',
        message: 'Review and verify all supporting documents carefully.'
      };
    }

    // Pre-lunch (potential rush)
    if (hour >= 11 && hour < 13) {
      return {
        show: true,
        type: 'attention',
        message: 'Take your time with each review.'
      };
    }

    // Afternoon (potential fatigue)
    if (hour >= 14 && hour < 17) {
      return {
        show: true,
        type: 'caution',
        message: 'Accuracy over speed. Some items may require extra attention.'
      };
    }

    // Late afternoon/evening
    if (hour >= 17) {
      return {
        show: true,
        type: 'reminder',
        message: 'Verify all details before making decisions.'
      };
    }
    
    // Default
    return {
      show: true,
      type: 'info',
      message: 'Please ensure all procedures are followed during the review process.'
    };
  }

  /**
   * Get aggregate statistics for approval dashboard
   * Note: Some values may be slightly adjusted for behavioral purposes
   */
  async getAggregateStats(approvalId) {
    // Today's results
    const todayResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE action = 'APPROVE' AND DATE(created_at) = CURRENT_DATE) as approved,
        COUNT(*) FILTER (WHERE action = 'REJECT' AND DATE(created_at) = CURRENT_DATE) as rejected
      FROM activity_logs
      WHERE user_id = $1
    `, [approvalId]);

    // "New transactions appearing" - simplified count
    const newItemsResult = await query(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE status IN ('submitted', 'resubmitted')
        AND submitted_at > NOW() - INTERVAL '24 hours'
    `);

    // Results processed this week
    const weekResult = await query(`
      SELECT COUNT(*) as count
      FROM activity_logs
      WHERE user_id = $1 
        AND action IN ('APPROVE', 'REJECT')
        AND created_at > NOW() - INTERVAL '7 days'
    `, [approvalId]);

    return {
      today: {
        approved: parseInt(todayResult.rows[0].approved),
        rejected: parseInt(todayResult.rows[0].rejected),
        total: parseInt(todayResult.rows[0].approved) + parseInt(todayResult.rows[0].rejected)
      },
      newAppearing: parseInt(newItemsResult.rows[0].count),
      weekProcessed: parseInt(weekResult.rows[0].count)
    };
  }
}

export default new ApprovalContextService();
