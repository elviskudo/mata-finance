'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Clock,
  Send,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Ban,
  ChevronRight,
  PlusCircle,
  Edit3,
  CheckCircle,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { authAPI, dashboardAPI } from '@/lib/api';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [accessDeniedVisible, setAccessDeniedVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [guardNotes, setGuardNotes] = useState([]);

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        router.push('/login');
        return;
      }

      let activeUser = null;
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          activeUser = JSON.parse(userStr);
          setUser(activeUser);
        } catch (e) {
          console.warn('Failed parsing cached user', e);
        }
      }

      // Validate session & role with backend
      const session = await authAPI.validateSession();
      if (session?.data?.data) {
        activeUser = session.data.data;
        setUser(activeUser);
        localStorage.setItem('user', JSON.stringify(activeUser));
      }

      const role = String(activeUser?.role ?? '').toLowerCase();
      
      // Only admin_finance can access this page
      if (role !== 'admin_finance' && !role.includes('finance')) {
        router.replace('/dashboard/approval');
        return;
      }

      await fetchDashboardSummary();
    } catch (err) {
      console.error('Auth/guard bootstrap error:', err);
      setError('Sesi tidak valid atau sudah berakhir.');
    } finally {
      setSessionChecked(true);
      setLoading(false);
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getSummary();
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (error) {
      setError('Gagal memuat data dashboard');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForbiddenAccess = async () => {
    try {
      await dashboardAPI.getCompanyData();
    } catch (error) {
      if (error.response?.status === 403) {
        setAccessDeniedVisible(true);
        setTimeout(() => setAccessDeniedVisible(false), 5000);
      }
    }
  };

  if (loading || !sessionChecked) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-rose-400 mb-4">{error}</p>
        <button onClick={bootstrap} className="btn-primary">
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Access Denied Toast */}
      {accessDeniedVisible && (
        <div className="fixed top-20 right-6 z-50 max-w-md glass-card p-4 border-rose-500/50 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-500/20 rounded-lg">
              <Ban className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h4 className="font-semibold text-rose-400">Akses Ditolak</h4>
              <p className="text-sm text-dark-400 mt-1">
                Anda tidak memiliki izin untuk melihat data keuangan perusahaan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-accent-500/10" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-primary-400 font-medium mb-1">Admin Finance Dashboard</p>
            <h1 className="text-2xl font-bold text-dark-100 mb-2">
              Selamat Datang, {user?.publicAlias ?? 'Admin'} 👋
            </h1>
            <p className="text-dark-400">
              <Calendar className="w-4 h-4 inline mr-2" />
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/admin/transactions/new" className="btn-primary flex items-center gap-2">
              <PlusCircle className="w-4 h-4" />
              Input Transaksi
            </Link>
            <button onClick={bootstrap} className="btn-ghost">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<FileText className="w-6 h-6" />}
          label="Transaksi Hari Ini"
          value={summary?.today?.transactionsCount || 0}
          color="primary"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Draft Tersisa"
          value={summary?.drafts?.activeCount || 0}
          color="amber"
        />
        <StatCard
          icon={<Send className="w-6 h-6" />}
          label="Menunggu Approval"
          value={summary?.pending?.count || 0}
          color="sky"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Mendekati Deadline"
          value={summary?.slaWarnings?.length || 0}
          color="rose"
          alert
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/admin/transactions/new" className="glass-card p-6 hover:border-primary-500/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-500/20 rounded-xl text-primary-400 group-hover:scale-110 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-100">Input Transaksi Baru</h3>
              <p className="text-sm text-dark-400">Buat transaksi payment/transfer</p>
            </div>
          </div>
        </Link>
        <Link href="/dashboard/admin/draft" className="glass-card p-6 hover:border-amber-500/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 group-hover:scale-110 transition-transform">
              <Edit3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-100">Draft & Revisi</h3>
              <p className="text-sm text-dark-400">{summary?.drafts?.activeCount || 0} draft menunggu</p>
            </div>
          </div>
        </Link>
        <Link href="/dashboard/admin/submission-timeline" className="glass-card p-6 hover:border-sky-500/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-500/20 rounded-xl text-sky-400 group-hover:scale-110 transition-transform">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-100">Status Pengajuan</h3>
              <p className="text-sm text-dark-400">Lacak status transaksi</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Warnings & SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Peringatan Personal
          </h3>
          <ul className="space-y-3">
            <li className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-sm text-amber-200">
              ⚠️ {summary?.drafts?.activeCount || 0} Draft aktif
            </li>
            <li className="p-3 bg-rose-500/10 rounded-lg border border-rose-500/20 text-sm text-rose-200">
              🔴 {summary?.slaWarnings?.length || 0} Mendekati deadline
            </li>
            <li className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-sm text-blue-200">
              ℹ️ {summary?.pending?.count || 0} Menunggu approval
            </li>
          </ul>
        </div>

        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-dark-100">SLA Countdown</h3>
            <span className="text-xs text-dark-400">Urutan Prioritas</span>
          </div>
          <div className="space-y-3">
            {summary?.slaWarnings?.slice(0, 3).map((item, i) => (
              <div
                key={item.id || i}
                className="flex justify-between items-center p-3 bg-dark-800/50 rounded-lg"
              >
                <div>
                  <p className="font-bold text-dark-100">{item.transactionCode || `TRX-${i + 1}`}</p>
                  <p className="text-xs text-dark-400 capitalize">{item.type || 'Payment'}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${item.status === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>
                    {item.status === 'critical' ? 'Kritis' : 'Peringatan'}
                  </p>
                  <p className="text-xs text-dark-500">
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString('id-ID') : '-'}
                  </p>
                </div>
              </div>
            ))}
            {(!summary?.slaWarnings || summary.slaWarnings.length === 0) && (
              <div className="text-center py-6 text-dark-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Tidak ada peringatan SLA</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark-100">Transaksi Terbaru</h3>
          <Link
            href="/dashboard/admin/transactions"
            className="btn-ghost text-sm flex items-center gap-1"
          >
            Lihat Semua <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700/50">
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Kode</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Tipe</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Jumlah</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {summary?.recentTransactions?.map((tx) => (
                <tr key={tx.id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                  <td className="py-3 px-4 font-medium text-dark-100">{tx.code}</td>
                  <td className="py-3 px-4 text-dark-300 capitalize">{tx.type}</td>
                  <td className="py-3 px-4 text-dark-100">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(tx.amount)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="py-3 px-4 text-dark-400 text-sm">
                    {new Date(tx.createdAt).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!summary?.recentTransactions || summary.recentTransactions.length === 0) && (
          <div className="text-center py-8 text-dark-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada transaksi</p>
          </div>
        )}
      </div>

      {/* Status Breakdown */}
      {summary?.statusBreakdown && Object.keys(summary.statusBreakdown).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(summary.statusBreakdown).map(([status, count]) => (
            <div key={status} className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-dark-100">{count}</p>
              <p className="text-sm text-dark-400 capitalize">{status.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color = 'primary', alert }) {
  const colorClasses = {
    primary: 'from-primary-500/20 to-primary-500/5 text-primary-400 border-primary-500/30',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30',
    sky: 'from-sky-500/20 to-sky-500/5 text-sky-400 border-sky-500/30',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30',
  };

  return (
    <div className={`glass-card p-6 bg-gradient-to-br ${colorClasses[color]} border`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>{icon}</div>
        {alert && value > 0 && <span className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />}
      </div>
      <p className="text-3xl font-bold text-dark-100">{value}</p>
      <p className="text-sm text-dark-400 mt-1">{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const classes = {
    draft: 'bg-dark-700 text-dark-300',
    submitted: 'bg-sky-500/20 text-sky-400',
    under_review: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-emerald-500/20 text-emerald-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-rose-500/20 text-rose-400',
    resubmitted: 'bg-purple-500/20 text-purple-400',
  };

  const labels = {
    draft: 'Draft',
    submitted: 'Dikirim',
    under_review: 'Ditinjau',
    approved: 'Disetujui',
    completed: 'Selesai',
    rejected: 'Ditolak',
    resubmitted: 'Dikirim Ulang',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes[status] || 'bg-dark-700 text-dark-400'}`}>
      {labels[status] || status}
    </span>
  );
}
