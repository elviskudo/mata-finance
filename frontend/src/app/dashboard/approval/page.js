'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Eye,
  Calendar,
  Zap,
  Target,
  Award,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { authAPI, approvalAPI } from '@/lib/api';

export default function ApprovalDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

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

      // Validate session
      const session = await authAPI.validateSession();
      if (session?.data?.data) {
        activeUser = session.data.data;
        setUser(activeUser);
        localStorage.setItem('user', JSON.stringify(activeUser));
      }

      const role = String(activeUser?.role ?? '').toLowerCase();
      
      // Only approval can access this page
      if (role !== 'approval') {
        router.replace('/dashboard/admin');
        return;
      }

      await fetchApprovalData();
    } catch (err) {
      console.error('Auth error:', err);
      setError('Sesi tidak valid atau sudah berakhir.');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalData = async () => {
    try {
      // Get home context
      const contextResp = await approvalAPI.getHomeContext();
      if (contextResp.data.success) {
        setContext(contextResp.data.data);
      }

      // Get approval stats
      const statsResp = await approvalAPI.getStats();
      if (statsResp.data.success) {
        setStats(statsResp.data.data);
      }

      // Get pending items for review
      const queueResp = await approvalAPI.getQueue({ limit: 5 });
      if (queueResp.data.success) {
        setRecentItems(queueResp.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching approval data:', error);
      // Set default values if API fails
      setStats({
        today: { approved: 0, rejected: 0, pending: 0 },
        week: { approved: 0, rejected: 0, total: 0 },
        avgProcessingTime: 0,
        approvalRate: 0
      });
    }
  };

  if (loading) {
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

  const isElevatedWorkload = context?.workload_label === 'Higher attention required';

  return (
    <div className="space-y-6 animate-in">
      {/* Daily Reminder Banner */}
      {context?.reminder?.show && (
        <div className={`glass-card p-4 border-l-4 ${isElevatedWorkload ? 'border-amber-500 bg-amber-500/5' : 'border-primary-500 bg-primary-500/5'}`}>
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${isElevatedWorkload ? 'bg-amber-500/20 text-amber-400' : 'bg-primary-500/20 text-primary-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-dark-100">Daily Reminder</h4>
              <p className="text-dark-400 mt-1">{context.reminder.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-accent-500/10 to-primary-500/10" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-accent-400 font-medium mb-1">Approval Dashboard</p>
            <h1 className="text-2xl font-bold text-dark-100 mb-2">
              Selamat Datang, {user?.publicAlias ?? 'Approval Officer'} 👋
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
            <Link href="/dashboard/approval/queue" className="btn-primary flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Lihat Antrian
            </Link>
            <button onClick={bootstrap} className="btn-ghost">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pending Items - Main Focus */}
        <div className="lg:col-span-2 glass-card p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-accent-500/5" />
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-dark-400 uppercase tracking-wider text-sm font-medium">Antrian Hari Ini</p>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="text-6xl font-black text-dark-100">{context?.pending_items ?? 0}</span>
                  <span className="text-dark-400">item menunggu</span>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                isElevatedWorkload 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  isElevatedWorkload ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <span className="text-sm font-medium">{context?.workload_label || 'Normal workload'}</span>
              </div>
            </div>
            <Link 
              href="/dashboard/approval/queue"
              className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 font-medium mt-2"
            >
              Mulai Review <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Today's Performance */}
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Disetujui Hari Ini"
          value={stats?.today?.approved ?? 0}
          color="emerald"
          trend={stats?.trends?.approved}
        />
        <StatCard
          icon={<XCircle className="w-6 h-6" />}
          label="Ditolak Hari Ini"
          value={stats?.today?.rejected ?? 0}
          color="rose"
          trend={stats?.trends?.rejected}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Approval Rate */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-dark-400 text-sm font-medium uppercase tracking-wider">Approval Rate</h3>
            <Target className="w-5 h-5 text-primary-400" />
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-dark-100">{stats?.approvalRate ?? 0}%</span>
            <span className="text-dark-500 text-sm pb-1">minggu ini</span>
          </div>
          <div className="mt-4 h-2 bg-dark-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
              style={{ width: `${stats?.approvalRate ?? 0}%` }}
            />
          </div>
        </div>

        {/* Average Processing Time */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-dark-400 text-sm font-medium uppercase tracking-wider">Rata-rata Waktu Proses</h3>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-dark-100">{stats?.avgProcessingTime ?? 0}</span>
            <span className="text-dark-500 text-sm pb-1">menit/item</span>
          </div>
          <p className="text-dark-500 text-sm mt-2">
            {stats?.avgProcessingTime <= 15 ? '✓ Di bawah standar' : '⚠ Di atas rata-rata'}
          </p>
        </div>

        {/* Weekly Summary */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-dark-400 text-sm font-medium uppercase tracking-wider">Ringkasan Minggu Ini</h3>
            <BarChart3 className="w-5 h-5 text-sky-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Total Diproses</span>
              <span className="font-bold text-dark-100">{stats?.week?.total ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Disetujui</span>
              <span className="font-bold text-emerald-400">{stats?.week?.approved ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Ditolak</span>
              <span className="font-bold text-rose-400">{stats?.week?.rejected ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Queue Preview */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-dark-100">Transaksi Menunggu Review</h3>
            <p className="text-sm text-dark-500">Item terbaru yang perlu keputusan Anda</p>
          </div>
          <Link
            href="/dashboard/approval/queue"
            className="btn-secondary text-sm flex items-center gap-1"
          >
            Lihat Semua <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentItems.length > 0 ? (
          <div className="space-y-3">
            {recentItems.map((item, index) => (
              <div 
                key={item.id || index}
                className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl hover:bg-dark-800 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <p className="font-medium text-dark-100">{item.transaction_code || item.code || `TRX-${index + 1}`}</p>
                    <div className="flex items-center gap-2 text-sm text-dark-400">
                      <span className="capitalize">{item.transaction_type || item.type || 'Payment'}</span>
                      <span>•</span>
                      <span>{item.submitter_alias || 'FIN-XXXX'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-dark-100">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                      }).format(item.amount || 0)}
                    </p>
                    <p className="text-xs text-dark-500">
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString('id-ID') : '-'}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/approval/review/${item.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity btn-primary py-2 px-4 text-sm"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="font-semibold text-dark-100 mb-2">Tidak Ada Antrian</h4>
            <p className="text-dark-500">Semua transaksi sudah diproses</p>
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="glass-card p-6 border-l-4 border-dark-600">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-dark-800 rounded-lg">
            <Award className="w-5 h-5 text-dark-400" />
          </div>
          <div>
            <h4 className="font-semibold text-dark-300">Tips Approval yang Baik</h4>
            <ul className="mt-2 space-y-1 text-sm text-dark-500">
              <li>• Periksa kesesuaian dokumen dengan data transaksi</li>
              <li>• Verifikasi nominal dan penerima dengan teliti</li>
              <li>• Berikan alasan yang jelas jika menolak transaksi</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color = 'primary', trend }) {
  const colorClasses = {
    primary: 'from-primary-500/20 to-primary-500/5 text-primary-400 border-primary-500/30',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30',
    sky: 'from-sky-500/20 to-sky-500/5 text-sky-400 border-sky-500/30',
  };

  return (
    <div className={`glass-card p-6 bg-gradient-to-br ${colorClasses[color]} border`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>{icon}</div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-dark-100">{value}</p>
      <p className="text-sm text-dark-400 mt-1">{label}</p>
    </div>
  );
}
