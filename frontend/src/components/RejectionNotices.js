'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  XCircle, 
  X, 
  RefreshCw, 
  Eye, 
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { transactionAPI } from '@/lib/api';

export default function RejectionNotices() {
  const router = useRouter();
  const [replacements, setReplacements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchReplacements();
    // Refresh data setiap 30 detik
    const interval = setInterval(fetchReplacements, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchReplacements = async () => {
    try {
      const response = await transactionAPI.getPendingReplacements();
      if (response.data.success) {
        setReplacements(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch pending replacements:', error);
    }
  };

  const handleCreateReplacement = async (id) => {
    try {
      setProcessing(id);
      const response = await transactionAPI.createReplacement(id);
      if (response.data.success) {
        const newId = response.data.data.id;
        // Arahkan admin ke halaman edit draft baru dengan replacementMode
        // Mode ini akan membuat mereka harus selesaikan semua step tanpa bisa back
        router.push(`/dashboard/admin/transactions/new?id=${newId}&replacementMode=true`);
        setShowModal(false);
        fetchReplacements();
      }
    } catch (error) {
      console.error('Failed to create replacement:', error);
    } finally {
      setProcessing(null);
    }
  };

  if (replacements.length === 0) return null;

  return (
    <>
      {/* Fixed Red Border Alert at Top Right */}
      <div 
        className="fixed top-20 right-6 z-[100] w-full max-w-sm animate-slide-in-right cursor-pointer group"
        onClick={() => setShowModal(true)}
      >
        <div className="relative">
          {/* Neon Glow effect */}
          <div className="absolute -inset-0.5 bg-rose-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          
          <div className="relative glass-card p-0 overflow-hidden border-2 border-rose-500 shadow-2xl bg-dark-900/95">
            {/* Danger Strip at Top */}
            <div className="h-1.5 w-full bg-rose-500 animate-pulse"></div>
            
            <div className="p-4 flex gap-4">
              <div className="shrink-0">
                <div className="p-3 bg-rose-500/20 rounded-xl text-rose-500 group-hover:scale-110 transition-transform duration-300">
                  <RefreshCw className="w-6 h-6 animate-spin-slow" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-black text-rose-400 text-sm uppercase tracking-wider mb-1">
                  Instruksi Buat Baru
                </h4>
                <p className="text-sm text-dark-100 font-medium">
                  Ada {replacements.length} transaksi yang harus Anda buat ulang segera.
                </p>
                <div className="mt-3 flex items-center text-[10px] font-bold text-rose-500/80 uppercase tracking-widest">
                  Klik untuk proses <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-dark-950/90 backdrop-blur-md animate-fade-in">
          <div className="glass-card p-0 w-full max-w-2xl overflow-hidden animate-scale-in shadow-2xl border-rose-500/30">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-rose-500/10 to-transparent border-b border-dark-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 rounded-lg">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-dark-100">Daftar Transaksi Ditolak</h3>
                  <p className="text-sm text-dark-400 mt-0.5">Segera buat transaksi baru serupa sesuai instruksi Approval</p>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowModal(false); }}
                className="p-1.5 hover:bg-dark-800 rounded-lg transition-colors text-dark-500 hover:text-dark-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
              {replacements.map((item) => (
                <div key={item.id} className="p-4 bg-dark-800/10 rounded-2xl border border-dark-700/50 hover:border-rose-500/30 transition-all group">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-wider">
                          {item.type}
                        </span>
                        <h4 className="font-bold text-dark-100 truncate">{item.code}</h4>
                      </div>
                      <p className="text-sm font-bold text-dark-200">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: item.currency || 'IDR', minimumFractionDigits: 0 }).format(item.amount)}
                      </p>
                      
                      {/* Reason */}
                      <div className="bg-rose-500/5 p-3 rounded-xl border-l-2 border-rose-500 mt-3">
                        <p className="text-[10px] text-rose-400 font-black uppercase tracking-widest mb-1">Alasan Penolakan:</p>
                        <p className="text-xs text-dark-200 leading-relaxed italic">"{item.reason}"</p>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto shrink-0 self-end md:self-center">
                      <a 
                        href={`/dashboard/admin/submission-timeline?id=${item.id}`}
                        target="_blank"
                        className="flex-1 md:flex-none p-2.5 bg-dark-800 hover:bg-dark-700 rounded-xl text-dark-400 hover:text-dark-100 transition-colors flex items-center justify-center gap-2 border border-dark-700"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs font-bold">Detail</span>
                      </a>
                      
                      <button 
                        onClick={() => handleCreateReplacement(item.id)}
                        disabled={processing === item.id}
                        className="flex-2 md:flex-none py-2.5 px-4 bg-rose-500 hover:bg-rose-400 text-white rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 font-black uppercase tracking-tighter"
                      >
                        {processing === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span className="text-xs">Buat Sekarang</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-dark-900/50 border-t border-dark-700/50">
              <div className="flex items-start gap-3 p-4 bg-rose-500/5 rounded-xl border border-rose-500/20">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Peringatan Sistem</p>
                  <p className="text-[11px] text-dark-300 leading-relaxed">
                    Notifikasi merah di dashboard tidak akan hilang sampai Anda menyelesaikan pembuatan transaksi baru untuk semua daftar di atas. 
                    Klik <strong>"Buat Sekarang"</strong> untuk menduplikasi data transaksi lama secara otomatis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-in-right {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 4s linear infinite;
        }
        @keyframes scale-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
