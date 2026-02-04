'use client';

import { HelpCircle, Book, ShieldAlert, Eye, CheckCircle } from 'lucide-react';

export default function ApprovalHelpPage() {
  return (
    <div className="space-y-6 animate-in">
       {/* Header */}
       <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
             <HelpCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Help & SOP</h1>
            <p className="text-dark-400">Panduan standar operasional untuk Approval</p>
          </div>
       </div>

       {/* SOP Sections */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6">
             <h3 className="font-semibold text-dark-100 mb-4 flex items-center gap-2">
                <Book className="w-5 h-5 text-indigo-400" /> Standar Review (SOP)
             </h3>
             <ul className="space-y-3 list-disc pl-5 text-dark-300 text-sm">
                <li><strong className="text-dark-200">Verifikasi Dokumen:</strong> Pastikan semua dokumen pendukung (invoice, bukti transfer) sesuai dengan data yang diinput.</li>
                <li><strong className="text-dark-200">Cek Nominal:</strong> Bandingkan nominal di form dengan nominal yang tertera di dokumen.</li>
                <li><strong className="text-dark-200">Validasi Penerima:</strong> Nama penerima harus sesuai antara form dan dokumen.</li>
                <li><strong className="text-dark-200">Perhatikan Label:</strong> Item dengan label "Needs extra care" atau "Time-sensitive" memerlukan verifikasi lebih teliti.</li>
             </ul>
          </div>
          
          <div className="glass-card p-6 border-l-4 border-l-amber-500">
             <h3 className="font-semibold text-dark-100 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-400" /> Hal Yang Perlu Diperhatikan
             </h3>
             <ul className="space-y-3 list-disc pl-5 text-dark-300 text-sm">
                <li><strong className="text-amber-300">Transaksi Nilai Besar:</strong> Transaksi di atas Rp 50 Juta memerlukan verifikasi lebih ketat.</li>
                <li><strong className="text-amber-300">Resubmission:</strong> Perhatikan catatan revisi sebelumnya untuk memahami konteks.</li>
                <li><strong className="text-amber-300">Dokumen Tidak Lengkap:</strong> Jangan approve jika dokumen pendukung belum lengkap.</li>
                <li><strong className="text-amber-300">OCR Mismatch:</strong> Jika ada perbedaan antara input manual dan hasil OCR, minta klarifikasi.</li>
             </ul>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-emerald-500">
             <h3 className="font-semibold text-dark-100 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> Kriteria Approval
             </h3>
             <ul className="space-y-3 list-disc pl-5 text-dark-300 text-sm">
                <li>Semua dokumen pendukung lengkap dan valid</li>
                <li>Nominal sesuai antara form, dokumen, dan hasil OCR</li>
                <li>Nama penerima terverifikasi</li>
                <li>Tidak ada flag atau peringatan sistem yang belum terselesaikan</li>
                <li>Tujuan pembayaran jelas dan sesuai prosedur</li>
             </ul>
          </div>
          
          <div className="glass-card p-6 border-l-4 border-l-rose-500">
             <h3 className="font-semibold text-dark-100 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" /> Batasan Sistem
             </h3>
             <ul className="space-y-3 list-disc pl-5 text-dark-300 text-sm">
                <li><strong className="text-rose-300">Urutan Antrian:</strong> Urutan antrian ditentukan oleh sistem dan tidak dapat diubah secara manual.</li>
                <li><strong className="text-rose-300">Keputusan Final:</strong> Keputusan approval/reject bersifat final. Pastikan sudah yakin sebelum mengambil keputusan.</li>
                <li><strong className="text-rose-300">Alasan Reject:</strong> Wajib memberikan alasan yang jelas (minimal 10 karakter) saat menolak transaksi.</li>
                <li><strong className="text-rose-300">Tidak Ada Override:</strong> Sistem tidak menyediakan fitur override keputusan tanpa audit trail.</li>
             </ul>
          </div>
       </div>
    </div>
  );
}
