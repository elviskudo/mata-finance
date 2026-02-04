import { query } from '../config/database.js';

/**
 * Master Data Service
 * Menyediakan auto-suggest dan validasi untuk vendor, cost center, dan GL account
 */

// Simulated master data (in production, this would come from a master data DB)
const VENDOR_DB = [
  { id: 'v1', name: 'PT Teknologi Indonesia', category: 'IT', frequency: 15 },
  { id: 'v2', name: 'CV Jaya Abadi', category: 'General', frequency: 8 },
  { id: 'v3', name: 'PT Solusi Digital', category: 'IT', frequency: 12 },
  { id: 'v4', name: 'UD Makmur Sejahtera', category: 'Office Supply', frequency: 5 },
];

const COST_CENTER_DB = [
  { code: 'IT-DEPT-001', name: 'IT Department', department: 'IT' },
  { code: 'FIN-DEPT-001', name: 'Finance Department', department: 'Finance' },
  { code: 'HR-DEPT-001', name: 'HR Department', department: 'HR' },
  { code: 'OPS-DEPT-001', name: 'Operations Department', department: 'Operations' },
];

const GL_ACCOUNTS = [
  { code: '4100', name: 'Biaya IT & Software', category: 'Expense' },
  { code: '4200', name: 'Biaya Office Supply', category: 'Expense' },
  { code: '4300', name: 'Biaya Konsultan', category: 'Expense' },
  { code: '5100', name: 'Utang Usaha', category: 'Liability' },
];

/**
 * Auto-suggest vendor berdasarkan nama
 */
export const suggestVendor = async (vendorName) => {
  if (!vendorName || vendorName.length < 2) {
    return { suggestions: [], isNew: true, flag: null };
  }

  const needle = vendorName.toLowerCase();
  const matches = VENDOR_DB.filter(v => 
    v.name.toLowerCase().includes(needle)
  ).sort((a, b) => b.frequency - a.frequency);

  if (matches.length === 0) {
    return {
      suggestions: [],
      isNew: true,
      flag: 'VENDOR_RARELY_USED', // Flag untuk vendor baru/jarang
    };
  }

  // Check if exact match exists
  const exactMatch = matches.find(v => 
    v.name.toLowerCase() === needle
  );

  return {
    suggestions: matches.slice(0, 5).map(v => ({
      id: v.id,
      name: v.name,
      category: v.category,
      frequency: v.frequency,
    })),
    isNew: !exactMatch,
    flag: exactMatch ? null : 'VENDOR_SIMILAR_FOUND',
    vendorId: exactMatch?.id,
  };
};

/**
 * Validasi dan auto-suggest cost center
 */
export const validateCostCenter = async (costCenterCode) => {
  if (!costCenterCode) {
    return { valid: false, suggestions: COST_CENTER_DB.slice(0, 5) };
  }

  const match = COST_CENTER_DB.find(cc => 
    cc.code.toLowerCase() === costCenterCode.toLowerCase()
  );

  if (match) {
    return {
      valid: true,
      costCenter: match,
      suggestions: [],
    };
  }

  // Fuzzy search
  const suggestions = COST_CENTER_DB.filter(cc =>
    cc.code.toLowerCase().includes(costCenterCode.toLowerCase()) ||
    cc.name.toLowerCase().includes(costCenterCode.toLowerCase())
  ).slice(0, 5);

  return {
    valid: false,
    suggestions,
  };
};

/**
 * Get GL account suggestions
 */
export const suggestGLAccount = async (accountCode) => {
  if (!accountCode || accountCode.length < 2) {
    return { suggestions: GL_ACCOUNTS.slice(0, 10) };
  }

  const needle = accountCode.toLowerCase();
  const matches = GL_ACCOUNTS.filter(acc =>
    acc.code.includes(needle) ||
    acc.name.toLowerCase().includes(needle)
  );

  return {
    suggestions: matches.length > 0 ? matches : GL_ACCOUNTS.slice(0, 10),
  };
};

/**
 * Get transaction type schema (field requirements & validation rules)
 */
export const getTransactionTypeSchema = (transactionType) => {
  const schemas = {
    payment: {
      requiredFields: ['vendorName', 'invoiceDate', 'amount', 'costCenter'],
      optionalFields: ['invoiceNumber', 'description'],
      defaultApprovalPath: 'single_level',
      validationRules: {
        amountMin: 0,
        amountMax: 1000000000, // 1 Miliar
        requireDocument: true,
        requireOCR: true,
      },
    },
    expense: {
      requiredFields: ['description', 'amount', 'costCenter'],
      optionalFields: ['vendorName', 'invoiceDate', 'invoiceNumber'],
      defaultApprovalPath: 'single_level',
      validationRules: {
        amountMin: 0,
        amountMax: 50000000, // 50 Juta
        requireDocument: false,
        requireOCR: false,
      },
    },
    general: {
      requiredFields: ['description', 'amount'],
      optionalFields: ['vendorName', 'invoiceDate', 'costCenter'],
      defaultApprovalPath: 'single_level',
      validationRules: {
        amountMin: 0,
        amountMax: 100000000,
        requireDocument: false,
        requireOCR: false,
      },
    },
  };

  return schemas[transactionType] || schemas.general;
};

export default {
  suggestVendor,
  validateCostCenter,
  suggestGLAccount,
  getTransactionTypeSchema,
};
