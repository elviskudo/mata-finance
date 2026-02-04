import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import auditService from './audit.service.js';
import ocrService from './ocr.service.js';
import validationService from './validation.service.js';
import approvalService from './approval.service.js';

class ExceptionService {
  async createSilentException(txId, userId, type, message) {
    // Buat exception silent (miss_deadline / no_action)
    // Insert into personal_alerts or exceptions table

    // Assuming there's an exceptions table or use personal_alerts
    await query(
      `INSERT INTO personal_alerts (id, user_id, alert_type, title, message, severity, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, 'Silent Exception', $4, 'info', 'transaction', $5)`,
      [uuidv4(), userId, type, message, txId]
    );

    auditService.logSignal(userId, 'SILENT_EXCEPTION_CREATED', { txId, type, message });
  }

  async createCase(txId, userId, allowlist, daftarFieldSalah, mismatchSummary) {
    const caseId = uuidv4();
    await query(
      `INSERT INTO exception_cases (id, transaction_id, user_id, allowlist, mismatch_summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [caseId, txId, userId, JSON.stringify(allowlist), mismatchSummary]
    );

    auditService.logActivity(userId, 'CREATE_EXCEPTION_CASE', 'transaction', txId, { caseId, allowlist, daftarFieldSalah });
    auditService.logSignal(userId, 'EXCEPTION_CASE_CREATED', { txId, caseId, allowlist, daftarFieldSalah });
    return caseId;
  }

  async getCases(userId) {
    const result = await query(
      `SELECT ec.*, t.transaction_code, t.amount, t.description, t.recipient_name
       FROM exception_cases ec
       JOIN transactions t ON ec.transaction_id = t.id
       WHERE ec.user_id = $1 AND ec.status = 'OPEN'
       ORDER BY ec.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async getCase(caseId, userId) {
    const result = await query(
      `SELECT ec.*, t.transaction_code, t.amount, t.description, t.recipient_name, t.recipient_account, t.transaction_type, t.currency
       FROM exception_cases ec
       JOIN transactions t ON ec.transaction_id = t.id
       WHERE ec.id = $1 AND ec.user_id = $2`,
      [caseId, userId]
    );
    return result.rows[0];
  }

  async patchCase(caseId, userId, patch) {
    // First, get the case to check allowlist
    const caseData = await this.getCase(caseId, userId);
    if (!caseData) throw new Error('Case not found or not owned by user');

    if (caseData.status !== 'OPEN') throw new Error('Case is not open for patching');

    // Validate patch fields are in allowlist
    const allowlist = caseData.allowlist;
    for (const field in patch) {
      if (!allowlist.includes(field)) {
        throw new Error(`Field ${field} not allowed for patching`);
      }
    }

    // Merge patch
    const currentPatch = caseData.patch || {};
    const newPatch = { ...currentPatch, ...patch };

    await query(
      `UPDATE exception_cases SET patch = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [JSON.stringify(newPatch), caseId]
    );

    auditService.logSignal(userId, 'EXCEPTION_CASE_PATCHED', { caseId, patch });
  }

  async recheckCase(caseId, userId) {
    const caseData = await this.getCase(caseId, userId);
    if (!caseData) throw new Error('Case not found or not owned by user');

    // 1. Get transaction immutable data (locked)
    const txResult = await query(`SELECT * FROM transactions WHERE id = $1`, [caseData.transaction_id]);
    const tx = txResult.rows[0];

    // 2. Get latest document
    const docResult = await query(
      `SELECT * FROM transaction_documents WHERE transaction_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
      [caseData.transaction_id]
    );
    const doc = docResult.rows[0];
    if (!doc) throw new Error('No document found');

    // 3. Ekstrak OCR terbaru (atau ambil dari DB yang sudah diproses)
    if (!doc.ocr_result) {
      throw new Error('OCR data not found - please ensure document was properly processed');
    }

    let ocrResult;
    try {
      ocrResult = typeof doc.ocr_result === 'string' ? JSON.parse(doc.ocr_result) : doc.ocr_result;
    } catch (parseError) {
      console.error('Error parsing OCR result in exception service:', parseError);
      throw new Error('Invalid OCR data format');
    }

    // 4. Bandingkan OCR vs (txImmutable + overlay patch)
    // Map fields from patch to transaction field names if necessary
    const patch = caseData.patch || {};
    const patchedTx = { ...tx, ...patch };
    
    // Extract the 'parsed' part from OCR result
    const ocrFields = ocrResult.parsed || ocrResult; 
    const validationResult = await validationService.validateOCRData(ocrFields, patchedTx);

    if (validationResult.match) {
      // === Sudah COCOK ===
      // Mark RESOLVED (auto)
      await query(
        `UPDATE exception_cases 
         SET status = 'RESOLVED', 
             mismatch_summary = $1,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`, 
        [validationResult.summary, caseId]
      );
      
      // Kirim ke approval (payload: txImmutable + lampiran exception patch)
      await approvalService.submitForApproval(caseData.transaction_id, userId, { 
        exceptionAttachment: patch,
        source: 'exception_resolution'
      });

      // Update transaksi status (sudah dilakukan di submitForApproval, tapi kita pertegas lognya)
      auditService.logActivity(userId, 'SUBMIT_WITH_EXCEPTION', 'transaction', caseData.transaction_id, { caseId, patch });
      auditService.logSignal(userId, 'EXCEPTION_CASE_RESOLVED', { caseId, txId: caseData.transaction_id });
      
      return { 
        ...validationResult, 
        status: 'RESOLVED',
        redirect: '/dashboard/admin/transactions'
      };
    } else {
      // === Masih TIDAK_COCOK ===
      // Tetap OPEN + update ringkasan mismatch
      await query(
        `UPDATE exception_cases 
         SET mismatch_summary = $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [validationResult.summary, caseId]
      );
      
      auditService.logSignal(userId, 'EXCEPTION_CASE_RECHECK_FAILED', { 
        caseId, 
        summary: validationResult.summary,
        mismatches: validationResult.mismatches
      });
      
      return {
        ...validationResult,
        status: 'OPEN'
      };
    }
  }
}

export default new ExceptionService();