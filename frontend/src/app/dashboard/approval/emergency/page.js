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
  User
} from 'lucide-react';
import { approvalAPI } from '@/lib/api';

export default function EmergencyRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null); // stores item id being processed

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
    if (!confirm('Apakah Anda yakin ingin menyetujui transaksi ini segera?')) return;
    try {
      setProcessing(id);
      await approvalAPI.approve(id, '[QUICK APPROVAL] Approved via Emergency Menu');
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      alert('Gagal menyetujui: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickReject = async (id) => {
    const reason = prompt('Alasan Penolakan (min 10 karakter):');
    if (!reason || reason.length < 10) {
      if (reason) alert('Alasan terlalu pendek');
      return;
    }
    try {
      setProcessing(id);
      await approvalAPI.reject(id, reason);
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      alert('Gagal menolak: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickClarify = async (id) => {
    const defaultClarify = 'Mohon klarifikasi tujuan pembayaran dan urgensi transaksi ini.';
    if (!confirm('Kirim permintaan klarifikasi standar?')) return;
    try {
      setProcessing(id);
      await approvalAPI.reject(id, `[Clarification Required] ${defaultClarify}`);
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      alert('Gagal meminta klarifikasi: ' + (err.response?.data?.message || err.message));
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
                    onClick={() => handleQuickReject(item.id)}
                    disabled={processing === item.id}
                    className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors border border-rose-500/20"
                    title="Reject"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleQuickClarify(item.id)}
                    disabled={processing === item.id}
                    className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                    title="Request Clarification"
                  >
                    <MessageSquare className="w-5 h-5" />
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
    </div>
  );
}
