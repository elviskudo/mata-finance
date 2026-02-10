'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Info, 
  ShieldCheck, 
  EyeOff,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { approvalAPI } from '@/lib/api';

export default function SystemNoticesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await approvalAPI.getSystemNotices();
      if (response.data.success) {
        setNotices(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching system notices:', err);
      setError('Layanan System Notice sedang dalam evaluasi periodik.');
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in">
      {/* Header Banner - Subtle "Whisper" Design */}
      <div className="glass-card p-6 relative overflow-hidden border-none bg-dark-900/40">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-dark-400" />
              <p className="text-xs text-dark-400 font-medium uppercase tracking-widest">Informasi Sistem</p>
            </div>
            <h1 className="text-2xl font-bold text-dark-100">System Notices</h1>
            <p className="text-dark-500 text-sm mt-1">
              Evaluasi periodik berdasarkan pola perilaku agregat.
            </p>
          </div>
          <button 
            onClick={fetchNotices} 
            className="p-2 rounded-lg text-dark-500 hover:text-dark-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notices Feed - Whisper style (minimalist, no big icons, just text) */}
      <div className="space-y-4">
        {notices.length > 0 ? (
          notices.map((notice, index) => (
            <div 
              key={notice.id || index}
              className="p-6 bg-dark-900/20 border border-dark-800/50 rounded-2xl hover:bg-dark-900/30 transition-all duration-500"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500/50" />
                  <span className="text-[10px] font-bold text-dark-500 uppercase tracking-[0.2em]">
                    {notice.title}
                  </span>
                </div>
                <p className="text-dark-200 text-lg font-medium leading-relaxed italic">
                  "{notice.message}"
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="text-[9px] text-dark-600 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 opacity-50" />
                    Verified by Timing & Exposure Regulator
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-dark-900/50 flex items-center justify-center text-dark-600">
              <EyeOff className="w-6 h-6 opacity-20" />
            </div>
            <h4 className="text-lg font-medium text-dark-400">Tidak ada evaluasi yang diperlukan</h4>
            <p className="text-dark-600 mt-2 max-w-sm mx-auto text-sm leading-relaxed">
              Pola perilaku saat ini berada dalam parameter organisasi yang stabil. 
              Evaluasi berikutnya akan dilakukan pada periode mendatang.
            </p>
          </div>
        )}
      </div>

      {/* Policy Footer - Extremely subtle */}
      <div className="pt-10 border-t border-dark-800/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 opacity-20 hover:opacity-100 transition-opacity duration-1000">
          <div className="text-[9px] text-dark-500 uppercase tracking-[0.15em] leading-loose">
            <p className="font-bold opacity-50 mb-2 underline decoration-dark-700">Non-Actionable Strategy</p>
            System Notice tidak menunjukkan ambang batas, skor, atau pembanding. 
            Informasi ini bersifat reflektif dan tidak untuk dioptimasi oleh pengguna.
          </div>
          <div className="text-[9px] text-dark-500 uppercase tracking-[0.15em] leading-loose">
            <p className="font-bold opacity-50 mb-2 underline decoration-dark-700">Delayed Exposure</p>
            Penayangan diatur oleh TER untuk mencegah korelasi langsung dengan tindakan transaksi tertentu. 
            Hanya muncul pada jendela Dashboard dan Sesi Baru.
          </div>
        </div>
      </div>
    </div>
  );
}
