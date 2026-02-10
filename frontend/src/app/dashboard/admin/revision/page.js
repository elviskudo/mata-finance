'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Edit3,
  Search,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Clock,
  MessageSquare,
  X,
  Save,
  Send,
  Lock,
  Unlock,
  Timer,
  FileText,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { transactionAPI } from '@/lib/api';
import { useAlertModal } from '@/components/AlertModal';

export default function RevisionPage() {
  const router = useRouter();
  const alertModal = useAlertModal();

  const [loading, setLoading] = useState(true);
  const [revisions, setRevisions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal untuk detail revisi
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [revisionDetails, setRevisionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  // Form state untuk edit
  const [editForm, setEditForm] = useState({});
  const [editItems, setEditItems] = useState([]);
  const [resubmitNotes, setResubmitNotes] = useState('');

  // Countdown timer
  const [countdown, setCountdown] = useState(null);

  const fetchRevisions = useCallback(async () => {
    try {
      setLoading(true);

      const response = await transactionAPI.getAll({
        limit: 200,
        offset: 0,
      });

      if (response?.data?.success) {
        let data = Array.isArray(response.data.data) ? response.data.data : [];

        // Filter status 'returned' dan 'closed_needs_accounting_resolution'
        data = data.filter((t) => {
          const status = String(t?.status ?? '').toLowerCase();
          return ['returned', 'closed_needs_accounting_resolution'].includes(status);
        });

        setRevisions(data);
      } else {
        setRevisions([]);
      }
    } catch (error) {
      console.error('Error fetching revisions:', error);
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  // Fetch revision details when modal opens
  const fetchRevisionDetails = useCallback(async (txId) => {
    try {
      setLoadingDetails(true);
      const response = await transactionAPI.getRevisionDetails(txId);

      if (response?.data?.success) {
        const details = response.data.data;
        setRevisionDetails(details);

        // Initialize form with current data
        setEditForm({
          vendorName: details.recipientName || '',
          invoiceDate: details.dueDate ? details.dueDate.split('T')[0] : '',
          invoiceNumber: details.invoiceNumber || '',
          description: details.description || '',
          amount: details.amount || 0,
        });

        setEditItems(details.items || []);
      }
    } catch (error) {
      console.error('Error fetching revision details:', error);
      alertModal.error(error.response?.data?.message || 'Gagal memuat detail revisi');
      setSelectedRevision(null);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Open revision modal
  const openRevisionModal = (revision) => {
    setSelectedRevision(revision);
    setResubmitNotes('');
    fetchRevisionDetails(revision.id);
  };

  // Close modal
  const closeModal = () => {
    setSelectedRevision(null);
    setRevisionDetails(null);
    setEditForm({});
    setEditItems([]);
    setResubmitNotes('');
    setCountdown(null);
  };

  // Countdown timer effect
  useEffect(() => {
    if (!revisionDetails?.paketRevisi?.deadline) {
      setCountdown(null);
      return;
    }

    const deadline = new Date(revisionDetails.paketRevisi.deadline);

    const updateCountdown = () => {
      const now = new Date();
      const diff = deadline - now;

      if (diff <= 0) {
        setCountdown({ expired: true, text: 'Deadline terlewati' });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({
        expired: false,
        days,
        hours,
        minutes,
        seconds,
        text: `${days}h ${hours}j ${minutes}m ${seconds}d`,
        urgent: diff < 24 * 60 * 60 * 1000, // Less than 24 hours
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [revisionDetails?.paketRevisi?.deadline]);

  // Check if field is editable
  const isFieldEditable = (field) => {
    if (!revisionDetails?.paketRevisi?.editableFields) return false;
    if (countdown?.expired) return false;
    if (revisionDetails?.status === 'closed_needs_accounting_resolution') return false;

    const editableFields = revisionDetails.paketRevisi.editableFields;

    // Map form fields to allowlist categories
    const fieldMapping = {
      vendorName: 'header',
      invoiceDate: 'header',
      invoiceNumber: 'header',
      description: 'header',
      amount: 'header',
      items: 'items',
      documents: 'documents',
    };

    return editableFields.includes(fieldMapping[field] || field);
  };

  // Handle save revision
  const handleSaveRevision = async () => {
    if (countdown?.expired) {
      alertModal.warning('Deadline telah terlewati. Anda tidak dapat menyimpan perubahan.');
      return;
    }

    try {
      setSaving(true);

      const changes = {};

      // Only include header if editable
      if (isFieldEditable('vendorName')) {
        changes.header = {
          vendorName: editForm.vendorName,
          invoiceDate: editForm.invoiceDate,
          invoiceNumber: editForm.invoiceNumber,
          description: editForm.description,
          amount: parseFloat(editForm.amount) || 0,
        };
      }

      // Only include items if editable
      if (isFieldEditable('items') && editItems.length > 0) {
        changes.items = editItems.map((item) => ({
          description: item.description,
          accountCode: item.accountCode,
          quantity: item.quantity,
          price: item.price || item.unit_price,
        }));
      }

      const response = await transactionAPI.saveRevision(selectedRevision.id, changes);

      if (response?.data?.success) {
        alertModal.success('Revisi berhasil disimpan');
        // Refresh details
        await fetchRevisionDetails(selectedRevision.id);
      }
    } catch (error) {
      console.error('Save revision error:', error);
      alertModal.error(error.response?.data?.message || 'Gagal menyimpan revisi');
    } finally {
      setSaving(false);
    }
  };

  // Handle resubmit
  const handleResubmit = async () => {
    if (countdown?.expired) {
      alertModal.warning('Deadline telah terlewati. Anda tidak dapat mengirim ulang transaksi.');
      return;
    }

    const confirmed = await alertModal.confirm('Apakah Anda yakin ingin mengirim ulang transaksi ini? Transaksi akan dikunci dan masuk ke antrian approval.', 'Konfirmasi Kirim Ulang');
    if (!confirmed) {
      return;
    }

    try {
      setResubmitting(true);

      const response = await transactionAPI.resubmit(selectedRevision.id, { notes: resubmitNotes });

      if (response?.data?.success) {
        alertModal.success('Transaksi berhasil dikirim ulang');
        closeModal();
        fetchRevisions();
      }
    } catch (error) {
      console.error('Resubmit error:', error);
      alertModal.error(error.response?.data?.message || 'Gagal mengirim ulang transaksi');
    } finally {
      setResubmitting(false);
    }
  };

  // Handle item change
  const handleItemChange = (index, field, value) => {
    if (!isFieldEditable('items')) return;

    const newItems = [...editItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditItems(newItems);
  };

  // Add new item
  const addNewItem = () => {
    if (!isFieldEditable('items')) return;

    setEditItems([
      ...editItems,
      { description: '', accountCode: '', quantity: 1, price: 0 },
    ]);
  };

  // Remove item
  const removeItem = (index) => {
    if (!isFieldEditable('items')) return;

    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const getDaysPending = (updatedAt) => {
    if (!updatedAt) return null;
    const updated = new Date(updatedAt);
    if (Number.isNaN(updated.getTime())) return null;

    const now = new Date();
    const daysDiff = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  // Get deadline status
  const getDeadlineStatus = (revision) => {
    // We need to check if there's an expired_at field
    // For now, we calculate from updatedAt + 2 days default
    const deadline = revision.expiredAt || revision.expired_at;
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diff = deadlineDate - now;

    if (diff <= 0) return { text: 'Deadline terlewati', expired: true };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return { text: `${hours} jam tersisa`, urgent: true };

    const days = Math.floor(hours / 24);
    return { text: `${days} hari tersisa`, urgent: false };
  };

  const filteredRevisions = useMemo(() => {
    const needle = String(searchTerm ?? '')
      .toLowerCase()
      .trim();

    return revisions.filter((revision) => {
      const code = String(revision?.code ?? '').toLowerCase();
      const type = String(revision?.type ?? '').toLowerCase();
      return code.includes(needle) || type.includes(needle);
    });
  }, [revisions, searchTerm]);

  const totalRevisi = revisions.length;

  const tertundaLebih2Hari = useMemo(() => {
    return revisions.filter((r) => {
      const days = getDaysPending(r?.updatedAt || r?.createdAt);
      return days !== null && days > 2;
    }).length;
  }, [revisions]);

  const butuhPerhatian = useMemo(() => {
    return revisions.filter((r) => {
      const days = getDaysPending(r?.updatedAt || r?.createdAt);
      return days !== null && days > 1;
    }).length;
  }, [revisions]);

  const deadlineExpired = useMemo(() => {
    return revisions.filter((r) => {
      const status = getDeadlineStatus(r);
      return status?.expired;
    }).length;
  }, [revisions]);

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
            <Edit3 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Revisi Transaksi</h1>
            <p className="text-dark-400">Transaksi yang dikembalikan untuk diperbaiki</p>
          </div>
        </div>

        <button onClick={fetchRevisions} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Total Revisi</p>
              <p className="text-2xl font-bold text-dark-100">{totalRevisi}</p>
            </div>
            <Edit3 className="w-8 h-8 text-rose-400 opacity-50" />
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Tertunda &gt; 2 Hari</p>
              <p className="text-2xl font-bold text-rose-400">{tertundaLebih2Hari}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-rose-400 opacity-50" />
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Butuh Perhatian</p>
              <p className="text-2xl font-bold text-amber-400">{butuhPerhatian}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-400 opacity-50" />
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Deadline Terlewati</p>
              <p className="text-2xl font-bold text-red-500">{deadlineExpired}</p>
            </div>
            <Timer className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <input
              type="text"
              placeholder="Cari transaksi revisi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : filteredRevisions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-800/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Kode</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Tipe</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Jumlah</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">
                    Deadline
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">
                    Revisi Ke
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-dark-400">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filteredRevisions.map((revision) => {
                  const deadlineStatus = getDeadlineStatus(revision);

                  return (
                    <tr key={revision.id} className="table-row">
                      <td className="py-4 px-6">
                        <span className="font-medium text-dark-100">{revision?.code ?? '-'}</span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="capitalize text-dark-300">
                          {String(revision?.type ?? '-')}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-medium text-dark-100">
                          {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: revision?.currency || 'IDR',
                            minimumFractionDigits: 0,
                          }).format(Number(revision?.amount ?? 0))}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <StatusBadge status={String(revision?.status ?? '')} />
                      </td>

                      <td className="py-4 px-6">
                        {deadlineStatus ? (
                          <span
                            className={`flex items-center gap-1 text-sm ${
                              deadlineStatus.expired
                                ? 'text-red-500 font-semibold'
                                : deadlineStatus.urgent
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-dark-300'
                            }`}
                          >
                            <Timer className="w-4 h-4" />
                            {deadlineStatus.text}
                          </span>
                        ) : (
                          <span className="text-dark-400 text-sm">-</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <span className="badge-neutral">
                          #{revision?.revisionCount || revision?.revision_count || 1}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openRevisionModal(revision)}
                            className={`${
                              revision.status === 'closed_needs_accounting_resolution'
                                ? 'btn-secondary'
                                : 'btn-primary'
                            } text-sm py-2 px-4 flex items-center gap-2`}
                          >
                            {revision.status === 'closed_needs_accounting_resolution' ? (
                              <>
                                <FileText className="w-4 h-4" />
                                Lihat Detail
                              </>
                            ) : (
                              <>
                                <Edit3 className="w-4 h-4" />
                                Revisi
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <Edit3 className="w-16 h-16 mx-auto text-dark-600 mb-4" />
            <h3 className="text-lg font-medium text-dark-300 mb-2">Tidak Ada Revisi</h3>
            <p className="text-dark-500">Semua transaksi sudah dalam kondisi baik</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      {filteredRevisions.length > 0 && (
        <div className="glass-card p-6 border-l-4 border-l-amber-500">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-400 mb-2">Tips Menangani Revisi</h4>
              <ul className="text-sm text-dark-300 space-y-1 list-disc pl-5">
                <li>Perhatikan deadline revisi - transaksi yang lewat deadline akan otomatis ditutup</li>
                <li>Hanya field yang ditandai dapat diedit sesuai catatan approver</li>
                <li>Simpan perubahan sebelum mengirim ulang</li>
                <li>Transaksi yang dikirim ulang akan kembali ke antrian approval</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {selectedRevision && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-dark-800/95 backdrop-blur-md p-6 border-b border-dark-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <Edit3 className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-dark-100">
                    Revisi Transaksi {selectedRevision.code}
                  </h2>
                  <p className="text-sm text-dark-400">
                    Revisi ke-{revisionDetails?.paketRevisi?.revisionCount || 1}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-dark-400" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex items-center justify-center py-20">
                <div className="spinner"></div>
              </div>
            ) : revisionDetails ? (
              <div className="p-6 space-y-6">
                {/* Status Message */}
                {revisionDetails?.status === 'closed_needs_accounting_resolution' ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <div>
                      <p className="font-semibold text-red-400">Transaksi Ditutup & Dieskalasi</p>
                      <p className="text-sm text-dark-400">
                        Pengerjaan revisi telah melewati deadline. Transaksi ini sekarang memerlukan resolusi dari tim Accounting.
                      </p>
                    </div>
                  </div>
                ) : countdown && (
                  <div
                    className={`p-4 rounded-xl flex items-center justify-between ${
                      countdown.expired
                        ? 'bg-red-500/10 border border-red-500/30'
                        : countdown.urgent
                          ? 'bg-amber-500/10 border border-amber-500/30'
                          : 'bg-primary-500/10 border border-primary-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Timer
                        className={`w-6 h-6 ${
                          countdown.expired
                            ? 'text-red-400'
                            : countdown.urgent
                              ? 'text-amber-400'
                              : 'text-primary-400'
                        }`}
                      />
                      <div>
                        <p
                          className={`font-semibold ${
                            countdown.expired
                              ? 'text-red-400'
                              : countdown.urgent
                                ? 'text-amber-400'
                                : 'text-primary-400'
                          }`}
                        >
                          {countdown.expired ? 'Deadline Terlewati' : 'Sisa Waktu Revisi'}
                        </p>
                        <p className="text-sm text-dark-400">
                          {countdown.expired
                            ? 'Anda tidak dapat lagi mengedit atau mengirim ulang transaksi ini'
                            : 'Segera selesaikan revisi sebelum deadline'}
                        </p>
                      </div>
                    </div>
                    {!countdown.expired && (
                      <div className="text-right">
                        <p
                          className={`text-2xl font-bold ${
                            countdown.urgent ? 'text-amber-400' : 'text-primary-400'
                          }`}
                        >
                          {countdown.text}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable Fields Info */}
                <div className="p-4 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-primary-400" />
                    <h3 className="font-semibold text-dark-100">Field yang Dapat Diedit</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {revisionDetails.paketRevisi?.editableFields?.map((field) => (
                      <span key={field} className="badge-primary capitalize">
                        {field === 'header' ? 'Data Utama' : field === 'items' ? 'Item' : field}
                      </span>
                    )) || <span className="text-dark-400">Tidak ada field yang dapat diedit</span>}
                  </div>
                </div>

                {/* Notes from Approver */}
                {revisionDetails.notes && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-5 h-5 text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-400 mb-1">Catatan Approver</p>
                        <p className="text-dark-300">{revisionDetails.notes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Header Form */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-dark-100 flex items-center gap-2">
                    {isFieldEditable('vendorName') ? (
                      <Unlock className="w-5 h-5 text-green-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-dark-500" />
                    )}
                    Data Transaksi
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-400 mb-2">
                        Nama Vendor
                      </label>
                      <input
                        type="text"
                        value={editForm.vendorName || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, vendorName: e.target.value })
                        }
                        disabled={!isFieldEditable('vendorName')}
                        className={`input-field ${!isFieldEditable('vendorName') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-400 mb-2">
                        Tanggal Invoice
                      </label>
                      <input
                        type="date"
                        value={editForm.invoiceDate || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, invoiceDate: e.target.value })
                        }
                        disabled={!isFieldEditable('invoiceDate')}
                        className={`input-field ${!isFieldEditable('invoiceDate') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-400 mb-2">
                        Nomor Invoice
                      </label>
                      <input
                        type="text"
                        value={editForm.invoiceNumber || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, invoiceNumber: e.target.value })
                        }
                        disabled={!isFieldEditable('invoiceNumber')}
                        className={`input-field ${!isFieldEditable('invoiceNumber') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-400 mb-2">
                        Jumlah
                      </label>
                      <input
                        type="number"
                        value={editForm.amount || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, amount: e.target.value })
                        }
                        disabled={!isFieldEditable('amount')}
                        className={`input-field ${!isFieldEditable('amount') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-dark-400 mb-2">
                        Deskripsi
                      </label>
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, description: e.target.value })
                        }
                        disabled={!isFieldEditable('description')}
                        rows={3}
                        className={`input-field resize-none ${!isFieldEditable('description') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-dark-100 flex items-center gap-2">
                      {isFieldEditable('items') ? (
                        <Unlock className="w-5 h-5 text-green-400" />
                      ) : (
                        <Lock className="w-5 h-5 text-dark-500" />
                      )}
                      Item Transaksi
                    </h3>
                    {isFieldEditable('items') && (
                      <button
                        onClick={addNewItem}
                        className="btn-secondary text-sm py-1 px-3"
                      >
                        + Tambah Item
                      </button>
                    )}
                  </div>

                  {editItems.length > 0 ? (
                    <div className="space-y-3">
                      {editItems.map((item, index) => (
                        <div
                          key={index}
                          className="p-4 bg-dark-700/50 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
                        >
                          <div className="md:col-span-2">
                            <label className="block text-xs text-dark-400 mb-1">Deskripsi</label>
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) =>
                                handleItemChange(index, 'description', e.target.value)
                              }
                              disabled={!isFieldEditable('items')}
                              className={`input-field text-sm ${!isFieldEditable('items') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-dark-400 mb-1">Qty</label>
                            <input
                              type="number"
                              value={item.quantity || 1}
                              onChange={(e) =>
                                handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                              }
                              disabled={!isFieldEditable('items')}
                              className={`input-field text-sm ${!isFieldEditable('items') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-dark-400 mb-1">Harga</label>
                            <input
                              type="number"
                              value={item.price || item.unit_price || 0}
                              onChange={(e) =>
                                handleItemChange(index, 'price', parseFloat(e.target.value) || 0)
                              }
                              disabled={!isFieldEditable('items')}
                              className={`input-field text-sm ${!isFieldEditable('items') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <div>
                            {isFieldEditable('items') && (
                              <button
                                onClick={() => removeItem(index)}
                                className="btn-secondary text-sm py-2 w-full text-red-400 hover:bg-red-500/10"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-dark-400 text-center py-4">Tidak ada item</p>
                  )}
                </div>

                {/* Resubmit Notes */}
                {!countdown?.expired && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-dark-100">Catatan Resubmit (Opsional)</h3>
                    <textarea
                      value={resubmitNotes}
                      onChange={(e) => setResubmitNotes(e.target.value)}
                      placeholder="Tambahkan catatan untuk approver..."
                      rows={2}
                      className="input-field resize-none"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-dark-700">
                  {revisionDetails?.status === 'closed_needs_accounting_resolution' ? (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="w-5 h-5" />
                      <span>Transaksi ini sedang ditangani oleh tim Accounting</span>
                    </div>
                  ) : countdown?.expired ? (
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5" />
                      <span>Deadline terlewati - tidak dapat mengedit atau mengirim ulang</span>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveRevision}
                        disabled={saving || resubmitting}
                        className="btn-secondary flex items-center justify-center gap-2 flex-1"
                      >
                        {saving ? (
                          <div className="spinner-sm"></div>
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Simpan Revisi
                      </button>
                      <button
                        onClick={handleResubmit}
                        disabled={saving || resubmitting}
                        className="btn-primary flex items-center justify-center gap-2 flex-1"
                      >
                        {resubmitting ? (
                          <div className="spinner-sm"></div>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Kirim Ulang
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-dark-400">
                Gagal memuat detail revisi
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status ?? '').toLowerCase();

  const classes = {
    returned: 'badge-warning',
    rejected: 'badge-danger',
    resubmitted: 'badge-info',
    closed_needs_accounting_resolution: 'badge-danger',
  };

  const labels = {
    returned: 'Dikembalikan',
    rejected: 'Ditolak',
    resubmitted: 'Dikirim Ulang',
    closed_needs_accounting_resolution: 'Ditutup - Perlu Resolusi',
  };

  return (
    <span className={classes[normalized] || 'badge-neutral'}>
      {labels[normalized] || normalized || '-'}
    </span>
  );
}
