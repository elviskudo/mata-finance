'use client';

import { HelpCircle, Book, ShieldAlert } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="space-y-6 animate-in">
       {/* Header */}
       <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
             <HelpCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Help & SOP</h1>
            <p className="text-dark-400">Panduan standar operasional dan batasan sistem</p>
          </div>
       </div>

       {/* SOP Sections */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6">
             <h3 className="font-semibold text-dark-100 mb-4 flex items-center gap-2">
                <Book className="w-5 h-5 text-indigo-400" /> Standar Input (SOP)
             </h3>
             <ul className="space-y-3 list-disc pl-5 text-dark-300 text-sm">
                <li><strong className="text-dark-200">Anti-Split:</strong> Dilarang memecah satu invoice menjadi beberapa transaksi kecil untuk menghindari approval level tinggi.</li>
                <li><strong className="text-dark-200">Lampiran Wajib:</strong> Invoice asli (PDF/Image) wajib dilampirkan. Bukti transfer saja tidak cukup.</li>
                <li><strong className="text-dark-200">Kesesuaian Vendor:</strong> Nama penerima di form harus persis dengan yang tertera di dokumen hasil OCR.</li>
             </ul>
          </div>
          
          <div className="glass-card p-6 border-l-4 border-l-rose-500">
             <h3 className="font-semibold text-dark-100 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" /> Batasan Sistem (Hard Rules)
             </h3>
             <ul className="space-y-3 list-disc pl-5 text-dark-300 text-sm">
                <li><strong className="text-rose-300">No Manual Edit:</strong> Admin tidak dapat mengubah nominal hasil OCR secara manual lebih dari 5%.</li>
                <li><strong className="text-rose-300">Lock on Submit:</strong> Transaksi terkunci permanen setelah tombol Submit ditekan, kecuali direturn oleh Approver.</li>
                <li><strong className="text-rose-300">Personal Scope:</strong> Anda hanya dapat melihat transaksi yang Anda input sendiri.</li>
             </ul>
          </div>
       </div>
    </div>
  );
}
