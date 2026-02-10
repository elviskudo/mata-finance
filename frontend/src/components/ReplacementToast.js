'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertCircle, 
  X, 
  ArrowRight, 
  RefreshCw, 
  Eye, 
  ChevronRight,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { transactionAPI } from '@/lib/api';

export default function ReplacementToast() {
  const router = useRouter();
  const [replacements, setReplacements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchReplacements();
    // Poll every 1 minute to check for new rejections
    const interval = setInterval(fetchReplacements, 60000);
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
        // Successfully created replacement draft, navigate to it
        const newId = response.data.data.id;
        router.push(`/dashboard/admin/draft?id=${newId}`);
        setShowModal(false);
        // Refresh the list
        fetchReplacements();
      }
    } catch (error) {
      console.error('Failed to create replacement:', error);
      alert('Gagal membuat transaksi baru. Silakan coba lagi.');
    } finally {
      setProcessing(null);
    }
  };

  if (replacements.length === 0) return null;

  return (
    <>
      {/* Persistent Toast */}
      <div 
        className="fixed bottom-6 right-6 z-[60] animate-bounce-in cursor-pointer group"
        onClick={() => setShowModal(true)}
      >
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-rose-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <div className="relative glass-card p-4 border-amber-500/50 flex items-center gap-4 bg-dark-900/90 shadow-2xl min-w-[300px]">
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500">
              <RefreshCw className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h4 className="font-bold text-amber-400 leading-tight">Perlu Tindakan Segera</h4>
              <p className="text-sm text-dark-400 mt-1">
                Ada {replacements.length} transaksi ditolak & disuruh buat baru.
              </p>
            </div>
            <div className="ml-2 p-1.5 bg-dark-800 rounded-full group-hover:bg-amber-500/20 transition-colors">
              <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-amber-400" />
            </div>
            
            {/* Count Badge */}
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-dark-950">
              {replacements.length}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-dark-950/90 backdrop-blur-md animate-fade-in">
          <div className="glass-card p-0 w-full max-w-2xl overflow-hidden animate-scale-in shadow-2xl border-amber-500/30">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-dark-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <RefreshCw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-dark-100">Instruksi Buat Transaksi Baru</h3>
                  <p className="text-sm text-dark-400 mt-0.5">Approval merekomendasikan pembuatan ulang dari transaksi berikut</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-dark-800 rounded-lg transition-colors text-dark-500 hover:text-dark-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
              {replacements.map((item) => (
                <div key={item.id} className="p-4 bg-dark-800/50 rounded-2xl border border-dark-700/50 hover:border-amber-500/30 transition-all group">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">{item.type}</span>
                        <span className="text-dark-500">•</span>
                        <h4 className="font-bold text-dark-100 truncate">{item.code}</h4>
                      </div>
                      <p className="text-sm font-medium text-dark-300 mb-2">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: item.currency || 'IDR' }).format(item.amount)}
                      </p>
                      
                      {/* Reason with quote style */}
                      <div className="bg-dark-900/50 p-3 rounded-xl border-l-2 border-rose-500/50 mt-2">
                        <p className="text-xs text-dark-400 italic font-medium">Alasan Reject:</p>
                        <p className="text-xs text-dark-200 mt-1">"{item.reason}"</p>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                      <Link 
                        href={`/dashboard/admin/submission-timeline?id=${item.id}`}
                        className="flex-1 md:flex-none p-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl text-dark-300 hover:text-dark-100 transition-colors flex items-center justify-center gap-2"
                        title="Lihat Detail Histori"
                        onClick={() => setShowModal(false)}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="md:hidden lg:inline text-xs font-semibold">Detail</span>
                      </Link>
                      
                      <button 
                        onClick={() => handleCreateReplacement(item.id)}
                        disabled={processing === item.id}
                        className="flex-2 md:flex-none py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-white rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 font-bold"
                      >
                        {processing === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span className="text-xs">Segera Buat Baru</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-dark-900/30 border-t border-dark-700/50">
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-200/70">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <p>
                  <strong>Penting:</strong> Toast notifikasi di pojok layar hanya akan hilang setelah semua transaksi di atas dibuat ulang dan disubmit ke approval.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes bounce-in {
          0% { transform: scale(0.3) translateY(100px); opacity: 0; }
          70% { transform: scale(1.05) translateY(-10px); opacity: 1; }
          100% { transform: scale(1) translateY(0); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes scale-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}</style>
    </>
  );
}
