'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  Eye,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { approvalAPI } from '@/lib/api';

/**
 * Approval Queue Page
 * 
 * Displays queue items for approval review
 * Admin submit -> Approval queue -> Approve/Reject -> Submission timeline / Revision
 */
export default function ApprovalQueuePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await approvalAPI.getQueue({ limit: 50 });
      if (response.data.success) {
        setQueue(response.data.data || []);
        setMeta(response.data.meta || { total: 0 });
      }
    } catch (error) {
      console.error('Queue fetch error:', error);
      setError('Gagal memuat antrian. Pastikan Anda memiliki akses sebagai Approval.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link 
            href="/dashboard/approval" 
            className="inline-flex items-center gap-2 text-dark-400 hover:text-primary-400 mb-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-dark-100">Antrian Approval</h1>
          <p className="text-dark-400">{meta.total} transaksi menunggu review</p>
        </div>
        <button onClick={fetchQueue} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="glass-card p-4 border-l-4 border-l-primary-500/50 bg-primary-500/5">
        <p className="text-sm text-dark-300">
          <strong className="text-primary-400">Alur:</strong> Transaksi yang di-submit oleh Admin Finance akan muncul di sini. 
          Anda dapat Approve atau Reject setiap transaksi.
        </p>
      </div>

      {/* Queue List */}
      {error ? (
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-400 mb-4" />
          <p className="text-rose-400 mb-4">{error}</p>
          <button onClick={fetchQueue} className="btn-primary">
            Coba Lagi
          </button>
        </div>
      ) : queue.length > 0 ? (
        <div className="space-y-3">
          {queue.map((item, index) => (
            <QueueItem key={item.id || index} item={item} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-dark-100 mb-2">Tidak Ada Antrian</h3>
          <p className="text-dark-500">Semua transaksi sudah diproses</p>
        </div>
      )}
    </div>
  );
}

/**
 * Queue Item Component
 */
function QueueItem({ item }) {
  // Format currency
  const formatCurrency = (amount, currency = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get relative time display
  const getRelativeTimeDisplay = (relTime) => {
    const timeMap = {
      'just_now': 'Baru saja',
      'recent': 'Beberapa jam lalu',
      'today': 'Hari ini',
      'yesterday': 'Kemarin',
      'this_week': 'Minggu ini',
      'older': 'Lebih lama',
      'unknown': '-'
    };
    return timeMap[relTime] || relTime;
  };

  // Get risk color
  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
  };

  // Get label style
  const getLabelStyle = (label) => {
    switch (label) {
      case 'Needs extra care':
        return { bg: 'bg-rose-500/10', text: 'text-rose-400', icon: <AlertTriangle className="w-3 h-3" /> };
      case 'Time-sensitive':
        return { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: <Zap className="w-3 h-3" /> };
      case 'Revision':
        return { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: <RefreshCw className="w-3 h-3" /> };
      default:
        return { bg: 'bg-dark-700/50', text: 'text-dark-400', icon: null };
    }
  };

  const labelStyle = getLabelStyle(item.soft_label);
  const isElevated = item.attention_level === 'elevated' || item.risk_level === 'high';

  return (
    <div className={`glass-card p-5 transition-all hover:border-primary-500/30 ${
      isElevated ? 'border-l-4 border-l-amber-500/70' : ''
    }`}>
      <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
        <div className="flex items-start gap-4 flex-1">
          {/* Queue Position & Risk Indicator */}
          <div className="flex flex-col items-center">
            <span className="text-xs text-dark-500 mb-1">#{item.queue_position}</span>
            <div className={`p-3 rounded-xl ${getRiskColor(item.risk_level)}`}>
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Transaction Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {/* Transaction Code */}
              <h3 className="font-bold text-dark-100 text-lg">
                {item.transaction_code || `TRX-${item.id?.slice(0, 8)}`}
              </h3>
              
              {/* Status Badge */}
              {item.status === 'resubmitted' ? (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                  Resubmit
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-sky-500/20 text-sky-400">
                  Baru
                </span>
              )}

              {/* Soft Label */}
              {item.soft_label && item.soft_label !== 'Routine' && (
                <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${labelStyle.bg} ${labelStyle.text}`}>
                  {labelStyle.icon}
                  {item.soft_label}
                </span>
              )}

              {/* Risk Badge */}
              {item.risk_level === 'high' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-3 h-3" />
                  High Risk
                </span>
              )}
            </div>

            {/* Details Row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dark-400">
              <span className="capitalize">{item.transaction_type || item.job_type || 'Payment'}</span>
              <span>•</span>
              <span className="font-medium text-dark-200">
                {formatCurrency(item.amount, item.currency)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.relative_time ? getRelativeTimeDisplay(item.relative_time) : formatDate(item.submitted_at)}
              </span>
              <span>•</span>
              <span className={`flex items-center gap-1 ${
                item.document_status === 'complete' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {item.document_status === 'complete' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {item.document_status === 'complete' ? 'Dok. Lengkap' : 'Dok. Belum Lengkap'}
              </span>
            </div>

            {/* Recipient/Description */}
            {(item.recipient_name || item.description) && (
              <p className="text-sm text-dark-500 mt-2 line-clamp-1">
                {item.recipient_name && <span>Penerima: {item.recipient_name}</span>}
                {item.recipient_name && item.description && <span> • </span>}
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <Link
            href={`/dashboard/approval/review/${item.id}`}
            className="btn-primary py-3 px-6 flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Review
          </Link>
        </div>
      </div>
    </div>
  );
}
