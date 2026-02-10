'use client';

import { useState, useEffect } from 'react';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Clock, 
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { approvalAPI } from '@/lib/api';

export default function MyDecisionsPage() {
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await approvalAPI.getMyDecisions();
      if (response.data.success) {
        setDecisions(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Gagal memuat riwayat keputusan personal.');
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeIcon = (outcome) => {
    switch (outcome) {
      case 'approve': return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'reject': return <XCircle className="w-5 h-5 text-rose-400" />;
      case 'clarify': return <HelpCircle className="w-5 h-5 text-amber-400" />;
      default: return <Clock className="w-5 h-5 text-dark-400" />;
    }
  };

  const getRelativeTime = (date) => {
    const diff = new Date() - new Date(date);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m yang lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}j yang lalu`;
    return `${Math.floor(hours / 24)}h yang lalu`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in">
      {/* Header Info */}
      <div className="glass-card p-6 relative overflow-hidden bg-dark-900/40 border-none">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary-500/10 text-primary-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">My Decisions</h1>
            <p className="text-dark-400 text-sm mt-1">
              Catatan personal aksi persetujuan Anda (Terbatas 60 hari terakhir).
            </p>
          </div>
        </div>
      </div>

      {/* memory Scope Disclosure */}
      <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex items-start gap-3">
        <Clock className="w-4 h-4 text-amber-500/60 mt-0.5" />
        <p className="text-[11px] text-amber-500/70 leading-relaxed uppercase tracking-wider">
          Memory Scope Manager: Riwayat ini hanya menampilkan aksi personal Anda. 
          Detail transaksi mendalam dan status hilir (downstream) disembunyikan untuk menjaga integritas sistem.
        </p>
      </div>

      {/* Decisions List */}
      <div className="space-y-3">
        {decisions.length > 0 ? (
          decisions.map((item) => (
            <div 
              key={item.id}
              className="glass-card p-5 group flex items-center justify-between hover:bg-dark-800/40 transition-all border-dark-800/50"
            >
              <div className="flex items-center gap-5">
                <div className={`p-2 rounded-lg bg-dark-800 border border-dark-700/50`}>
                  {getOutcomeIcon(item.outcome)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-dark-400 uppercase tracking-widest bg-dark-800 px-1.5 py-0.5 rounded">
                      {item.transaction_mask}
                    </span>
                    <span className="text-[10px] text-dark-500">•</span>
                    <span className="text-[10px] font-bold text-dark-500 uppercase tracking-widest">
                      {item.item_type}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-dark-200 capitalize">
                    {item.outcome === 'approve' ? 'Persetujuan Diberikan' : 
                     item.outcome === 'reject' ? 'Ditolak Permanen' : 'Diminta Revisi'}
                  </h3>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-dark-500 font-medium">
                  {getRelativeTime(item.timestamp)}
                </p>
                <div className="mt-1 flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <EyeOff className="w-3 h-3 text-dark-600" />
                  <span className="text-[9px] text-dark-600 uppercase font-bold tracking-tighter">No Detail Drill-down</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center glass-card border-dashed border-dark-800 bg-transparent">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-900 flex items-center justify-center">
              <History className="w-6 h-6 text-dark-700" />
            </div>
            <h4 className="font-semibold text-dark-300">Belum Ada Riwayat</h4>
            <p className="text-dark-500 text-sm mt-1">Aksi persetujuan Anda akan muncul di sini.</p>
          </div>
        )}
      </div>

      {/* Limitations Footer */}
      <div className="flex flex-col md:flex-row gap-6 opacity-30 pt-10">
        <div className="flex-1 p-4 border border-dark-800 rounded-xl text-[9px] text-dark-500 uppercase tracking-[0.1em] leading-loose">
          <div className="flex items-center gap-2 mb-2 font-bold text-dark-400">
            <AlertCircle className="w-3 h-3" />
            Data Reduction Engine (DRE) Policy
          </div>
          Input nominal, identitas vendor, dan kategori risiko dihapus dari riwayat personal untuk mencegah pembentukan bias kognitif atau optimasi pola oleh pengguna.
        </div>
        <div className="flex-1 p-4 border border-dark-800 rounded-xl text-[9px] text-dark-500 uppercase tracking-[0.1em] leading-loose">
          <div className="flex items-center gap-2 mb-2 font-bold text-dark-400">
            <EyeOff className="w-3 h-3" />
            Feedback Loop Inhibition
          </div>
          Sistem tidak memberikan indikasi ketepatan (correctness) atau performa berkelanjutan. Status akhir transaksi hanya dapat diakses melalui modul audit eksternal.
        </div>
      </div>
    </div>
  );
}
