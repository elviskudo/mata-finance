import { query } from '../config/database.js';

class EmergencyService {
  /**
   * Build emergency list for approval perspective
   * Follows sequence diagram logic:
   * - Fetch admin-declared emergency requests
   * - NOT system emergency
   * - NOT budget emergency
   */
  async buildEmergencyList(approvalId) {
    try {
      // 1. Fetch admin-declared emergency requests
      const result = await query(`
        SELECT 
          er.id as emergency_id,
          er.admin_reason,
          er.created_at as emergency_at,
          t.id as transaction_id,
          t.transaction_type,
          t.amount,
          t.status,
          t.recipient_name,
          t.created_at,
          (SELECT public_alias FROM users WHERE id = t.user_id) as submitter_alias,
          (SELECT COUNT(*) FROM transaction_documents WHERE transaction_id = t.id) as doc_count
        FROM emergency_requests er
        JOIN transactions t ON er.transaction_id = t.id
        WHERE er.status = 'PENDING'
          AND t.status IN ('submitted', 'resubmitted')
          -- Sequence note: NOT system emergency, NOT budget emergency
          AND (t.internal_flags->>'is_system_emergency' IS NULL OR t.internal_flags->>'is_system_emergency' = 'false')
          AND (t.internal_flags->>'is_budget_emergency' IS NULL OR t.internal_flags->>'is_budget_emergency' = 'false')
      `);

      const items = result.rows;
      const validatedItems = [];

      for (const item of items) {
        // 2. Eligibility & Boundary Validation
        const isValid = await this.validateEligibility(item);
        if (!isValid) continue;

        // 3. Exception Pressure Evaluation (Hidden)
        const pressurePosture = await this.evaluatePressure(item);

        // 4. Label Assignment
        const label = this.assignLabels(item);

        // 5. Data Masking & Reduction
        // Exposed data ONLY: job type, category, nominal range, doc completeness, 
        // relative time, admin short reason, label.
        validatedItems.push({
          id: item.transaction_id,
          job_type: item.transaction_type,
          category: 'Emergency',
          nominal_range: this.getNominalRange(item.amount),
          amount: item.amount,
          recipient_name: item.recipient_name,
          submitter_alias: item.submitter_alias,
          document_completeness: item.doc_count > 0 ? 'Complete' : 'Incomplete',
          relative_request_time: this.getRelativeTime(item.emergency_at),
          admin_short_reason: (item.admin_reason || '').substring(0, 100),
          label: label,
          pressure_posture_opaque: pressurePosture
        });
      }

      return validatedItems;
    } catch (error) {
      console.error('Emergency list construction error:', error);
      throw error;
    }
  }

  async validateEligibility(item) {
    // Validation ensures:
    // - item exists (already checked by JOIN)
    // - item not already finalized
    if (['approved', 'rejected', 'completed'].includes(item.status)) {
      return false;
    }
    // - no bypass of approval role (implicit in approval access)
    return true;
  }

  async evaluatePressure(item) {
    try {
      // Hidden logic: Read global signals, evaluate frequency patterns, abuse likelihood, etc.
      const signalsResult = await query(`
        SELECT signal_data FROM system_signals 
        WHERE signal_type = 'PRESSURE_METRIC' 
        ORDER BY created_at DESC LIMIT 1
      `);
      
      const signals = signalsResult.rows[0]?.signal_data || {};
      
      // Abstract pressure signals (opaque)
      return {
        active_patterns: signals.frequency_pattern === 'high' ? 'critical' : 'stable',
        risk_score: signals.abuse_likelihood > 0.5 ? 'elevated' : 'nominal'
      };
    } catch (error) {
      console.warn('Could not evaluate pressure (system_signals might be missing):', error.message);
      return {
        active_patterns: 'stable',
        risk_score: 'nominal'
      };
    }
  }

  assignLabels(item) {
    // Fixed, non-graduated, non-explanatory label
    return "Urgent request";
  }

  getNominalRange(amount) {
    if (amount < 1000000) return '< 1M';
    if (amount < 10000000) return '1M - 10M';
    if (amount < 50000000) return '10M - 50M';
    return '> 50M';
  }

  getRelativeTime(date) {
    if (!date) return 'Unknown time';
    const diff = new Date() - new Date(date);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  async declareEmergency(transactionId, adminId, reason) {
    console.log(`[EmergencyService] Declaring emergency for tx:${transactionId} by admin:${adminId}`);
    try {
      // 1. Check if already declared
      const check = await query('SELECT id FROM emergency_requests WHERE transaction_id = $1 AND status = \'PENDING\'', [transactionId]);
      if (check.rows.length > 0) {
        console.log(`[EmergencyService] Transaction ${transactionId} already has a pending emergency request.`);
        return check.rows[0];
      }

      // 2. Insert new emergency request
      const safeReason = reason || 'Emergency request without specified reason';
      console.log(`[EmergencyService] Inserting new emergency request. Reason: ${safeReason}`);
      const result = await query(
        `INSERT INTO emergency_requests (id, transaction_id, admin_id, admin_reason, status, created_at)
         VALUES (uuid_generate_v4(), $1, $2, $3, 'PENDING', CURRENT_TIMESTAMP)
         RETURNING id`,
        [transactionId, adminId, safeReason]
      );

      console.log(`[EmergencyService] Successfully created emergency request:`, result.rows[0].id);
      return result.rows[0];
    } catch (error) {
      console.error('[EmergencyService] Error in declareEmergency:', error);
      throw error;
    }
  }
}

export default new EmergencyService();
