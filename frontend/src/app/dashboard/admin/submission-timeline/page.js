'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Eye,
  X,
  Edit,
} from 'lucide-react';
import { transactionAPI } from '@/lib/api';

export default function SubmissionTimelinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);

      const response = await transactionAPI.getAll({
        limit: 200,
        offset: 0,
      });

      if (response?.data?.success) {
        let data = Array.isArray(response.data.data) ? response.data.data : [];

        // ✅ Sort by submitted date or created date (newest first)
        data.sort((a, b) => {
          const dateA = new Date(a?.submittedAt || a?.createdAt || 0).getTime();
          const dateB = new Date(b?.submittedAt || b?.createdAt || 0).getTime();
          return dateB - dateA;
        });

        setTransactions(data);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    const needle = String(searchTerm ?? '')
      .toLowerCase()
      .trim();

    return transactions.filter((tx) => {
      const code = String(tx?.code ?? '').toLowerCase();
      const type = String(tx?.type ?? '').toLowerCase();
      const status = String(tx?.status ?? '').toLowerCase();

      const matchesSearch = code.includes(needle) || type.includes(needle);

      if (filterStatus === 'all') return matchesSearch;
      return matchesSearch && status === filterStatus;
    });
  }, [transactions, searchTerm, filterStatus]);

  const getStatusIcon = (status) => {
    const s = String(status ?? '').toLowerCase();

    if (['approved', 'completed'].includes(s)) {
      return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
    if (['rejected', 'returned'].includes(s)) {
      return <XCircle className="w-5 h-5 text-rose-400" />;
    }
    if (['submitted', 'under_review'].includes(s)) {
      return <Clock className="w-5 h-5 text-amber-400" />;
    }
    return <Send className="w-5 h-5 text-primary-400" />;
  };

  const getStatusColor = (status) => {
    const s = String(status ?? '').toLowerCase();

    if (['approved', 'completed'].includes(s)) {
      return 'border-emerald-500/50 bg-emerald-500/10';
    }
    if (['rejected', 'returned'].includes(s)) {
      return 'border-rose-500/50 bg-rose-500/10';
    }
    if (['submitted', 'under_review'].includes(s)) {
      return 'border-amber-500/50 bg-amber-500/10';
    }
    return 'border-primary-500/50 bg-primary-500/10';
  };

  const getTimeAgo = (date) => {
    if (!date) return '-';
    const past = new Date(date);
    if (Number.isNaN(past.getTime())) return '-';

    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;

    return past.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSlaCountdown = (slaDueAt) => {
    if (!slaDueAt) return '-';
    const due = new Date(slaDueAt);
    if (Number.isNaN(due.getTime())) return '-';

    const now = new Date();
    const diffMs = due.getTime() - now.getTime();

    if (diffMs <= 0) {
      const overdueMs = now.getTime() - due.getTime();
      const overdueMins = Math.floor(overdueMs / 60000);
      const overdueHours = Math.floor(overdueMs / 3600000);
      const overdueDays = Math.floor(overdueMs / 86400000);

      if (overdueMins < 60) return `Overdue ${overdueMins} menit`;
      if (overdueHours < 24) return `Overdue ${overdueHours} jam`;
      return `Overdue ${overdueDays} hari`;
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} menit tersisa`;
    if (diffHours < 24) return `${diffHours} jam tersisa`;
    if (diffDays < 7) return `${diffDays} hari tersisa`;

    return due.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const statusCounts = useMemo(() => {
    const list = transactions;

    const countStatus = (s) =>
      list.filter((t) => String(t?.status ?? '').toLowerCase() === s).length;

    return {
      all: list.length,
      submitted: countStatus('submitted'),
      under_review: countStatus('under_review'),
      approved: list.filter((t) =>
        ['approved', 'completed'].includes(String(t?.status ?? '').toLowerCase()),
      ).length,
      rejected: list.filter((t) =>
        ['rejected', 'returned'].includes(String(t?.status ?? '').toLowerCase()),
      ).length,
    };
  }, [transactions]);

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-500/10 rounded-xl text-primary-400">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Submission Timeline</h1>
            <p className="text-dark-400">Timeline dan status semua submission transaksi</p>
          </div>
        </div>

        <button onClick={fetchTransactions} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-dark-700 pb-4">
        {Object.entries({
          all: 'Semua',
          submitted: 'Submitted',
          under_review: 'Under Review',
          approved: 'Approved',
          rejected: 'Rejected',
        }).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === key
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
            }`}
          >
            {label} ({statusCounts[key] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
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
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <div key={tx.id} className={`glass-card p-6 border-l-4 ${getStatusColor(tx?.status)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">{getStatusIcon(tx?.status)}</div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-dark-100">{tx?.code ?? '-'}</h3>
                      <StatusBadge status={String(tx?.status ?? '')} />
                    </div>

                    <p className="text-sm text-dark-300 mb-2 capitalize">
                      {String(tx?.type ?? '-')} • {tx?.recipientName || '-'}
                    </p>

                    <p className="text-lg font-semibold text-dark-100 mb-3">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: tx?.currency || 'IDR',
                        minimumFractionDigits: 0,
                      }).format(Number(tx?.amount ?? 0))}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-dark-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Submitted: {getTimeAgo(tx?.submittedAt || tx?.createdAt)}
                      </span>

                      {tx?.updatedAt && tx.updatedAt !== tx.createdAt && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Updated: {getTimeAgo(tx?.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    try {
                      setLoadingTimeline(true);
                      setSelectedTx(tx);
                      setShowTimelineModal(true);

                      const response = await transactionAPI.getTimeline(tx.id);
                      if (response?.data?.success) {
                        setTimeline(response.data.data);
                      }
                    } catch (error) {
                      console.error('Error fetching timeline:', error);
                    } finally {
                      setLoadingTimeline(false);
                    }
                  }}
                  className="p-2 text-dark-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                  title="Lihat Timeline"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-16 glass-card">
            <Clock className="w-16 h-16 mx-auto text-dark-600 mb-4" />
            <h3 className="text-lg font-medium text-dark-300 mb-2">Tidak Ada Submission</h3>
            <p className="text-dark-500">Belum ada transaksi yang disubmit</p>
          </div>
        )}
      </div>

      {/* Timeline Modal */}
      {showTimelineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-dark-700">
              <div>
                <h3 className="text-xl font-bold text-dark-100">Timeline Transaksi</h3>
                <p className="text-dark-400">{selectedTx?.code}</p>
              </div>
              <button
                onClick={() => setShowTimelineModal(false)}
                className="p-2 text-dark-400 hover:text-dark-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingTimeline ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner"></div>
                </div>
              ) : (
                <>
                  {/* SLA Info */}
                  {selectedTx?.slaDueAt && (
                    <div className="mb-6 p-4 bg-dark-700/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-dark-300">SLA Deadline:</span>
                        <span className="font-medium text-dark-100">
                          {getSlaCountdown(selectedTx.slaDueAt)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="space-y-4">
                    {timeline.map((event, index) => {
                      // Determine event color based on action type
                      const getEventColor = (eventName) => {
                        const name = String(eventName ?? '').toUpperCase();
                        if (name.includes('APPROVE')) return 'bg-emerald-400';
                        if (name.includes('REJECT') || name.includes('RETURN')) return 'bg-rose-400';
                        if (name.includes('SUBMIT') || name.includes('RESUBMIT')) return 'bg-primary-400';
                        if (name.includes('CREATE')) return 'bg-sky-400';
                        return 'bg-dark-400';
                      };

                      // Format event name for display
                      const formatEventName = (eventName) => {
                        const name = String(eventName ?? '');
                        const nameUpper = name.toUpperCase();
                        if (nameUpper.includes('APPROVE')) return 'Disetujui';
                        if (nameUpper.includes('REJECT')) return 'Dikembalikan';
                        if (nameUpper.includes('SUBMIT') && !nameUpper.includes('RESUBMIT')) return 'Dikirim';
                        if (nameUpper.includes('RESUBMIT')) return 'Dikirim Ulang';
                        if (nameUpper.includes('CREATE')) return 'Dibuat';
                        if (nameUpper.includes('REVIEW')) return 'Ditinjau';
                        if (nameUpper.includes('COMPLETE')) return 'Selesai';
                        return name;
                      };

                      return (
                        <div key={index} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 ${getEventColor(event.event)} rounded-full`}></div>
                            {index < timeline.length - 1 && (
                              <div className="w-px h-16 bg-dark-600"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-medium text-dark-100">{formatEventName(event.event)}</h4>
                              <span className="text-xs text-dark-400">
                                {new Date(event.timestamp).toLocaleString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-dark-300">{event.details}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons based on Status */}
                  <div className="mt-8 pt-6 border-t border-dark-700">
                    {String(selectedTx?.status ?? '').toLowerCase() === 'returned' && (
                      <button
                        onClick={() => {
                          setShowTimelineModal(false);
                          router.push('/dashboard/admin/revision');
                        }}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Buka Draft & Revisi
                      </button>
                    )}
                    {String(selectedTx?.status ?? '').toLowerCase() === 'needs_clarification' && (
                      <button
                        onClick={() => {
                          setShowTimelineModal(false);
                          router.push('/dashboard/admin/revision');
                        }}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Buka Draft & Revisi
                      </button>
                    )}
                    {String(selectedTx?.status ?? '').toLowerCase() === 'closed_needs_accounting_resolution' && (
                      <div className="text-center py-4">
                        <p className="text-dark-400">Ditutup – Ditangani Accounting</p>
                      </div>
                    )}
                    {['submitted', 'under_review', 'approved', 'rejected'].includes(String(selectedTx?.status ?? '').toLowerCase()) && (
                      <div className="text-center py-4">
                        <p className="text-dark-400">Read-only</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status ?? '').toLowerCase();

  const classes = {
    submitted: 'badge-info',
    under_review: 'badge-warning',
    approved: 'badge-success',
    completed: 'badge-success',
    rejected: 'badge-danger',
    returned: 'badge-warning',
  };

  const labels = {
    submitted: 'Dikirim',
    under_review: 'Ditinjau',
    approved: 'Disetujui',
    completed: 'Selesai',
    rejected: 'Ditolak',
    returned: 'Dikembalikan',
  };

  return (
    <span className={classes[normalized] || 'badge-neutral'}>
      {labels[normalized] || normalized || '-'}
    </span>
  );
}
