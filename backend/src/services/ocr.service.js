import {
  query
} from '../config/database.js';
import Tesseract from 'tesseract.js';

/* ===============================
   PROCESS DOCUMENT
   Semantic OCR Orchestrator - merges PSM results by role, not by quality score
============================== */
export const processDocument = async (transactionId, file) => {
  const allowedMime = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedMime.includes(file.mimetype)) {
    throw new Error('File type tidak didukung');
  }

  let parsed;
  let rawText = '';
  let confidence = 0;

  /* ===============================
     SEMANTIC OCR MERGER
     PSM responsibilities are fixed and mandatory:
     - PSM 4 = header metadata (vendor name, invoice title, invoice number, invoice date, cost center, description)
     - PSM 6 = item detail lines (description, account code, quantity, unit price, line total)
     - PSM 12 = grand total section (Grand Total label and amount only)
     - PSM 11 = fallback/noise, only used if a field is missing in its primary PSM
  =============================== */
  try {
    // PSM modes with semantic responsibilities
    const psmModes = ['4', '6', '11', '12'];
    const ocrResults = {};

    console.log('=== Starting Semantic OCR Merger ===');

    // Run all PSM modes - DO NOT SKIP ANY
    for (const psmMode of psmModes) {
      try {
        console.log(`Running PSM mode ${psmMode}...`);
        const {
          data
        } = await Tesseract.recognize(
          file.path,
          'ind+eng', // Prioritize Indonesian
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`OCR Progress (PSM ${psmMode}): ${Math.round(m.progress * 100)}%`);
              }
            },
            // Optimized settings for Indonesian invoices
            tessedit_pageseg_mode: psmMode,
            preserve_interword_spaces: '1',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:.,|/\\ \n\t',
            // Disable dictionaries for better recognition of codes/numbers
            load_system_dawg: '0',
            load_freq_dawg: '0',
            load_unambig_dawg: '0',
            load_punc_dawg: '0',
            load_number_dawg: '0',
            load_bigram_dawg: '0',
          }
        );

        const textLength = data.text.trim().length;
        const avgConfidence = data.confidence || 0;

        ocrResults[psmMode] = {
          text: data.text,
          confidence: avgConfidence,
          textLength,
          data
        };

        console.log(`PSM ${psmMode} result: ${textLength} chars, confidence: ${avgConfidence.toFixed(2)}%`);
        console.log(`PSM ${psmMode} raw text:\n${data.text}\n---`);
      } catch (modeErr) {
        console.error(`PSM mode ${psmMode} failed:`, modeErr.message);
        ocrResults[psmMode] = { text: '', confidence: 0, textLength: 0, data: null };
      }
    }

    // Calculate max confidence from all modes (as specified in requirements)
    confidence = Math.max(...Object.values(ocrResults).map(r => r.confidence || 0));

    // === SEMANTIC MERGER: Build unified rawText by responsibility ===
    // PSMs are treated as specialized sensors and must be merged by role, not by quality score
    rawText = mergeOCRBySemanticRole(ocrResults);

    console.log('=== SEMANTIC OCR MERGER OUTPUT ===');
    console.log(rawText);
    console.log('====================');
    console.log(`Max Confidence: ${confidence.toFixed(2)}%`);

    // Parse the merged rawText
    parsed = parseOCRText(rawText);

    console.log('=== PARSED RESULT ===');
    console.log(JSON.stringify(parsed, null, 2));
    console.log('=====================');

  } catch (err) {
    console.error('OCR Error:', err);
    throw new Error('OCR gagal: ' + err.message);
  }

  /* ===============================
     LOAD DB
  =============================== */
  const txRes = await query(
    `SELECT recipient_name, invoice_number, amount, cost_center, description
     FROM transactions WHERE id = $1`,
    [transactionId]
  );

  if (!txRes.rows.length) {
    throw new Error('Transaction not found');
  }

  const tx = txRes.rows[0];

  const itemsRes = await query(
    `SELECT description, total_amount, account_code
     FROM transaction_items WHERE transaction_id = $1`,
    [transactionId]
  );

  /* ===============================
     VALIDATION WITH FUZZY MATCHING
  =============================== */
  const result = validate(parsed, tx, itemsRes.rows, confidence, rawText);

  /* ===============================
     SAVE RESULT
  =============================== */
  console.log(`💾 Saving OCR results for Tx: ${transactionId}`);
  
  await query(
    `UPDATE transaction_documents
     SET ocr_result = $1,
         ocr_status = 'COMPLETED',
         status_match = $2
     WHERE transaction_id = $3
       AND file_name = $4`,
    [
      JSON.stringify(result),
      result.match ? 'MATCH' : 'MISMATCH',
      transactionId,
      file.filename
    ]
  );

  await query(
    `UPDATE transactions
     SET ocr_status = $1,
         ocr_data = $2,
         internal_flags = jsonb_set(
           COALESCE(internal_flags, '{}'),
           '{ocr_mismatch}',
           $3::jsonb
         )
     WHERE id = $4`,
    [
      result.match ? 'MATCH' : 'MISMATCH',
      JSON.stringify(result),
      JSON.stringify(!result.match),
      transactionId
    ]
  );

  return result;
};

/* ===============================
   SEMANTIC OCR MERGER BY PSM RESPONSIBILITY
   
   This function merges OCR results by semantic role:
   - PSM 4 = header metadata
   - PSM 6 = item detail lines  
   - PSM 12 = grand total section
   - PSM 11 = fallback/noise (only used if field missing in primary PSM)
   
   Output format is deterministic and reproducible.
============================== */
function mergeOCRBySemanticRole(ocrResults) {
  const psm4Text = ocrResults['4']?.text || '';
  const psm6Text = ocrResults['6']?.text || '';
  const psm11Text = ocrResults['11']?.text || '';
  const psm12Text = ocrResults['12']?.text || '';

  console.log('=== PSM Text Inputs ===');
  console.log('PSM 4 (Header):', psm4Text.substring(0, 200));
  console.log('PSM 6 (Items):', psm6Text.substring(0, 200));
  console.log('PSM 11 (Fallback):', psm11Text.substring(0, 200));
  console.log('PSM 12 (Total):', psm12Text.substring(0, 200));

  // === EXTRACT HEADER FROM PSM 4 (primary) with PSM 11 fallback ===
  const header = extractHeaderFromPSM(psm4Text, psm11Text);

  // === EXTRACT ITEMS FROM PSM 6 (primary) with PSM 11 fallback ===
  const items = extractItemsFromPSM(psm6Text, psm11Text);

  // === EXTRACT GRAND TOTAL FROM PSM 12 (primary) with PSM 11 fallback ===
  const grandTotal = extractGrandTotalFromPSM(psm12Text, psm11Text);

  // === BUILD UNIFIED rawText in exact required format ===
  let rawText = '';

  // === OCR HEADER (PSM 4) ===
  rawText += '=== OCR HEADER (PSM 4) ===\n';
  rawText += `${header.vendorName}\n`;
  rawText += 'INVOICE\n';
  rawText += `Vendor Name : ${header.vendor}\n`;
  rawText += `Invoice Number : ${header.invoiceNumber}\n`;
  rawText += `Invoice Date : ${header.invoiceDate}\n`;
  rawText += `Cost Center : ${header.costCenter}\n`;
  rawText += `Transaction Description : ${header.description}\n`;

  // === OCR ITEMS (PSM 6) ===
  rawText += '\n=== OCR ITEMS (PSM 6) ===\n';
  rawText += 'Item Description | Account Code | Quantity | Unit Price | Total\n';
  for (const item of items) {
    rawText += `${item.description} | ${item.accountCode} | ${item.quantity} | ${item.unitPrice} | ${item.total}\n`;
  }

  // === OCR TOTAL (PSM 12) ===
  rawText += '\n=== OCR TOTAL (PSM 12) ===\n';
  rawText += `Grand Total : ${grandTotal}\n`;

  return rawText;
}

/* ===============================
   EXTRACT HEADER FROM PSM 4 (with PSM 11 fallback)
   
   Extracts: vendor name, invoice number, invoice date, cost center, description
============================== */
function extractHeaderFromPSM(psm4Text, psm11Text) {
  const header = {
    vendorName: '',
    vendor: '',
    invoiceNumber: '',
    invoiceDate: '',
    costCenter: '',
    description: ''
  };

  const primaryText = psm4Text;
  const fallbackText = psm11Text;

  // Helper: extract value with fallback to PSM 11
  const extractOrFallback = (patterns, primary, fallback) => {
    for (const pattern of patterns) {
      const match = primary.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    // Fallback to PSM 11 only if not found in primary
    for (const pattern of patterns) {
      const match = fallback.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  };

  // Extract vendor name (company header at top - e.g., "PT Sumber Makmur Sejahtera")
  const vendorNamePatterns = [
    /^(PT\s+[A-Za-z\s]+)/im,
    /^(CV\s+[A-Za-z\s]+)/im,
    /^(UD\s+[A-Za-z\s]+)/im,
  ];
  header.vendorName = extractOrFallback(vendorNamePatterns, primaryText, fallbackText);

  // Extract vendor from "Vendor Name" or "Nama Vendor" row
  const vendorPatterns = [
    /[Vv]endor\s*[Nn]ame\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Nn]ama\s*[Vv]endor\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Vv]endor\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
  ];
  header.vendor = extractOrFallback(vendorPatterns, primaryText, fallbackText);
  
  // If vendor not found but vendorName exists, use vendorName
  if (!header.vendor && header.vendorName) {
    header.vendor = header.vendorName;
  }

  // Extract invoice number - look for INV-XXXX-YYY pattern
  const invoicePatterns = [
    /[Ii]nvoice\s*[Nn]umber\s*[:\|]?\s*(INV[-\s]?\d+[-\s]?[A-Za-z]{2,10})/,
    /[Ii]nvoice\s*[Nn]umber\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Ii]nvoice\s*[Nn]o\s*[:\|]?\s*(INV[-\s]?\d+[-\s]?[A-Za-z]{2,10})/,
    /[Ii]nvoice\s*[Nn]o\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Nn]o\s*[Ii]nvoice\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /(INV[-\s]?\d+[-\s]?[A-Za-z]{2,10})/,
  ];
  header.invoiceNumber = extractOrFallback(invoicePatterns, primaryText, fallbackText)
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();

  // Extract invoice date
  const datePatterns = [
    /[Ii]nvoice\s*[Dd]ate\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Tt]anggal\s*[Ii]nvoice\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Tt]gl\.?\s*[Ii]nvoice\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /(\d{1,2}\s+[Jj]anuari\s+\d{4})/,
    /(\d{1,2}\s+[Ff]ebruari\s+\d{4})/,
    /(\d{1,2}\s+[Mm]aret\s+\d{4})/,
    /(\d{1,2}\s+[Aa]pril\s+\d{4})/,
    /(\d{1,2}\s+[Mm]ei\s+\d{4})/,
    /(\d{1,2}\s+[Jj]uni\s+\d{4})/,
    /(\d{1,2}\s+[Jj]uli\s+\d{4})/,
    /(\d{1,2}\s+[Aa]gustus\s+\d{4})/,
    /(\d{1,2}\s+[Ss]eptember\s+\d{4})/,
    /(\d{1,2}\s+[Oo]ktober\s+\d{4})/,
    /(\d{1,2}\s+[Nn]ovember\s+\d{4})/,
    /(\d{1,2}\s+[Dd]esember\s+\d{4})/,
  ];
  header.invoiceDate = extractOrFallback(datePatterns, primaryText, fallbackText);

  // Extract cost center
  const costCenterPatterns = [
    /[Cc]ost\s*[Cc]enter\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Pp]usat\s*[Bb]iaya\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /([A-Z]{2,}-DEPT-\d+)/,
  ];
  header.costCenter = extractOrFallback(costCenterPatterns, primaryText, fallbackText);

  // Extract description
  const descPatterns = [
    /[Tt]ransaction\s*[Dd]escription\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Dd]eskripsi\s*[Tt]ransaksi\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Kk]eterangan\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
    /[Dd]escription\s*[:\|]?\s*(.+?)(?:\r?\n|$)/,
  ];
  header.description = extractOrFallback(descPatterns, primaryText, fallbackText);

  return header;
}

/* ===============================
   EXTRACT ITEMS FROM PSM 6 (with PSM 11 fallback)
   
   Extracts item lines: description, account code, quantity, unit price, total
============================== */
function extractItemsFromPSM(psm6Text, psm11Text) {
  const items = [];
  const primaryText = psm6Text;
  const fallbackText = psm11Text;

  // Helper: parse items from text
  const parseItemsFromText = (text) => {
    const parsedItems = [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Find table header
    let tableStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (
        (line.includes('description') && (line.includes('qty') || line.includes('quantity') || line.includes('price') || line.includes('total'))) ||
        (line.includes('deskripsi') && (line.includes('qty') || line.includes('harga') || line.includes('total'))) ||
        (line.includes('item') && line.includes('code'))
      ) {
        tableStartIndex = i;
        break;
      }
    }

    if (tableStartIndex === -1) {
      // Try to find items without explicit header
      for (const line of lines) {
        const itemMatch = parseItemLine(line);
        if (itemMatch) {
          parsedItems.push(itemMatch);
        }
      }
    } else {
      // Parse rows after table header
      for (let i = tableStartIndex + 1; i < lines.length; i++) {
        const row = lines[i];

        // Stop at grand total
        if (/grand\s*total/i.test(row) || /^total\s*:/i.test(row)) {
          break;
        }

        // Skip headers and separators
        if (/^[-=]+$/.test(row) || row.length < 5) continue;

        const itemMatch = parseItemLine(row);
        if (itemMatch) {
          parsedItems.push(itemMatch);
        }
      }
    }

    return parsedItems;
  };

  // Parse from PSM 6 (primary)
  const psm6Items = parseItemsFromText(primaryText);
  if (psm6Items.length > 0) {
    items.push(...psm6Items);
  }

  // If no items found, try PSM 11 fallback
  if (items.length === 0) {
    const psm11Items = parseItemsFromText(fallbackText);
    items.push(...psm11Items);
  }

  return items;
}

/* ===============================
   PARSE ITEM LINE
   
   Parses a single item row into structured data
============================== */
function parseItemLine(row) {
  // Pattern: Description | Code | Qty | Unit Price | Total
  const parts = row.split(/\s{2,}|\t|\|/).map(p => p.trim()).filter(Boolean);

  if (parts.length >= 4) {
    // Find numeric columns from right (usually: Qty, Unit Price, Total)
    const numericIndices = [];
    for (let i = parts.length - 1; i >= 0; i--) {
      if (/^(?:[Rr]p\.?\s*)?[\d.,]+$/.test(parts[i])) {
        numericIndices.unshift(i);
      }
      if (numericIndices.length >= 3) break;
    }

    if (numericIndices.length >= 2) {
      const totalIdx = numericIndices[numericIndices.length - 1];
      const unitPriceIdx = numericIndices[numericIndices.length - 2];
      const qtyIdx = numericIndices.length >= 3 ? numericIndices[numericIndices.length - 3] : unitPriceIdx - 1;

      // Description is everything before qty
      const descParts = [];
      let accountCode = '';

      for (let i = 0; i < qtyIdx; i++) {
        const part = parts[i];
        // Check if this looks like an account code (e.g., 6102-IT-SERVICE)
        if (/^\d{4}-[A-Za-z]+-[A-Za-z]+$/.test(part) || /^\d+-\w+-\w+$/.test(part)) {
          accountCode = part;
        } else {
          descParts.push(part);
        }
      }

      const description = descParts.join(' ');
      const quantity = qtyIdx >= 0 && qtyIdx < parts.length ? (parseInt(parts[qtyIdx]) || 1) : 1;
      const unitPrice = parts[unitPriceIdx] || '';
      const total = parts[totalIdx] || '';

      if (description && total) {
        return {
          description,
          accountCode: accountCode || '',
          quantity: quantity.toString(),
          unitPrice,
          total
        };
      }
    }
  }

  return null;
}

/* ===============================
   EXTRACT GRAND TOTAL FROM PSM 12 (with PSM 11 fallback)
   
   Extracts Grand Total label and amount only
============================== */
function extractGrandTotalFromPSM(psm12Text, psm11Text) {
  const primaryText = psm12Text;
  const fallbackText = psm11Text;

  const grandTotalPatterns = [
    /[Gg]rand\s*[Tt]otal\s*[:\|]?\s*(?:[Rr]p\.?\s*)?([\d.,]+)/,
    /[Tt]otal\s*(?:[Kk]eseluruhan|[Aa]khir|[Pp]embayaran)?\s*[:\|]?\s*(?:[Rr]p\.?\s*)?([\d.,]+)/,
    /[Jj]umlah\s*[Tt]otal\s*[:\|]?\s*(?:[Rr]p\.?\s*)?([\d.,]+)/,
    /[Aa]mount\s*[Dd]ue\s*[:\|]?\s*(?:[Rr]p\.?\s*)?([\d.,]+)/,
    /[Nn]et\s*[Tt]otal\s*[:\|]?\s*(?:[Rr]p\.?\s*)?([\d.,]+)/,
    /[Ss]ubtotal\s*(?:[Aa]fter\s*[Tt]ax)?\s*[:\|]?\s*(?:[Rr]p\.?\s*)?([\d.,]+)/,
  ];

  // Try PSM 12 first (primary responsibility)
  for (const pattern of grandTotalPatterns) {
    const match = primaryText.match(pattern);
    if (match && match[1]) {
      return 'Rp ' + match[1].trim();
    }
  }

  // Fallback to PSM 11 only if not found in PSM 12
  for (const pattern of grandTotalPatterns) {
    const match = fallbackText.match(pattern);
    if (match && match[1]) {
      return 'Rp ' + match[1].trim();
    }
  }

  return '';
}

/* ===============================
   PARSER FOR STRUCTURED rawText
   
   Parses the merged rawText output into structured data
   This parser remains unchanged and consumes the rawText
============================== */
function parseOCRText(text) {
  const result = {
    vendor: null,
    invoiceNumber: null,
    invoiceDate: null,
    costCenter: null,
    transactionDescription: null,
    items: [],
    grandTotal: 0,
    rawText: text,
    parseLog: []
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Parse header section
  for (const line of lines) {
    // Vendor Name
    const vendorMatch = line.match(/^Vendor Name\s*:\s*(.+)$/i);
    if (vendorMatch && vendorMatch[1]) {
      result.vendor = vendorMatch[1].trim();
      result.parseLog.push(`Vendor: ${result.vendor}`);
    }

    // Invoice Number
    const invoiceMatch = line.match(/^Invoice Number\s*:\s*(.+)$/i);
    if (invoiceMatch && invoiceMatch[1]) {
      result.invoiceNumber = invoiceMatch[1].trim();
      result.parseLog.push(`Invoice Number: ${result.invoiceNumber}`);
    }

    // Invoice Date
    const dateMatch = line.match(/^Invoice Date\s*:\s*(.+)$/i);
    if (dateMatch && dateMatch[1]) {
      result.invoiceDate = dateMatch[1].trim();
      result.parseLog.push(`Invoice Date: ${result.invoiceDate}`);
    }

    // Cost Center
    const costCenterMatch = line.match(/^Cost Center\s*:\s*(.+)$/i);
    if (costCenterMatch && costCenterMatch[1]) {
      result.costCenter = costCenterMatch[1].trim();
      result.parseLog.push(`Cost Center: ${result.costCenter}`);
    }

    // Transaction Description
    const descMatch = line.match(/^Transaction Description\s*:\s*(.+)$/i);
    if (descMatch && descMatch[1]) {
      result.transactionDescription = descMatch[1].trim();
      result.parseLog.push(`Description: ${result.transactionDescription}`);
    }

    // Grand Total
    const grandTotalMatch = line.match(/^Grand Total\s*:\s*(?:Rp\s*)?([\d.,]+)/i);
    if (grandTotalMatch && grandTotalMatch[1]) {
      result.grandTotal = normalizeAmount(grandTotalMatch[1]);
      result.parseLog.push(`Grand Total: ${result.grandTotal}`);
    }
  }

  // Parse items section
  let inItemsSection = false;
  for (const line of lines) {
    if (line.includes('=== OCR ITEMS')) {
      inItemsSection = true;
      continue;
    }
    if (line.includes('=== OCR TOTAL')) {
      inItemsSection = false;
      continue;
    }

    if (inItemsSection && line.includes('|') && !line.includes('Item Description')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 5) {
        const item = {
          description: parts[0],
          accountCode: parts[1],
          qty: parseInt(parts[2]) || 1,
          unitPrice: normalizeAmount(parts[3]),
          totalAmount: normalizeAmount(parts[4])
        };
        result.items.push(item);
        result.parseLog.push(`Item: ${JSON.stringify(item)}`);
      }
    }
  }

  // Fallback vendor from header line (PT/CV/UD)
  if (!result.vendor) {
    for (const line of lines) {
      if (/^PT\s+/i.test(line) || /^CV\s+/i.test(line) || /^UD\s+/i.test(line)) {
        result.vendor = line.trim();
        result.parseLog.push(`Vendor from header: ${result.vendor}`);
        break;
      }
    }
  }

  return result;
}

/* ===============================
   FUZZY STRING MATCHING
============================== */
function similarity(str1, str2) {
  if (!str1 || !str2) return 0;

  str1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  str2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2[i - 1] === str1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(str1.length, str2.length);
  return 1 - matrix[str2.length][str1.length] / maxLen;
}

/* ===============================
   ENHANCED VALIDATOR WITH FUZZY MATCHING
============================== */
function validate(ocr, tx, dbItems, confidence, rawText) {
  const mismatches = [];
  const matches = [];
  const FUZZY_THRESHOLD = 0.75; // 75% similarity threshold
  const AMOUNT_TOLERANCE = 0.01; // 1% tolerance for amounts

  /* ===== VENDOR CHECK (FUZZY) ===== */
  const vendorSimilarity = similarity(ocr.vendor, tx.recipient_name);
  const vendorInRawText = rawText && tx.recipient_name ?
    rawText.toLowerCase().includes(tx.recipient_name.toLowerCase()) ||
    similarity(rawText.toLowerCase(), tx.recipient_name.toLowerCase()) > 0.3 : false;

  if (vendorSimilarity >= FUZZY_THRESHOLD || vendorInRawText) {
    matches.push({
      field: 'recipient_name',
      expected: tx.recipient_name,
      detected: ocr.vendor,
      similarity: vendorSimilarity,
      status: 'match'
    });
  } else if (ocr.vendor || tx.recipient_name) {
    mismatches.push({
      field: 'recipient_name',
      expected: tx.recipient_name,
      detected: ocr.vendor,
      similarity: vendorSimilarity,
      severity: vendorSimilarity >= 0.5 ? 'warning' : 'blocker'
    });
  }

  /* ===== INVOICE NUMBER CHECK (FUZZY) ===== */
  const invoiceSimilarity = similarity(ocr.invoiceNumber, tx.invoice_number);
  const invoiceInRawText = rawText && tx.invoice_number ?
    rawText.toUpperCase().includes(tx.invoice_number.toUpperCase()) : false;

  if (invoiceSimilarity >= FUZZY_THRESHOLD || invoiceInRawText) {
    matches.push({
      field: 'invoice_number',
      expected: tx.invoice_number,
      detected: ocr.invoiceNumber,
      similarity: invoiceSimilarity,
      status: 'match'
    });
  } else if (ocr.invoiceNumber || tx.invoice_number) {
    mismatches.push({
      field: 'invoice_number',
      expected: tx.invoice_number,
      detected: ocr.invoiceNumber,
      similarity: invoiceSimilarity,
      severity: invoiceSimilarity >= 0.5 ? 'warning' : 'blocker'
    });
  }

  /* ===== GRAND TOTAL CHECK (WITH TOLERANCE) ===== */
  const expectedAmount = Number(tx.amount) || 0;
  const detectedAmount = ocr.grandTotal || 0;
  const amountDiff = Math.abs(expectedAmount - detectedAmount);
  const amountTolerance = expectedAmount * AMOUNT_TOLERANCE;

  // Also check if amount exists in raw text
  const amountInRawText = rawText ? checkAmountInText(rawText, expectedAmount) : false;

  if (amountDiff <= amountTolerance || expectedAmount === detectedAmount || amountInRawText) {
    matches.push({
      field: 'amount',
      expected: expectedAmount,
      detected: detectedAmount,
      difference: amountDiff,
      status: 'match'
    });
  } else if (expectedAmount > 0) {
    mismatches.push({
      field: 'amount',
      expected: expectedAmount,
      detected: detectedAmount,
      difference: amountDiff,
      percentDiff: ((amountDiff / expectedAmount) * 100).toFixed(2) + '%',
      severity: amountDiff / expectedAmount <= 0.05 ? 'warning' : 'blocker'
    });
  }

  /* ===== ITEMS TOTAL CHECK ===== */
  let ocrSum = ocr.items.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const dbSum = dbItems.reduce((s, i) => s + Number(i.total_amount || 0), 0);

  // Fallback logic for items total if no item rows were detected
  if (dbSum > 0 && ocrSum === 0) {
    // 1. Try to use detected grand total as fallback if it matches dbSum
    if (detectedAmount > 0 && Math.abs(detectedAmount - dbSum) <= dbSum * AMOUNT_TOLERANCE) {
      ocrSum = detectedAmount;
    } 
    // 2. Try to find the expected sum directly in raw text (ultimate fallback)
    else if (rawText && checkAmountInText(rawText, dbSum)) {
      ocrSum = dbSum;
    }
  }

  const itemsDiff = Math.abs(ocrSum - dbSum);

  if (dbSum > 0) {
    if (itemsDiff <= dbSum * AMOUNT_TOLERANCE || ocrSum === dbSum) {
      matches.push({
        field: 'items_total',
        expected: dbSum,
        detected: ocrSum,
        status: 'match'
      });
    } else {
      mismatches.push({
        field: 'items_total',
        expected: dbSum,
        detected: ocrSum,
        difference: itemsDiff,
        severity: itemsDiff / dbSum <= 0.05 ? 'warning' : 'info'
      });
    }
  }

  /* ===== CALCULATE OVERALL MATCH ===== */
  const blockerCount = mismatches.filter(m => m.severity === 'blocker').length;
  const warningCount = mismatches.filter(m => m.severity === 'warning').length;

  // Match if no blockers and amount matches
  const isMatch = blockerCount === 0 ||
    (blockerCount === 0 && warningCount <= 2) ||
    (amountInRawText && invoiceInRawText);

  return {
    match: isMatch,
    mismatches,
    matches,
    parsed: {
      vendor: ocr.vendor,
      invoiceNumber: ocr.invoiceNumber,
      invoiceDate: ocr.invoiceDate,
      costCenter: ocr.costCenter,
      description: ocr.transactionDescription,
      items: ocr.items,
      grandTotal: ocr.grandTotal
    },
    summary: {
      ocrSum,
      dbSum,
      ocrGrandTotal: ocr.grandTotal,
      dbAmount: expectedAmount,
      confidence,
      blockerCount,
      warningCount,
      matchCount: matches.length
    },
    parseLog: ocr.parseLog || []
  };
}

/* ===============================
   CHECK AMOUNT IN TEXT
============================== */
function checkAmountInText(text, expectedAmount) {
  if (!text || !expectedAmount) return false;

  // Format expected amount in various ways
  const formatted1 = expectedAmount.toString(); // 1500000
  const formatted2 = expectedAmount.toLocaleString('id-ID'); // 1.500.000
  const formatted3 = expectedAmount.toLocaleString('en-US'); // 1,500,000

  // Remove all formatting from text and check
  const cleanText = text.replace(/\s+/g, '');

  return cleanText.includes(formatted1) ||
    cleanText.includes(formatted2.replace(/\./g, '')) ||
    text.includes(formatted2) ||
    text.includes(formatted3);
}

/* ===============================
   NORMALIZE AMOUNT (INDONESIAN FORMAT)
============================== */
function normalizeAmount(v) {
  if (!v) return 0;

  // Remove currency prefix
  let cleaned = v.toString()
    .replace(/^[Rr]p\.?\s*/i, '')
    .replace(/\s+/g, '')
    .trim();

  // Handle Indonesian format (1.500.000) vs English format (1,500,000)
  // If there are multiple dots, it's likely Indonesian format
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (dotCount > 1 || (dotCount === 1 && commaCount === 0 && cleaned.indexOf('.') < cleaned.length - 3)) {
    // Indonesian format: 1.500.000 -> 1500000
    cleaned = cleaned.replace(/\./g, '');
  } else if (commaCount > 0 && dotCount <= 1) {
    // Could be either format, check comma position and frequency
    const lastCommaIdx = cleaned.lastIndexOf(',');
    const lastDotIdx = cleaned.lastIndexOf('.');

    if (commaCount > 1) {
      // English format grouping: 1,500,000 -> 1500000
      cleaned = cleaned.replace(/,/g, '');
    } else if (lastCommaIdx > lastDotIdx && lastCommaIdx === cleaned.length - 3) {
      // Indonesian decimal: 1.500,50 -> 1500.50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastDotIdx > lastCommaIdx && lastDotIdx === cleaned.length - 3) {
      // English decimal: 1,500.50 -> 1500.50
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Default fallback
      if (lastCommaIdx > lastDotIdx) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

export default {
  processDocument
};
