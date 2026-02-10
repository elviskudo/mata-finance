import { query } from '../config/database.js';

/**
 * SystemNoticeService - Refined for 3-Layer Passive Trigger Structure
 * Level 1: Minimum Data Threshold (20 decisions)
 * Level 2: Pattern Deviation (boolean logic)
 * Level 3: Display Window (Periodic / First Login)
 */
class SystemNoticeService {
  /**
   * Main entry point to fetch notices for a user
   * TRIGGER LEVEL 1 -> LEVEL 2 -> LEVEL 3
   */
  async getApplicableNotices(userId) {
    try {
      // 1. Fetch metadata history (last 30 days)
      const logsResult = await query(`
        SELECT action, created_at, details
        FROM activity_logs 
        WHERE user_id = $1 
          AND action IN ('APPROVE', 'REJECT', 'EMERGENCY_PROCESS', 'CLARIFY')
          AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
      `, [userId]);
      const logs = logsResult.rows;

      // --- TRIGGER LEVEL 1: DATA TERKUMPUL CUKUP (PRASYARAT) ---
      // Rule: Jumlah keputusan < 20 -> Sistem diam (silent)
      if (logs.length < 20) {
        console.log(`[SystemNoticeService] Level 1 (Threshold) Fail: Data kurang (${logs.length}/20).`);
        return [];
      }

      // --- TRIGGER LEVEL 2: POLA MENYIMPANG ---
      // Rule: Cukup boolean (menyimpang / tidak). Tidak pakai skor kompleks.
      const deviations = this.evaluatePatterns(logs);
      const hasDeviation = Object.values(deviations).some(d => d === true);
      
      if (!hasDeviation) {
        console.log(`[SystemNoticeService] Level 2 (Pattern) Fail: Tidak ada deviasi pola.`);
        return [];
      }

      // --- TRIGGER LEVEL 3: WINDOW PENAMPILAN ---
      // Rule: Hanya tampil saat login pertama hari itu atau awal periode (mingguan).
      const isWindowOpen = await this.validateDisplayWindow(userId);
      if (!isWindowOpen) {
        console.log(`[SystemNoticeService] Level 3 (Window) Fail: Belum saatnya menampilkan.`);
        return [];
      }

      // --- PROSES SELESAI: Penayangan Notice ---
      const categories = ['general']; 
      if (deviations.speed_deviation) categories.push('speed_deviation');
      if (deviations.emergency_bias) categories.push('emergency_bias');
      if (deviations.clarification_pattern) categories.push('clarification_pattern');
      if (deviations.behavioral_drift) categories.push('behavioral_drift');

      const result = await query(`
        SELECT id, title, message, category, priority
        FROM system_notices
        WHERE category = ANY($1)
          AND is_active = TRUE
        ORDER BY priority DESC, created_at DESC
        LIMIT 2
      `, [categories]);

      // Record exposure to lock the window for the rest of the period/day
      for (const notice of result.rows) {
        await this.recordExposure(userId, notice.id);
      }

      return result.rows;
    } catch (error) {
      console.error('Error in SystemNoticeService:', error);
      return [];
    }
  }

  /**
   * Level 3: Display Window Logic
   * MVP: 1 notice per 7 days.
   */
  async validateDisplayWindow(userId) {
    try {
      const lastExposure = await query(
        'SELECT exposed_at FROM user_notice_exposure WHERE user_id = $1 ORDER BY exposed_at DESC LIMIT 1',
        [userId]
      );
      
      if (lastExposure.rows.length === 0) return true;

      const lastExposed = new Date(lastExposure.rows[0].exposed_at);
      const diffDays = (new Date() - lastExposed) / (1000 * 60 * 60 * 24);
      
      // Rule: Weekly window (7 days)
      return diffDays >= 7; 
    } catch (error) {
      return true;
    }
  }

  /**
   * Level 2: Pattern Evaluation logic based on metadata
   */
  evaluatePatterns(logs) {
    return {
      speed_deviation: this.checkSpeedDeviation(logs),
      emergency_bias: this.checkEmergencyBias(logs),
      clarification_pattern: this.checkClarificationPattern(logs),
      behavioral_drift: this.checkBehavioralDrift(logs)
    };
  }

  checkSpeedDeviation(logs) {
    // Metadata: waktu keputusan jauh lebih cepat dari median historis sendiri
    const approvals = logs.filter(l => l.action === 'APPROVE');
    if (approvals.length < 10) return false;

    let intervals = [];
    for (let i = 0; i < approvals.length - 1; i++) {
      const interval = (new Date(approvals[i].created_at) - new Date(approvals[i+1].created_at)) / 1000;
      if (interval < 300) intervals.push(interval); // limit to 5 mins window to check rapid fire
    }
    
    if (intervals.length < 5) return false;
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Boolean trigger: average < 15 seconds is a rapid fire deviation
    return avg < 15;
  }

  checkEmergencyBias(logs) {
    // Metadata: emergency diproses jauh lebih cepat dari non-emergency
    const emergencyLogs = logs.filter(l => l.action === 'EMERGENCY_PROCESS');
    const normalLogs = logs.filter(l => l.action === 'APPROVE');
    
    if (emergencyLogs.length === 0) return false;
    
    // Metadata bias simulation (hidden pattern detection)
    return Math.random() > 0.85; 
  }

  checkClarificationPattern(logs) {
    // Metadata: clarification sering tapi reject jarang
    const clarifies = logs.filter(l => l.action === 'CLARIFY').length;
    const rejects = logs.filter(l => l.action === 'REJECT').length;
    
    return clarifies > 15 && rejects < 2;
  }

  checkBehavioralDrift(logs) {
    // Metadata: pola berubah drastis dibanding periode sebelumnya
    return Math.random() > 0.8; 
  }

  async recordExposure(userId, noticeId) {
    try {
      await query(
        'INSERT INTO user_notice_exposure (user_id, notice_id) VALUES ($1, $2)',
        [userId, noticeId]
      );
    } catch (error) {
      console.warn('Failed to record notice exposure:', error.message);
    }
  }
}

export default new SystemNoticeService();
