import { query } from '../config/database.js';

export const validateTransaction = async (transactionId) => {
  console.log(`🛡️ Running Pre-check Validation for Transaction: ${transactionId}`);

  // Fetch full transaction context
  const trxResult = await query(
    `SELECT t.*, 
            (SELECT json_agg(td.*) FROM transaction_documents td WHERE td.transaction_id = t.id) as documents
     FROM transactions t 
     WHERE t.id = $1`,
    [transactionId]
  );

  if (trxResult.rows.length === 0) {
    throw new Error('Transaction not found');
  }

  const trx = trxResult.rows[0];
  const checks = [];
  let riskScore = 0;

  // 1. Completeness Check
  const hasDocuments = trx.documents && trx.documents.length > 0;
  checks.push({
    item: 'Kelengkapan Dokumen',
    status: hasDocuments ? 'PASS' : 'FAIL',
    message: hasDocuments ? 'Dokumen pendukung tersedia' : 'Dokumen pendukung wajib diunggah'
  });
  if (!hasDocuments) riskScore += 50;

  // 2. OCR Validation Check
  let ocrMismatch = false;
  if (trx.ocr_data) {
    // If we have OCR data, check the stored mismatch flag
    // In our OCR service we update internal_flags->ocr_mismatch
    if (trx.internal_flags && trx.internal_flags.ocr_mismatch) {
      ocrMismatch = true;
    }
  }

  checks.push({
    item: 'Validasi OCR',
    status: ocrMismatch ? 'KENDALA' : 'PASS',
    message: ocrMismatch ? 'Terdeteksi selisih angka antara Input dan Dokumen' : 'Data input cocok dengan hasil scan dokumen'
  });
  if (ocrMismatch) riskScore += 30;

  // 3. Amount Risk Logic (Example)
  const amount = parseFloat(trx.amount);
  if (amount > 100000000) { // > 100 Juta
    checks.push({ item: 'Limit Nominal', status: 'WARNING', message: 'Nominal transaksi besar, memerlukan persetujuan berjenjang' });
    riskScore += 20;
  } else {
    checks.push({ item: 'Limit Nominal', status: 'PASS', message: 'Nominal dalam batas wajar' });
  }

  // 4. Time/Pattern Check (Silent Layer)
  const created = new Date(trx.created_at);
  const hour = created.getHours();
  if (hour < 6 || hour > 20) {
    checks.push({ item: 'Anomali Waktu', status: 'WARNING', message: 'Input dilakukan di luar jam kerja biasa' });
    riskScore += 10;
  }

  // Determine Final Risk Level
  let riskLevel = 'LOW';
  if (riskScore >= 30) riskLevel = 'MEDIUM';
  if (riskScore >= 60) riskLevel = 'HIGH';

  // Update Transaction with Risk Level
  await query(
    `UPDATE transactions SET risk_level = $1 WHERE id = $2`,
    [riskLevel, transactionId]
  );

  // Create flags array for frontend
  const flagMessages = [];
  if (!hasDocuments) flagMessages.push('Dokumen pendukung belum diunggah');
  if (ocrMismatch) flagMessages.push('Terdeteksi selisih antara data input dan hasil OCR');
  if (amount > 100000000) flagMessages.push('Nominal transaksi besar memerlukan persetujuan berjenjang');
  if (hour < 6 || hour > 20) flagMessages.push('Transaksi diinput di luar jam kerja');

  // Format sesuai diagram: Ringkasan kesehatan dengan ✅ ⚠️
  return {
    transactionId,
    overallStatus: riskScore < 50 ? 'HEALTHY' : 'NEEDS_REVIEW',
    riskLevel,
    riskScore,
    details: checks,
    flags: flagMessages,
    // Format untuk frontend
    summary: {
      completeness: hasDocuments ? '✅ lengkap' : '❌ tidak lengkap',
      ocrMatch: !ocrMismatch ? '✅ balance' : '⚠️ selisih OCR',
      risk: riskLevel,
    }
  };
};

export const validateOCRData = async (ocrFields, transactionData) => {
  const mismatches = [];
  let match = true;

  // 1. Compare vendor (recipient_name)
  const ocrVendor = ocrFields.vendor || ocrFields.vendorName;
  if (ocrVendor && transactionData.recipient_name) {
    const similarity = (s1, s2) => {
      const v1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
      const v2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
      return v1.includes(v2) || v2.includes(v1);
    };
    
    if (!similarity(ocrVendor, transactionData.recipient_name)) {
      mismatches.push('recipient_name');
      match = false;
    }
  }

  // 2. Compare amount (grandTotal vs amount)
  const ocrAmountRaw = ocrFields.grandTotal || ocrFields.amount;
  if (ocrAmountRaw !== undefined && transactionData.amount) {
    const ocrAmount = typeof ocrAmountRaw === 'number' ? ocrAmountRaw : parseFloat(ocrAmountRaw.toString().replace(/[^0-9.]/g, ''));
    const txAmount = parseFloat(transactionData.amount);
    
    const diff = Math.abs(ocrAmount - txAmount);
    const tolerance = txAmount * 0.01; // 1% tolerance
    
    if (diff > tolerance && Math.abs(ocrAmount - txAmount) > 1) { // Added 1 unit absolute tolerance
      mismatches.push('amount');
      match = false;
    }
  }

  // 3. Compare date (invoiceDate vs due_date)
  const ocrDateRaw = ocrFields.invoiceDate || ocrFields.date;
  if (ocrDateRaw && transactionData.due_date) {
    // Basic date match check (fuzzy or string based since OCR dates vary)
    const ocrDateStr = ocrDateRaw.toString().toLowerCase();
    const txDate = new Date(transactionData.due_date);
    const txDateStr = txDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if the numbers from the date string match
    const txNums = txDateStr.replace(/[^0-9]/g, '');
    const ocrNums = ocrDateStr.replace(/[^0-9]/g, '');
    
    if (ocrNums && !ocrNums.includes(txNums) && !txNums.includes(ocrNums)) {
      // mismatches.push('due_date'); // Often fails due to format, make it a warning in logs
      console.log(`OCR Date Mismatch: Detected ${ocrDateStr}, Expected ${txDateStr}`);
    }
  }

  const summary = match ? 'Data cocok dengan OCR' : `Ketidaksesuaian pada field: ${mismatches.join(', ')}`;

  return {
    match,
    mismatches,
    summary
  };
};

export default {
  validateTransaction,
  validateOCRData
};
