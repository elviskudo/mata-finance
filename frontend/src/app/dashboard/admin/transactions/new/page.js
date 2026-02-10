'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Save,
  Receipt,
  Loader2,
  Info,
  Trash2,
  Plus,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { transactionAPI } from '@/lib/api';
import { useAlertModal } from '@/components/AlertModal';

const STEPS = [
  { id: 0, title: 'Entry Hub', icon: FileText },
  { id: 1, title: 'Inisialisasi', icon: FileText },
  { id: 2, title: 'Metadata', icon: Info },
  { id: 3, title: 'Detail Item', icon: Receipt },
  { id: 4, title: 'Upload & OCR', icon: Upload },
  { id: 5, title: 'Validasi', icon: ShieldCheck },
];

export default function NewTransactionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const alertModal = useAlertModal();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true); // Loading initial data
  const [txId, setTxId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [status, setStatus] = useState('');

  // States for Steps
  const [initData, setInitData] = useState({ type: 'payment' });
  const [headerData, setHeaderData] = useState({
    vendorName: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '',
    amount: '',
    description: '',
    costCenter: 'IT-DEPT-001',
  });
  const [items, setItems] = useState([{ description: '', accountCode: '', quantity: 1, price: 0 }]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [preCheckReport, setPreCheckReport] = useState(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [entryHubData, setEntryHubData] = useState(null);
  const [paketRevisi, setPaketRevisi] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [isReplacementMode, setIsReplacementMode] = useState(false); // Track if this is a replacement for rejected transaction
  const [originalRejectedId, setOriginalRejectedId] = useState(null); // Track original rejected transaction

  // --- INITIAL LOAD ---
  useEffect(() => {
    const id = searchParams.get('id');
    const replacementMode = searchParams.get('replacementMode') === 'true';
    
    if (replacementMode) {
      setIsReplacementMode(true);
    }
    
    if (id) {
      loadTransaction(id);
    } else {
      loadEntryHub();
    }
  }, [searchParams]);

  // --- PREVENT NAVIGATION IN REPLACEMENT MODE ---
  useEffect(() => {
    if (!isReplacementMode) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Anda sedang dalam mode penggantian transaksi. Yakin ingin keluar tanpa menyelesaikan?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isReplacementMode]);

  const loadEntryHub = async () => {
    try {
      setLoading(true);
      const res = await transactionAPI.getEntryHub();
      setEntryHubData(res.data.data);
      setCurrentStep(0);
    } catch (err) {
      console.error(err);
      alertModal.error('Gagal memuat Entry Hub');
      router.push('/dashboard/admin/transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadTransaction = async (id) => {
  try {
    setLoading(true);
    const res = await transactionAPI.getById(id);
    const data = res.data.data;

    setTxId(data.id);
    setStatus(data.status);

    const locked = !['in_progress', 'draft', 'returned'].includes(data.status);
    setIsReadOnly(locked);

    // If returned, fetch revision details
    if (data.status === 'returned') {
      try {
        const revRes = await transactionAPI.getRevisionDetails(id);
        const revData = revRes.data.data;
        setPaketRevisi(revData.paketRevisi);

        // Start countdown if deadline
        if (revData.paketRevisi.deadline) {
          const deadline = new Date(revData.paketRevisi.deadline);
          const interval = setInterval(() => {
            const now = new Date();
            const diff = deadline - now;
            if (diff > 0) {
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((diff % (1000 * 60)) / 1000);
              setCountdown(`${hours}h ${minutes}m ${seconds}s`);
            } else {
              setCountdown('Expired');
              clearInterval(interval);
            }
          }, 1000);
          // Note: In production, clear interval on unmount
        }
      } catch (err) {
        console.error('Failed to load revision details:', err);
      }
    }

    let step = 1; // default

    // INIT
    setInitData({ type: data.type || 'payment' });

    // HEADER
    if (data.recipientName) {
      setHeaderData({
        vendorName: data.recipientName,
        invoiceDate: data.dueDate?.slice(0, 10) || '',
        invoiceNumber: data.invoiceNumber || '',
        amount: data.amount,
        description: data.description,
        costCenter: data.costCenter || 'IT-DEPT-001',
      });
      step = 2;
    }

    // ITEMS
    if (data.items?.length > 0) {
      setItems(
        data.items.map((i) => ({
          id: i.id,
          description: i.description,
          accountCode: i.accountCode,
          quantity: i.quantity,
          price: i.price,
        })),
      );
      step = 3;
    }

    // DOCUMENT
    if (data.documents?.length > 0) {
      setUploadedFile(data.documents[0].file_name);
      step = 4;
    }

    // Load OCR Result if exists
    if (data.ocrResult) {
      setOcrResult(data.ocrResult);
    }

    // Load Pre-check Report if exists and advance to validation step
    if (data.precheckReport) {
      setPreCheckReport(data.precheckReport);
      step = 5;
    }

    // LOCKED / FINAL
    if (locked) step = 5;

    setCurrentStep(step); // ✅ SEKALI SAJA
  } catch (err) {
    console.error(err);
    alertModal.error('Gagal memuat transaksi');
    router.push('/dashboard/admin/transactions');
  } finally {
    setLoading(false);
  }
};


  // --- HANDLERS ---

  const [schema, setSchema] = useState(null);

  const handleInit = async () => {
    setLoading(true);
    try {
      const res = await transactionAPI.init({ transactionType: initData.type });
      setTxId(res.data.data.id);
      setSchema(res.data.data.schema); // Store schema for form validation
      setCurrentStep(2);
    } catch (err) {
      console.error(err);
      alertModal.error(err.response?.data?.message || 'Gagal inisialisasi transaksi');
    } finally {
      setLoading(false);
    }
  };

  const [headerFlags, setHeaderFlags] = useState(null);

  const handleHeaderSave = async () => {
    // Validate required fields based on schema
    if (schema) {
      const required = schema.requiredFields || [];
      if (required.includes('vendorName') && !headerData.vendorName) {
        return alertModal.warning('Nama vendor wajib diisi');
      }
      if (required.includes('amount') && !headerData.amount) {
        return alertModal.warning('Jumlah wajib diisi');
      }
      if (required.includes('costCenter') && !headerData.costCenter) {
        return alertModal.warning('Cost center wajib diisi');
      }
    } else {
      if (!headerData.vendorName || !headerData.amount) {
        return alertModal.warning('Data wajib belum diisi');
      }
    }

    setLoading(true);
    try {
      const res = await transactionAPI.updateHeader(txId, {
        ...headerData,
        currency: 'IDR',
      });
      setHeaderFlags(res.data.flags); // Store flags for display
      setCurrentStep(3);
    } catch (err) {
      console.error(err);
      alertModal.error(err.response?.data?.message || 'Gagal simpan header');
    } finally {
      setLoading(false);
    }
  };

  const [itemsCalculated, setItemsCalculated] = useState(null);

  const handleItemsSave = async () => {
    // Basic validation
    if (items.some((i) => !i.description || i.price < 0 || i.quantity <= 0))
      return alertModal.warning('Lengkapi data item (Deskripsi wajib, Harga min 0, Quantity > 0)');
    // Validate account code format: code-department-category
    const accountCodeRegex = /^\d+-[^-]+-[^-]+$/;
    if (items.some((i) => i.accountCode && !accountCodeRegex.test(i.accountCode)))
      return alertModal.warning('Format Kode Akun harus: code-department-category (contoh: 101-IT-Hardware)');
    setLoading(true);
    try {
      const res = await transactionAPI.addItems(txId, items);
      setItemsCalculated(res.data.calculated); // Store calculated totals
      if (res.data.flags && res.data.flags.length > 0) {
        console.warn('Item flags:', res.data.flags);
      }
      setCurrentStep(4); // To Upload
    } catch (err) {
      console.error(err);
      alertModal.error(err.response?.data?.message || 'Gagal simpan items');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await transactionAPI.uploadDocument(txId, formData);
      setUploadedFile(res.data.data.document);
      setOcrResult(res.data.data.ocr); // Contains simulated OCR data
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Gagal upload dokumen';
      alertModal.error(`Error Upload/OCR: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // ... (Pre-Check and Submit handlers) ...

  const runPreCheck = async () => {
    setLoading(true);
    try {
      const res = await transactionAPI.getPreCheck(txId);
      setPreCheckReport(res.data.data);
    } catch (err) {
      console.error(err);
      // alert('Gagal menjalankan pre-check');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isEmergency && !emergencyReason.trim()) {
      return alertModal.warning('Alasan emergency wajib diisi jika mode emergency aktif');
    }
    setLoading(true);
    try {
      const res = await transactionAPI.submit(txId, {
        notes: submitNotes,
        isEmergency,
        emergencyReason
      });
      
      // Clear replacement mode to allow navigation
      setIsReplacementMode(false);
      
      // Show success message with locked status
      if (res.data.data?.locked) {
        alertModal.success('Transaksi berhasil disubmit dan terkunci. Status: ' + res.data.data.message);
      }
      router.push('/dashboard/admin/transactions'); // Back to list
    } catch (err) {
      console.error(err);
      alertModal.error(err.response?.data?.message || 'Gagal submit transaksi');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER FUNCTIONS ---

  // STEP 0: ENTRY HUB
  const renderEntryHub = () => (
    <div className="space-y-6 animate-in">
      <h3 className="text-lg font-semibold text-dark-100">Entry Hub - Input Transaksi</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-primary-400">{entryHubData?.summary?.inProgress || 0}</div>
          <p className="text-sm text-dark-400">In Progress</p>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{entryHubData?.summary?.draft || 0}</div>
          <p className="text-sm text-dark-400">Draft</p>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-rose-400">{entryHubData?.summary?.returned || 0}</div>
          <p className="text-sm text-dark-400">Returned</p>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => setCurrentStep(1)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" /> Buat Transaksi Baru
        </button>
      </div>

      {entryHubData?.drafts?.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold text-dark-100">Draft & Returned Transactions</h4>
          {entryHubData.drafts.map((draft) => (
            <div key={draft.id} className="glass-card p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{draft.code} - {draft.type}</p>
                <p className="text-sm text-dark-400">Amount: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(draft.amount)}</p>
                <p className="text-sm text-dark-400">Status: {draft.status}</p>
              </div>
             <button
  onClick={() => router.push(`/dashboard/admin/transactions/new?id=${draft.id}`)}
  className="btn-secondary"
>
  Lanjutkan
</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // STEP 1: INIT
  const renderInit = () => (
    <div className="space-y-6 animate-in">
      <h3 className="text-lg font-semibold text-dark-100">Pilih Tipe Transaksi</h3>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setInitData({ type: 'payment' });
          }}
          className={`p-6 rounded-xl border-2 transition-all ${
            initData.type === 'payment'
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-dark-700 hover:border-dark-600'
          }`}
        >
          <Receipt className="w-8 h-8 mx-auto mb-2 text-primary-400" />
          <p className="font-semibold text-dark-100">Payment</p>
          <p className="text-sm text-dark-400">Pembayaran Vendor</p>
        </button>
        <button
          onClick={() => {
            setInitData({ type: 'expense' });
          }}
          className={`p-6 rounded-xl border-2 transition-all ${
            initData.type === 'expense'
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-dark-700 hover:border-dark-600'
          }`}
        >
          <FileText className="w-8 h-8 mx-auto mb-2 text-primary-400" />
          <p className="font-semibold text-dark-100">Expense</p>
          <p className="text-sm text-dark-400">Pengeluaran Lainnya</p>
        </button>
      </div>
      <div className="flex justify-end pt-4">
        {txId ? (
          <button onClick={() => setCurrentStep(2)} className="btn-primary">
            Lanjut ke Metadata
          </button>
        ) : (
          <button onClick={handleInit} disabled={loading} className="btn-primary">
            {loading ? 'Memproses...' : 'Buat Transaksi Baru'}
          </button>
        )}
      </div>
    </div>
  );

  // STEP 2: HEADER
  const renderHeader = () => {
    const isEditable = status === 'returned' ? paketRevisi?.editableFields?.includes('header') : !isReadOnly;

    return (
      <div className="space-y-4 animate-in">
        <h3 className="text-lg font-semibold text-dark-100">Informasi Header Transaksi</h3>
        {paketRevisi && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-400 font-medium">Mode Revisi</p>
            <p className="text-sm text-dark-300">Deadline: {paketRevisi.deadline ? new Date(paketRevisi.deadline).toLocaleString('id-ID') : 'N/A'}</p>
            {countdown && <p className="text-sm text-red-400">Sisa waktu: {countdown}</p>}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Nama Vendor/Penerima *
            </label>
            <input
              type="text"
              value={headerData.vendorName}
              onChange={(e) => setHeaderData({ ...headerData, vendorName: e.target.value })}
              className="input-field"
              placeholder="Nama vendor atau penerima pembayaran"
              disabled={!isEditable}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Tanggal Invoice</label>
              <input
                type="date"
                value={headerData.invoiceDate}
                onChange={(e) => setHeaderData({ ...headerData, invoiceDate: e.target.value })}
                className="input-field"
                disabled={!isEditable}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Nomor Invoice</label>
              <input
                type="text"
                value={headerData.invoiceNumber}
                onChange={(e) => setHeaderData({ ...headerData, invoiceNumber: e.target.value })}
                className="input-field"
                placeholder="INV-XXXX"
                disabled={!isEditable}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Jumlah (IDR) *</label>
            <input
              type="number"
              value={headerData.amount}
              onChange={(e) => setHeaderData({ ...headerData, amount: e.target.value })}
              className="input-field"
              placeholder="0"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Deskripsi</label>
            <textarea
              value={headerData.description}
              onChange={(e) => setHeaderData({ ...headerData, description: e.target.value })}
              className="input-field min-h-[80px]"
              placeholder="Deskripsi transaksi..."
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Cost Center</label>
            <input
              type="text"
              value={headerData.costCenter}
              onChange={(e) => setHeaderData({ ...headerData, costCenter: e.target.value })}
              className="input-field"
              placeholder="IT-DEPT-001"
              disabled={!isEditable}
            />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button onClick={handleHeaderSave} disabled={loading || !isEditable} className="btn-primary">
            {loading ? 'Menyimpan...' : 'Lanjut ke Detail Item'}
          </button>
        </div>
      </div>
    );
  };

  // STEP 3: ITEMS
  const renderItems = () => {
    const isEditable = status === 'returned' ? paketRevisi?.editableFields?.includes('items') : !isReadOnly;

    return (
      <div className="space-y-4 animate-in">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-dark-100">Detail Line Items</h3>
          {isEditable && (
            <button
              onClick={() =>
                setItems([...items, { description: '', accountCode: '', quantity: 1, price: 0 }])
              }
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              + Tambah Baris
            </button>
          )}
        </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="glass-card p-4 border border-dark-700/50 flex gap-4 items-start relative group"
          >
            <div className="flex-1 space-y-2">
              <input
                className="input-field text-sm"
                placeholder="Deskripsi Item"
                value={item.description}
                disabled={!isEditable}
                onChange={(e) => {
                  const val = e.target.value;
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, description: val } : it)),
                  );
                }}
              />
              <div className="flex gap-2">
                <input
                  className="input-field text-sm w-32"
                  placeholder="e.g., 101-IT-Hardware"
                  value={item.accountCode}
                  disabled={!isEditable}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, accountCode: val } : it)),
                    );
                  }}
                />
                <input
                  type="number"
                  className="input-field text-sm w-24"
                  placeholder="Qty"
                  value={item.quantity}
                  disabled={!isEditable}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it)),
                    );
                  }}
                />
                <input
                  type="number"
                  className="input-field text-sm flex-1"
                  placeholder="Harga Satuan"
                  value={item.price}
                  disabled={!isEditable}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, price: val } : it)),
                    );
                  }}
                />
              </div>
            </div>
            {items.length > 1 && (
              <button
                onClick={() => {
                  setItems((prev) => prev.filter((_, i) => i !== idx));
                }}
                className="p-2 text-dark-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                title="Hapus Item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

        <div className="flex justify-end pt-4">
          <button onClick={handleItemsSave} disabled={loading || !isEditable} className="btn-primary">
            {loading ? 'Menyimpan...' : 'Lanjut ke Dokumen'}
          </button>
        </div>
      </div>
    );
  };

  // STEP 4: UPLOAD & OCR
  const renderUpload = () => (
    <div className="space-y-6 animate-in">
      <h3 className="text-lg font-semibold text-dark-100">Upload Dokumen Pendukung</h3>

      {!ocrResult ? (
        <div className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center hover:border-primary-500/50 transition-colors">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/*,.pdf"
            onChange={handleUpload}
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
            {loading ? (
              <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
            ) : (
              <Upload className="w-12 h-12 text-dark-400" />
            )}
            <span className="text-dark-200 font-medium">
              {loading ? 'Memproses OCR...' : 'Klik untuk Upload Invoice / Bon'}
            </span>
            <span className="text-sm text-dark-500">MendukungJPG, PNG (Max 5MB), Tidak mendukung PDF untuk optimalisasi sistem</span>
          </label>
        </div>
      ) : (
        <div className="glass-card p-6 border-l-4 border-l-primary-500">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-semibold text-dark-100 mb-3">Hasil Scan OCR</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {/* Vendor */}
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-dark-400 text-xs mb-1">Vendor Terdeteksi</p>
                  <p className={`font-medium ${ocrResult?.parsed?.vendor ? 'text-dark-100' : 'text-yellow-400'}`}>
                    {ocrResult?.parsed?.vendor || 'Tidak terdeteksi'}
                  </p>
                </div>
                
                {/* Invoice Number */}
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-dark-400 text-xs mb-1">Nomor Invoice</p>
                  <p className={`font-medium font-mono ${ocrResult?.parsed?.invoiceNumber ? 'text-dark-100' : 'text-yellow-400'}`}>
                    {ocrResult?.parsed?.invoiceNumber || 'Tidak terdeteksi'}
                  </p>
                </div>
                
                {/* Invoice Date */}
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-dark-400 text-xs mb-1">Tanggal Invoice</p>
                  <p className={`font-medium ${ocrResult?.parsed?.invoiceDate ? 'text-dark-100' : 'text-yellow-400'}`}>
                    {ocrResult?.parsed?.invoiceDate || 'Tidak terdeteksi'}
                  </p>
                </div>
                
                {/* Cost Center */}
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-dark-400 text-xs mb-1">Cost Center</p>
                  <p className={`font-medium font-mono ${ocrResult?.parsed?.costCenter ? 'text-dark-100' : 'text-yellow-400'}`}>
                    {ocrResult?.parsed?.costCenter || 'Tidak terdeteksi'}
                  </p>
                </div>
                
                {/* Grand Total */}
                <div className="p-3 rounded-lg bg-dark-800/50 md:col-span-2">
                  <p className="text-dark-400 text-xs mb-1">Grand Total Terdeteksi</p>
                  <p className="text-xl font-bold text-primary-400 font-mono">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(
                      ocrResult?.summary?.ocrGrandTotal || ocrResult?.parsed?.grandTotal || 0,
                    )}
                  </p>
                </div>
              </div>
              
              {/* Items Preview */}
              {ocrResult?.parsed?.items?.length > 0 && (
                <div className="mt-4">
                  <p className="text-dark-400 text-xs mb-2">Item Terdeteksi ({ocrResult.parsed.items.length})</p>
                  <div className="space-y-2">
                    {ocrResult.parsed.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-dark-800/30 rounded">
                        <span className="text-dark-200">{item.description}</span>
                        <span className="text-dark-100 font-mono">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.totalAmount || 0)}
                        </span>
                      </div>
                    ))}
                    {ocrResult.parsed.items.length > 3 && (
                      <p className="text-xs text-dark-500">+{ocrResult.parsed.items.length - 3} item lainnya</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Confidence Score */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-dark-400 text-xs mb-1">Confidence Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          (ocrResult?.summary?.confidence || 0) >= 80 ? 'bg-emerald-500' :
                          (ocrResult?.summary?.confidence || 0) >= 60 ? 'bg-yellow-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(ocrResult?.summary?.confidence || 0, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${
                      (ocrResult?.summary?.confidence || 0) >= 80 ? 'text-emerald-400' :
                      (ocrResult?.summary?.confidence || 0) >= 60 ? 'text-yellow-400' : 'text-rose-400'
                    }`}>
                      {(Number(ocrResult?.summary?.confidence) || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Match Status Badge */}
            <div className="flex-shrink-0">
              {ocrResult?.match ? (
                <div className="flex flex-col items-center text-emerald-400 p-4 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 className="w-10 h-10 mb-2" />
                  <span className="text-sm font-semibold">Data Cocok</span>
                  <span className="text-xs text-emerald-300 mt-1">{ocrResult?.summary?.matchCount || 0} field cocok</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-rose-400 p-4 bg-rose-500/10 rounded-xl">
                  <AlertTriangle className="w-10 h-10 mb-2" />
                  <span className="text-sm font-semibold">Ada Selisih</span>
                  <span className="text-xs text-rose-300 mt-1">{ocrResult?.summary?.blockerCount || 0} masalah</span>
                </div>
              )}
            </div>
          </div>

          {/* Mismatch Details */}
          {!ocrResult?.match && ocrResult?.mismatches?.length > 0 && (
            <div className="mt-4 p-4 bg-rose-500/10 rounded-lg border border-rose-500/20">
              <p className="text-rose-400 font-medium text-sm mb-3">⚠️ Detail Perbedaan:</p>
              <div className="space-y-3">
                {ocrResult.mismatches.map((m, idx) => (
                  <div key={idx} className="flex justify-between items-start p-2 bg-rose-500/5 rounded">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        m.severity === 'blocker' ? 'bg-rose-500/20 text-rose-400' :
                        m.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {m.severity === 'blocker' ? 'Error' : m.severity === 'warning' ? 'Warning' : 'Info'}
                      </span>
                      <span className="text-dark-200 text-sm capitalize">{m.field?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-dark-400">Diharapkan: <span className="text-dark-100">{m.expected || '-'}</span></p>
                      <p className="text-dark-400">Terdeteksi: <span className="text-rose-300">{m.detected || '-'}</span></p>
                      {m.similarity !== undefined && (
                        <p className="text-dark-500">Kemiripan: {(m.similarity * 100).toFixed(0)}%</p>
                      )}
                      {m.percentDiff && (
                        <p className="text-dark-500">Selisih: {m.percentDiff}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-rose-300/70">
                Harap periksa kembali data input atau berikan catatan penjelasan saat submit.
              </p>
            </div>
          )}
          
          {/* Match Details */}
          {ocrResult?.match && ocrResult?.matches?.length > 0 && (
            <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <p className="text-emerald-400 font-medium text-sm mb-2">✓ Validasi OCR Berhasil</p>
              <div className="flex flex-wrap gap-2">
                {ocrResult.matches.map((m, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded">
                    ✓ {m.field?.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Debug Info - Show when fields not detected */}
          {(!ocrResult?.parsed?.vendor || !ocrResult?.parsed?.invoiceNumber || !ocrResult?.parsed?.grandTotal) && (
            <details className="mt-4">
              <summary className="text-xs text-dark-500 cursor-pointer hover:text-dark-400">
                🔍 Debug Info (klik untuk melihat detail parsing)
              </summary>
              <div className="mt-2 p-3 bg-dark-900/50 rounded-lg text-xs font-mono">
                <p className="text-dark-400 mb-2">Parse Log:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {ocrResult?.parseLog?.length > 0 ? (
                    ocrResult.parseLog.map((log, idx) => (
                      <p key={idx} className="text-dark-500">{log}</p>
                    ))
                  ) : (
                    <p className="text-dark-600">Tidak ada log parsing tersedia</p>
                  )}
                </div>
                <p className="text-dark-400 mt-2 mb-1">Confidence: {ocrResult?.summary?.confidence?.toFixed(1)}%</p>
                <p className="text-dark-400 mb-1">Fields Detected: {ocrResult?.summary?.matchCount || 0}</p>
                <p className="text-dark-400">Blockers: {ocrResult?.summary?.blockerCount || 0}, Warnings: {ocrResult?.summary?.warningCount || 0}</p>
              </div>
            </details>
          )}
        </div>
      )}

      {ocrResult && (
        <div className="flex justify-end pt-4">
          <button
            onClick={() => {
              runPreCheck();
              setCurrentStep(5);
            }}
            className="btn-primary"
          >
            Lanjut ke Validasi
          </button>
        </div>
      )}
    </div>
  );

  // STEP 5: PRE-CHECK & SUBMIT
  const renderValidation = () => (
    <div className="space-y-6 animate-in">
      <h3 className="text-lg font-semibold text-dark-100">Review & Validasi</h3>

      {!preCheckReport ? (
        <div className="p-8 text-center text-dark-400">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
          Sedang menjalankan pre-check...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary sesuai diagram */}
          {preCheckReport.summary && (
            <div className="glass-card p-4 border-l-4 border-l-primary-500">
              <h4 className="font-semibold text-dark-100 mb-2">Ringkasan Kesehatan</h4>
              <div className="space-y-1 text-sm">
                <p className="text-dark-300">{preCheckReport.summary.completeness}</p>
                <p className="text-dark-300">{preCheckReport.summary.ocrMatch}</p>
                <p className="text-dark-300">
                  Risiko:{' '}
                  <span
                    className={`font-semibold ${
                      preCheckReport.summary.risk === 'LOW'
                        ? 'text-emerald-400'
                        : preCheckReport.summary.risk === 'MEDIUM'
                          ? 'text-yellow-400'
                          : 'text-rose-400'
                    }`}
                  >
                    {preCheckReport.summary.risk}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Risk Score */}
          <div className="glass-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Tingkat Risiko</p>
              <h4
                className={`text-2xl font-bold ${
                  preCheckReport.riskLevel === 'LOW'
                    ? 'text-emerald-400'
                    : preCheckReport.riskLevel === 'MEDIUM'
                      ? 'text-yellow-400'
                      : 'text-rose-400'
                }`}
              >
                {preCheckReport.riskLevel}
              </h4>
            </div>
            <div className="text-right">
              <p className="text-sm text-dark-400">Skor Kesehatan</p>
              <p className="text-lg font-mono text-dark-100">
                {100 - preCheckReport.riskScore}/100
              </p>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {preCheckReport.details.map((check, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50"
              >
                <div className="flex items-center gap-3">
                  {check.status === 'PASS' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : check.status === 'WARNING' ? (
                    <Info className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  )}
                  <span className="text-dark-200">{check.item}</span>
                </div>
                <span className="text-sm text-dark-400">{check.message}</span>
              </div>
            ))}
          </div>

          <div
            className={`p-4 rounded-xl border ${
              preCheckReport.riskLevel === 'HIGH'
                ? 'bg-rose-500/10 border-rose-500/50'
                : preCheckReport.riskLevel === 'MEDIUM'
                  ? 'bg-yellow-500/10 border-yellow-500/50'
                  : 'bg-emerald-500/10 border-emerald-500/50'
            }`}
          >
            <h3 className="font-bold mb-2 flex items-center gap-2">
              Validation Report
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 text-current">
                {preCheckReport.riskLevel} CHECK
              </span>
            </h3>
            <ul className="space-y-2 text-sm text-dark-200">
              {Array.isArray(preCheckReport.flags) && preCheckReport.flags.map((flag, i) => (
                <li key={i} className="flex gap-2">
                  <span>•</span> {flag}
                </li>
              ))}
              {(!preCheckReport.flags || !Array.isArray(preCheckReport.flags) || preCheckReport.flags.length === 0) && <li>✅ Data terlihat aman.</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Emergency Request Selector */}
      {!isReadOnly && (
        <div className={`p-5 rounded-2xl border-2 transition-all duration-500 ${
          isEmergency 
            ? 'bg-amber-950/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
            : 'bg-dark-800/30 border-dark-700/50'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${isEmergency ? 'bg-amber-500 text-dark-950' : 'bg-dark-700 text-dark-400'}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`font-bold transition-colors ${isEmergency ? 'text-amber-400' : 'text-dark-200'}`}>Mode Laporan Darurat</h4>
                <p className="text-xs text-dark-400 mt-0.5">Beritahu sistem & approval bahwa ini bukan request biasa.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEmergency(!isEmergency)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isEmergency 
                  ? 'bg-amber-500 text-dark-950 hover:bg-amber-400 scale-105' 
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              {isEmergency ? 'AKTIF' : 'AKTIFKAN'}
            </button>
          </div>

          {isEmergency && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 mb-3">
                <p className="text-xs text-amber-200/80 leading-relaxed italic">
                  "Status emergency akan memberikan sinyal urgensi tinggi pada antrian approval. 
                  Pastikan alasan yang diberikan valid dan sesuai kenyataan."
                </p>
              </div>
              <textarea
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="w-full bg-dark-900/50 border-amber-500/30 focus:border-amber-500 text-amber-100 placeholder-amber-900/50 text-sm rounded-xl p-3 outline-none transition-all min-h-[80px]"
                placeholder="Tuliskan alasan singkat urgensi / mengapa ini harus segera diproses..."
               />
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <label className="block text-sm font-medium text-dark-300">
          Catatan Tambahan (Opsional)
        </label>
        <textarea
          value={submitNotes}
          onChange={(e) => setSubmitNotes(e.target.value)}
          className="input-field min-h-[100px]"
          placeholder="Berikan alasan atau konteks tambahan..."
          disabled={isReadOnly}
        />
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-dark-700">
        {status === 'returned' && paketRevisi && countdown !== 'Expired' && (
          <>
            <button
              onClick={async () => {
                // Save revision
                const changes = {
                  header: headerData,
                  items: items,
                };
                await transactionAPI.saveRevision(txId, changes);
                alertModal.success('Revisi tersimpan');
              }}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Simpan Revisi'}
            </button>
            <button
              onClick={async () => {
                if (isEmergency && !emergencyReason.trim()) {
                  return alertModal.warning('Alasan emergency wajib diisi jika mode emergency aktif');
                }
                const notes = submitNotes || 'Resubmitted after revision';
                await transactionAPI.resubmit(txId, {
                  notes,
                  isEmergency,
                  emergencyReason
                });
                alertModal.success('Transaksi dikirim ulang untuk approval');
                router.push('/dashboard/admin/transactions');
              }}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Kirim Ulang'}
            </button>
          </>
        )}
        {!isReadOnly && status !== 'returned' && (
          <>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await transactionAPI.saveDraft(txId);
                  alertModal.success('Draft berhasil disimpan');
                  router.push('/dashboard/admin/transactions');
                } catch (err) {
                  console.error(err);
                  alertModal.error(err.response?.data?.message || 'Gagal menyimpan draft');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              {loading ? 'Menyimpan...' : 'Simpan & Keluar (Draft)'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 btn-primary ${preCheckReport?.riskLevel === 'HIGH' ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : preCheckReport?.riskLevel === 'HIGH' ? (
                'Submit dengan Risiko Tinggi'
              ) : (
                'Submit Transaksi'
              )}
            </button>
          </>
        )}
        {isReadOnly && status !== 'returned' && (
          <button
            onClick={() => router.push('/dashboard/admin/transactions')}
            className="btn-secondary w-full"
          >
            Kembali ke List
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Replacement Mode Warning Banner */}
      {isReplacementMode && (
        <div className="glass-card p-4 border-2 border-rose-500/50 bg-rose-500/5 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-500/20 rounded-lg shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-rose-400 text-sm uppercase tracking-wider mb-1">
                Mode Penggantian Transaksi Ditolak
              </h4>
              <p className="text-sm text-dark-200 leading-relaxed">
                Anda sedang membuat transaksi pengganti untuk transaksi yang ditolak. 
                <strong className="text-rose-300"> Anda tidak dapat keluar dari halaman ini sampai menyelesaikan semua step dan mengirim ke approval.</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Back */}
      <div className="flex items-center gap-4">
        {isReplacementMode ? (
          <div 
            className="p-2 bg-dark-800/50 rounded-full text-dark-600 cursor-not-allowed opacity-50" 
            title="Tidak dapat kembali saat mode penggantian transaksi"
          >
            <ArrowLeft className="w-6 h-6" />
          </div>
        ) : (
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-dark-800 rounded-full text-dark-400"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-dark-100">
            {isReplacementMode 
              ? '🔄 Buat Transaksi Pengganti' 
              : status === 'returned' 
                ? 'Revisi Transaksi' 
                : currentStep === 0 
                  ? 'Input Transaksi' 
                  : 'Input Transaksi Baru'}
          </h1>
          <p className="text-dark-400">
            {isReplacementMode
              ? 'Lengkapi semua step untuk menggantikan transaksi yang ditolak'
              : status === 'returned' 
                ? 'Perbaiki dan kirim ulang transaksi yang dikembalikan' 
                : 'Entry Hub & Validation'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      {currentStep !== 0 && (
        <div className="flex justify-between relative">
          <div className={`absolute top-1/2 left-0 w-full h-1 -z-10 -translate-y-1/2 rounded ${
            isReplacementMode ? 'bg-rose-800' : 'bg-dark-800'
          }`} />
          {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center gap-2 bg-dark-950 px-2 cursor-default"
            >
              <div
                className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                ${
                  isActive
                    ? isReplacementMode 
                      ? 'border-rose-500 bg-dark-900 text-rose-400 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]'
                      : 'border-primary-500 bg-dark-900 text-primary-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]'
                    : isCompleted
                      ? isReplacementMode
                        ? 'border-rose-500 bg-rose-500/10 text-rose-400'
                        : 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-dark-700 bg-dark-900 text-dark-600'
                }
              `}
              >
                {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isActive 
                    ? isReplacementMode ? 'text-rose-400' : 'text-primary-400' 
                    : 'text-dark-500'
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
        </div>
      )}

      {/* Content Area */}
      <div className={`glass-card p-6 md:p-8 min-h-[400px] transition-all duration-700 ${
        isEmergency && currentStep === 5 ? 'border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/20' : ''
      }`}>
        {currentStep === 0 && renderEntryHub()}
        {currentStep === 1 && renderInit()}
        {currentStep === 2 && renderHeader()}
        {currentStep === 3 && renderItems()}
        {currentStep === 4 && renderUpload()}
        {currentStep === 5 && renderValidation()}
      </div>
    </div>
  );
}
