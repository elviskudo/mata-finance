'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  AlertTriangle, 
  Clock, 
  FileText, 
  ChevronRight, 
  ArrowLeft,
  ShieldAlert,
  Zap,
  Info,
  CheckCircle,
  XCircle,
  MessageSquare,
  User,
  RefreshCw
} from 'lucide-react';
import { approvalAPI } from '@/lib/api';
import { useAlertModal } from '@/components/AlertModal';

export default function EmergencyRequestsPage() {
  const router = useRouter();
  const alertModal = useAlertModal();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null); // stores item id being processed
  const [rejectItem, setRejectItem] = useState(null); // item being rejected
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchEmergencyRequests();
  }, []);

  const fetchEmergencyRequests = async () => {
    try {
      setLoading(true);
      const resp = await approvalAPI.getEmergencyList();
      if (resp.data.success) {
        setItems(resp.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch emergency requests:', err);
      setError('Gagal memuat daftar emergency. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickApprove = async (id) => {
    const confirmed = await alertModal.confirm('Apakah Anda yakin ingin menyetujui transaksi ini segera?', 'Konfirmasi Approve');
    if (!confirmed) return;
    try {
      setProcessing(id);
      await approvalAPI.approve(id, '[QUICK APPROVAL] Approved via Emergency Menu');
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      alertModal.error('Gagal menyetujui: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickReject = (item) => {
    setRejectItem(item);
    setRejectReason('');
  };

  const submitReject = async (rejectionType) => {
    if (!rejectReason || rejectReason.length < 10) {
      alertModal.warning('Alasan penolakan minimal 10 karakter');
      return;
    }

    try {
      const id = rejectItem.id;
      setProcessing(id);
      await approvalAPI.reject(id, { 
        reason: rejectReason, 
        rejectionType 
      });
      setItems(items.filter(item => item.id !== id));
      setRejectItem(null);
      
      if (rejectionType === 'request_new') {
        alertModal.success('Reject & Buat Baru: Admin disuruh buat transaksi baru yang serupa.');
      } else {
        alertModal.success('Reject & Tutup: Transaksi di-reject dan tidak perlu buat baru.');
      }
    } catch (err) {
      alertModal.error('Gagal menolak: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickClarify = async (id) => {
    const reason = await alertModal.prompt(
      'Transaksi akan dikembalikan ke Admin untuk direvisi dan dapat disubmit ulang.\n\nMasukkan catatan klarifikasi (min 10 karakter):', 
      'Minta Revisi', 
      { placeholder: 'Jelaskan apa yang perlu diperbaiki...' }
    );
    if (!reason || reason.length < 10) {
      if (reason) alertModal.warning('Catatan terlalu pendek');
      return;
    }
    try {
      setProcessing(id);
      // Use clarify endpoint - returns to admin for revision
      await approvalAPI.clarify(id, reason);
      setItems(items.filter(item => item.id !== id));
      alertModal.success('Transaksi dikembalikan ke Admin untuk direvisi.');
    } catch (err) {
      alertModal.error('Gagal meminta klarifikasi: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <Zap className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/approval"
            className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-dark-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
              Emergency Requests
              <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
                Action Required
              </span>
            </h1>
            <p className="text-dark-400 text-sm mt-1">Laporan darurat yang dideklarasikan oleh Admin Finance</p>
          </div>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs text-dark-500 uppercase tracking-widest font-bold">System Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-sm font-medium text-amber-500/80">Active Emergency Context</span>
          </div>
        </div>
      </div>

      {/* Pressure Alert Box */}
      <div className="glass-card bg-amber-950/20 border-amber-500/30 p-5">
        <div className="flex gap-4">
          <div className="shrink-0 p-3 rounded-xl bg-amber-500/20 text-amber-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-amber-400">Peringatan Tekanan Sistem</h4>
            <p className="text-sm text-amber-200/70 leading-relaxed">
              Daftar ini berisi instruksi pembayaran yang membutuhkan atensi segera. 
              Gunakan mode review detail jika diperlukan atensi ekstra pada nominal krusial.
            </p>
          </div>
        </div>
      </div>

      {/* Emergency List */}
      <div className="grid grid-cols-1 gap-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div 
              key={item.id}
              className="glass-card group relative overflow-hidden transition-all hover:bg-dark-800/80 hover:border-amber-500/30"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-600"></div>
              
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex gap-4 flex-1">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center border border-dark-700">
                    <FileText className="w-6 h-6 text-dark-400" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-dark-100 uppercase tracking-tight truncate">
                        {item.job_type}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase">
                        {item.label}
                      </span>
                    </div>
                    
                    <p className="text-amber-400 text-sm font-bold">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.amount)} 
                      <span className="text-dark-400 font-normal ml-2">to {item.recipient_name}</span>
                    </p>

                    <p className="text-dark-300 text-sm italic line-clamp-1 border-l-2 border-dark-700 pl-3">
                      "{item.admin_short_reason}"
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                       <div className="flex items-center gap-1.5 text-xs text-dark-400">
                        <User className="w-3.5 h-3.5 text-primary-400" />
                        <span>By: <span className="text-dark-200 font-medium">{item.submitter_alias}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-dark-400">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                        <span>Docs: <span className="text-dark-200 font-medium">{item.document_completeness}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-dark-400">
                        <Clock className="w-3.5 h-3.5 text-rose-400" />
                        <span>Declared: <span className="text-dark-200 font-medium">{item.relative_request_time}</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* The 3 Buttons requested */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleQuickApprove(item.id)}
                    disabled={processing === item.id}
                    className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                    title="Approve"
                  >
                    {processing === item.id ? <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div> : <CheckCircle className="w-5 h-5" />}
                  </button>
                  
                  <button
                    onClick={() => handleQuickClarify(item.id)}
                    disabled={processing === item.id}
                    className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                    title="Minta Revisi"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleQuickReject(item)}
                    disabled={processing === item.id}
                    className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/20"
                    title="Tolak Transaksi"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>

                  <Link 
                    href={`/dashboard/approval/review/${item.id}?context=emergency`}
                    className="ml-2 btn-primary py-2.5 px-4 flex items-center gap-2 group-hover:scale-105 transition-transform text-sm"
                  >
                    Review Detail
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="bg-dark-900/50 px-5 py-2 border-t border-dark-800/50 flex justify-between">
                <span className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">
                  Atensi Krusial: Verifikasi Dokumen Masih Berlaku
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card p-12 text-center border-dashed border-dark-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-emerald-500/50" />
            </div>
            <h3 className="text-xl font-bold text-dark-200 mb-2">No Active Emergencies</h3>
            <p className="text-dark-500 max-w-sm mx-auto">
              Tidak ada laporan emergency yang membutuhkan keputusan segera saat ini.
            </p>
          </div>
        )}
      </div>

      {/* Procedural Limits Notice */}
      <div className="p-6 bg-dark-900/40 rounded-2xl border border-dark-800 text-center">
        <p className="text-xs text-dark-500 flex items-center justify-center gap-2">
          <Info className="w-4 h-4" />
          Detail krusial tetap ditampilkan dalam mode Review untuk menghindari kesalahan verifikasi.
        </p>
      </div>

      {/* Quick Reject Modal */}
      {rejectItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark-950/90 backdrop-blur-md animate-fade-in">
          <div className="glass-card p-6 w-full max-w-lg animate-slide-up border-rose-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-xl font-bold text-dark-100">Tolak: {rejectItem.job_type}</h3>
            </div>

            <p className="text-dark-400 mb-4 text-sm">
              Berikan alasan penolakan untuk transaksi senilai <span className="text-amber-400 font-bold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(rejectItem.amount)}</span>.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Masukkan alasan penolakan (min 10 karakter)..."
              className="input-field w-full h-32 resize-none mb-6 border-rose-500/20 focus:border-rose-500/50"
              autoFocus
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => submitReject('request_new')}
                disabled={processing === rejectItem.id || rejectReason.length < 10}
                className="flex flex-col items-center justify-center p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="p-2 rounded-full bg-amber-500/20 mb-2 group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-5 h-5 text-amber-500" />
                </div>
                <span className="text-sm font-bold text-amber-400">Reject & Buat Baru</span>
                <span className="text-[10px] text-amber-500/60 text-center mt-1">Admin disuruh buat transaksi baru yang serupa</span>
              </button>

              <button
                onClick={() => submitReject('permanent')}
                disabled={processing === rejectItem.id || rejectReason.length < 10}
                className="flex flex-col items-center justify-center p-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="p-2 rounded-full bg-rose-500/20 mb-2 group-hover:scale-110 transition-transform">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-sm font-bold text-rose-400">Reject & Tutup</span>
                <span className="text-[10px] text-rose-500/60 text-center mt-1">Setelah di-reject admin tidak perlu buat baru</span>
              </button>
            </div>

            <button
              onClick={() => setRejectItem(null)}
              className="w-full mt-4 py-2 text-dark-500 hover:text-dark-300 text-sm transition-colors font-medium underline underline-offset-4"
            >
              Batal
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}

