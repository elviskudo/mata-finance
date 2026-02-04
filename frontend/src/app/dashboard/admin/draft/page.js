'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Search, Edit2, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { transactionAPI } from '@/lib/api';

export default function DraftPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);

      const response = await transactionAPI.getAll({
        status: 'draft,in_progress',
        limit: 200,
        offset: 0,
      });

      if (response?.data?.success) {
        const data = Array.isArray(response.data.data) ? response.data.data : [];
        setDrafts(data);
      } else {
        setDrafts([]);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const getTimeRemaining = (createdAt) => {
    if (!createdAt) return null;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return null;

    const now = new Date();
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    const hoursLeft = 24 - hoursDiff;
    return hoursLeft > 0 ? Math.ceil(hoursLeft) : 0;
  };

  // ✅ FIX: safe search (no toLowerCase crash)
  const filteredDrafts = useMemo(() => {
    const needle = String(searchTerm ?? '')
      .toLowerCase()
      .trim();
    return drafts.filter((draft) => {
      const code = String(draft?.code ?? '').toLowerCase();
      const type = String(draft?.type ?? '').toLowerCase();
      return code.includes(needle) || type.includes(needle);
    });
  }, [drafts, searchTerm]);

  const totalDraft = drafts.length;

  const nearDeadlineCount = useMemo(() => {
    return drafts.filter((d) => {
      const hoursLeft = getTimeRemaining(d?.createdAt);
      return hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 6;
    }).length;
  }, [drafts]);

  const todayDraftCount = useMemo(() => {
    return drafts.filter((d) => {
      if (!d?.createdAt) return false;
      const created = new Date(d.createdAt);
      if (Number.isNaN(created.getTime())) return false;

      const today = new Date();
      return created.toDateString() === today.toDateString();
    }).length;
  }, [drafts]);

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Draft</h1>
            <p className="text-dark-400">Kelola draft transaksi yang belum disubmit</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/dashboard/admin/transactions/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Buat Draft Baru
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Total Draft</p>
              <p className="text-2xl font-bold text-dark-100">{totalDraft}</p>
            </div>
            <FileText className="w-8 h-8 text-amber-400 opacity-50" />
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Mendekati Deadline</p>
              <p className="text-2xl font-bold text-rose-400">{nearDeadlineCount}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-rose-400 opacity-50" />
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Draft Baru Hari Ini</p>
              <p className="text-2xl font-bold text-primary-400">{todayDraftCount}</p>
            </div>
            <Clock className="w-8 h-8 text-primary-400 opacity-50" />
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
              placeholder="Cari draft..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>

          <button onClick={fetchDrafts} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Drafts Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : filteredDrafts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-800/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Kode</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Tipe</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Jumlah</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">
                    Waktu Tersisa
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-dark-400">Dibuat</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-dark-400">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filteredDrafts.map((draft) => {
                  const hoursLeft = getTimeRemaining(draft?.createdAt);

                  return (
                    <tr key={draft.id} className="table-row">
                      <td className="py-4 px-6">
                        <span className="font-medium text-dark-100">{draft?.code ?? '-'}</span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="capitalize text-dark-300">
                          {String(draft?.type ?? '-')}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-medium text-dark-100">
                          {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: draft?.currency || 'IDR',
                            minimumFractionDigits: 0,
                          }).format(Number(draft?.amount ?? 0))}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <StatusBadge status={String(draft?.status ?? '')} />
                      </td>

                      <td className="py-4 px-6">
                        {hoursLeft !== null ? (
                          hoursLeft > 0 ? (
                            <span
                              className={`flex items-center gap-1 ${
                                hoursLeft <= 6 ? 'text-rose-400 font-semibold' : 'text-dark-300'
                              }`}
                            >
                              <Clock className="w-4 h-4" />
                              {hoursLeft} jam
                            </span>
                          ) : (
                            <span className="text-rose-400 font-semibold">Kadaluarsa</span>
                          )
                        ) : (
                          <span className="text-dark-400">-</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-dark-400 text-sm">
                        {draft?.createdAt
                          ? new Date(draft.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              router.push(`/dashboard/admin/transactions/new?id=${draft.id}`)
                            }
                            className="p-2 text-dark-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                            title="Lanjutkan Edit"
                          >
                            <Edit2 className="w-4 h-4" />
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
            <FileText className="w-16 h-16 mx-auto text-dark-600 mb-4" />
            <h3 className="text-lg font-medium text-dark-300 mb-2">Tidak Ada Draft</h3>
            <p className="text-dark-500 mb-6">Mulai dengan membuat draft transaksi baru</p>
            <button
              onClick={() => router.push('/dashboard/admin/transactions/new')}
              className="btn-primary"
            >
              Buat Draft Pertama
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status ?? '').toLowerCase();

  const classes = {
    in_progress: 'badge-neutral border border-dashed border-dark-400 text-dark-400',
    draft: 'badge-neutral',
  };

  const labels = {
    in_progress: 'Sedang Diedit',
    draft: 'Draft',
  };

  return (
    <span className={classes[normalized] || 'badge-neutral'}>
      {labels[normalized] || normalized || '-'}
    </span>
  );
}
