'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Search, Eye, X, RefreshCw, ArrowRight } from 'lucide-react';
import { transactionAPI } from '@/lib/api';

export default function TransactionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('drafts'); // 'drafts' | 'all'
  const [transactions, setTransactions] = useState([]);
  const [meta, setMeta] = useState({ total: 0, limit: 100, offset: 0 });
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Reset paging & filters when tab changes
  useEffect(() => {
    setMeta((prev) => ({ ...prev, offset: 0 }));
    setFilters({ status: '', type: '' });
    setSearchTerm('');
  }, [activeTab]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);

      const response = await transactionAPI.getAll({
        ...filters,
        limit: meta.limit,
        offset: meta.offset,
      });

      if (response?.data?.success) {
        let data = Array.isArray(response.data.data) ? response.data.data : [];

        // Client-side tab filtering
        const draftStatuses = new Set(['in_progress', 'draft', 'returned']);
        if (activeTab === 'drafts') {
          data = data.filter((t) => draftStatuses.has(String(t?.status ?? '')));
        } else {
          data = data.filter((t) => !draftStatuses.has(String(t?.status ?? '')));
        }

        setTransactions(data);

        // Keep meta from backend (note: could be imperfect due to client-side filtering)
        setMeta((prev) => ({
          ...prev,
          total: Number(response.data?.meta?.total ?? data.length ?? 0),
          limit: Number(prev?.limit ?? 100),
          offset: Number(prev?.offset ?? 0),
        }));
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.type, meta.limit, meta.offset, activeTab]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleViewDetail = useCallback(async (id) => {
    try {
      const response = await transactionAPI.getById(id);
      if (response?.data?.success) {
        setSelectedTransaction(response.data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
    }
  }, []);

  // ✅ FIX: safe search dengan useMemo untuk menghindari re-render yang tidak perlu
  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];

    const needle = String(searchTerm ?? '')
      .toLowerCase()
      .trim();

    return transactions.filter((tx) => {
      if (!tx) return false;
      const code = String(tx?.code ?? '').toLowerCase();
      const type = String(tx?.type ?? '').toLowerCase();
      return code.includes(needle) || type.includes(needle);
    });
  }, [transactions, searchTerm]);

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Transaksi</h1>
          <p className="text-dark-400">Kelola transaksi keuangan Anda</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/admin/transactions/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Buat Transaksi Baru
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700">
        <button
          onClick={() => setActiveTab('drafts')}
          className={`pb-3 px-6 text-sm font-medium transition-colors relative ${
            activeTab === 'drafts' ? 'text-primary-400' : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          Draft &amp; Input
          {activeTab === 'drafts' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-6 text-sm font-medium transition-colors relative ${
            activeTab === 'all' ? 'text-primary-400' : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          Riwayat Transaksi
          {activeTab === 'all' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full" />
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>

          <button onClick={fetchTransactions} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-800/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">
                    Kode Transaksi
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Tipe</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Jumlah</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">
                    Penerima
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Tanggal</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-dark-400">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions
                  .filter((tx) => tx && tx.id)
                  .map((tx) => (
                    <tr key={tx.id} className="table-row">
                      <td className="py-4 px-6">
                        <span className="font-medium text-dark-100">{tx.code ?? '-'}</span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="capitalize text-dark-300">{String(tx.type ?? '-')}</span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-medium text-dark-100">
                          {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: tx.currency || 'IDR',
                            minimumFractionDigits: 0,
                          }).format(Number(tx.amount ?? 0))}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-dark-300">{tx.recipientName || '-'}</td>

                      <td className="py-4 px-6">
                        <StatusBadge status={String(tx.status ?? '')} />
                      </td>

                      <td className="py-4 px-6 text-dark-400 text-sm">
                        {tx?.createdAt
                          ? (() => {
                              try {
                                const date = new Date(tx.createdAt);
                                if (Number.isNaN(date.getTime())) return '-';
                                return date.toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                });
                              } catch (e) {
                                return '-';
                              }
                            })()
                          : '-'}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {['in_progress', 'returned', 'draft'].includes(
                            String(tx.status ?? ''),
                          ) ? (
                            <button
                              onClick={() => router.push(`/dashboard/admin/transactions/new?id=${tx.id}`)}
                              className="p-2 text-dark-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Lanjutkan Input"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleViewDetail(tx.id)}
                              className="p-2 text-dark-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto text-dark-600 mb-4" />
            <h3 className="text-lg font-medium text-dark-300 mb-2">Tidak Ada Transaksi</h3>
            <p className="text-dark-500 mb-6">Mulai dengan membuat transaksi baru</p>
            <button
              onClick={() => router.push('/dashboard/admin/transactions/new')}
              className="btn-primary"
            >
              Buat Transaksi Pertama
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {Number(meta?.total ?? 0) > Number(meta?.limit ?? 0) && (
        <div className="flex items-center justify-between">
          <p className="text-dark-400 text-sm">
            Menampilkan {Number(meta?.offset ?? 0) + 1} -{' '}
            {Math.min(
              Number(meta?.offset ?? 0) + Number(meta?.limit ?? 0),
              Number(meta?.total ?? 0),
            )}{' '}
            dari {Number(meta?.total ?? 0)}
          </p>
          <div className="flex gap-2">
            <button
              disabled={Number(meta?.offset ?? 0) === 0}
              onClick={() =>
                setMeta((prev) => ({
                  ...prev,
                  offset: Math.max(0, Number(prev?.offset ?? 0) - Number(prev?.limit ?? 0)),
                }))
              }
              className="btn-secondary disabled:opacity-50"
            >
              Sebelumnya
            </button>

            <button
              disabled={
                Number(meta?.offset ?? 0) + Number(meta?.limit ?? 0) >= Number(meta?.total ?? 0)
              }
              onClick={() =>
                setMeta((prev) => ({
                  ...prev,
                  offset: Number(prev?.offset ?? 0) + Number(prev?.limit ?? 0),
                }))
              }
              className="btn-secondary disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTransaction(null);
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status ?? '').toLowerCase();

  const classes = {
    in_progress: 'badge-neutral border border-dashed border-dark-400 text-dark-400',
    returned: 'badge-warning',
    draft: 'badge-neutral',
    submitted: 'badge-info',
    under_review: 'badge-warning',
    approved: 'badge-success',
    completed: 'badge-success',
    rejected: 'badge-danger',
  };

  const labels = {
    in_progress: 'Menu Input',
    returned: 'Dikembalikan',
    draft: 'Draft',
    submitted: 'Dikirim',
    under_review: 'Ditinjau',
    approved: 'Disetujui',
    completed: 'Selesai',
    rejected: 'Ditolak',
  };

  return (
    <span className={classes[normalized] || 'badge-neutral'}>
      {labels[normalized] || normalized || '-'}
    </span>
  );
}

function TransactionDetailModal({ transaction, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card w-full max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-dark-100">Detail Transaksi</h2>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <DetailRow label="Kode Transaksi" value={transaction?.code ?? '-'} />
          <DetailRow label="Tipe" value={String(transaction?.type ?? '-')} capitalize />
          <DetailRow
            label="Jumlah"
            value={new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: transaction?.currency || 'IDR',
              minimumFractionDigits: 0,
            }).format(Number(transaction?.amount ?? 0))}
          />
          <DetailRow label="Penerima" value={transaction?.recipientName || '-'} />
          <DetailRow label="Notes User" value={transaction?.notes || '-'} />
          <DetailRow
            label="Status"
            value={<StatusBadge status={String(transaction?.status ?? '')} />}
          />

          {transaction?.risk_level && (
            <DetailRow
              label="Risk Assessment"
              value={
                <span
                  className={
                    transaction.risk_level === 'HIGH'
                      ? 'text-rose-400 font-bold'
                      : transaction.risk_level === 'MEDIUM'
                        ? 'text-yellow-400'
                        : 'text-emerald-400'
                  }
                >
                  {String(transaction.risk_level)}
                </span>
              }
            />
          )}

          <DetailRow
            label="Dibuat"
            value={
              transaction?.createdAt
                ? (() => {
                    try {
                      const date = new Date(transaction.createdAt);
                      if (Number.isNaN(date.getTime())) return '-';
                      return date.toLocaleString('id-ID');
                    } catch (e) {
                      return '-';
                    }
                  })()
                : '-'
            }
          />
        </div>

        {Array.isArray(transaction?.items) && transaction.items.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold text-dark-200 mb-2">Detail Items</h4>
            <div className="bg-dark-800/50 rounded-lg p-3 space-y-2">
              {transaction.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-dark-300">
                    {String(item?.description ?? '-')} (x{Number(item?.quantity ?? 0)})
                  </span>
                  <span className="text-dark-100">
                    {Number(item?.total_amount ?? 0).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary w-full">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, capitalize }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-dark-700/50">
      <span className="text-dark-400">{label}</span>
      <span className={`text-dark-100 font-medium ${capitalize ? 'capitalize' : ''}`}>{value}</span>
    </div>
  );
}
