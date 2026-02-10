'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  User,
  Building2,
  CreditCard,
  Calendar,
  DollarSign,
  FileCheck,
  MessageSquare,
  History,
  RefreshCw,
} from 'lucide-react';
import { approvalAPI } from '@/lib/api';

export default function ReviewTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const transactionId = params.id;
  const isEmergencyContext = searchParams.get('context') === 'emergency';

  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [clarifyReason, setClarifyReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    if (transactionId) {
      fetchTransaction();
    }
  }, [transactionId]);

  const fetchTransaction = async () => {
    try {
      setLoading(true);
      const response = await approvalAPI.getTransaction(transactionId);
      if (response.data.success) {
        setTransaction(response.data.data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Gagal memuat data transaksi');
    } finally {
      setLoading(false);
    }
  };

  // Show confirmation modal for approve
  const handleApprove = () => {
    setShowApproveModal(true);
  };

  // Confirm and execute approve
  const confirmApprove = async () => {
    try {
      setProcessing(true);
      setError('');
      const response = await approvalAPI.approve(transactionId, approvalNotes);
      if (response.data.success) {
        setShowApproveModal(false);
        router.push('/dashboard/approval/queue?success=approved');
      }
    } catch (error) {
      console.error('Approve error:', error);
      setError(error.response?.data?.message || 'Gagal menyetujui transaksi. Silakan coba lagi.');
      setShowApproveModal(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (rejectionType = 'permanent') => {
    if (rejectReason.length < 10) {
      setError('Alasan penolakan minimal 10 karakter');
      return;
    }

    try {
      setProcessing(true);
      const response = await approvalAPI.reject(transactionId, { 
        reason: rejectReason, 
        rejectionType 
      });
      if (response.data.success) {
        setShowRejectModal(false);
        router.push(`/dashboard/approval/queue?success=rejected&type=${rejectionType}`);
      }
    } catch (error) {
      console.error('Reject error:', error);
      setError(error.response?.data?.message || 'Gagal menolak transaksi');
    } finally {
      setProcessing(false);
    }
  };

  const handleClarify = async () => {
    if (clarifyReason.length < 10) {
      setError('Alasan klarifikasi minimal 10 karakter');
      return;
    }
    
    try {
      setProcessing(true);
      // Use clarify endpoint - returns to admin for revision
      const response = await approvalAPI.clarify(transactionId, clarifyReason);
      if (response.data.success) {
        setShowClarifyModal(false);
        router.push('/dashboard/approval/queue?success=clarified');
      }
    } catch (error) {
      console.error('Clarify error:', error);
      setError('Gagal mengirim permintaan klarifikasi');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && !transaction) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-rose-400 mb-4">{error}</p>
        <button onClick={fetchTransaction} className="btn-primary">
          Coba Lagi
        </button>
      </div>
    );
  }

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high': return 'bg-rose-500/20 text-rose-400 border-rose-500';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500';
      default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500';
    }
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link 
            href="/dashboard/approval/queue" 
            className="inline-flex items-center gap-2 text-dark-400 hover:text-primary-400 mb-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke {isEmergencyContext ? 'Emergency' : 'Antrian'}
          </Link>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            Review Transaksi
            {(isEmergencyContext || transaction?.emergency_id) && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-xs border border-amber-500/30">
                EMERGENCY
              </span>
            )}
          </h1>
        </div>
        
        {/* Risk Badge */}
        {transaction?.risk_level && (
          <div className={`px-4 py-2 rounded-full border ${getRiskColor(transaction.risk_level)}`}>
            <span className="flex items-center gap-2">
              {transaction.risk_level === 'high' && <AlertTriangle className="w-4 h-4" />}
              <span className="font-medium capitalize">{transaction.risk_level} Risk</span>
            </span>
          </div>
        )}
      </div>

      {/* Error Toast */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Transaction Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Header */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-dark-100">{transaction?.transaction_code}</h2>
                <p className="text-dark-400 capitalize">{transaction?.transaction_type || 'Payment'}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-dark-100">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: transaction?.currency || 'IDR',
                    minimumFractionDigits: 0,
                  }).format(transaction?.amount || 0)}
                </p>
                <p className="text-dark-500">{transaction?.currency || 'IDR'}</p>
              </div>
            </div>

            {transaction?.emergency_id && (
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-400">Emergency Reason</h4>
                    <p className="text-sm text-amber-200/80 mt-1 italic">
                      "{transaction.emergency_reason || 'No reason provided'}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {transaction?.description && (
              <div className="mt-6 pt-6 border-t border-dark-700/50">
                <h4 className="text-sm font-medium text-dark-400 mb-2">Deskripsi</h4>
                <p className="text-dark-200">{transaction.description}</p>
              </div>
            )}
          </div>

          {/* Submitter Info */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-dark-100 mb-4">Informasi Pengaju</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={<User />} label="ID Pengaju" value={transaction?.submitter_alias || '-'} />
              <InfoItem icon={<Building2 />} label="Departemen" value={transaction?.submitter_department || '-'} />
              <InfoItem icon={<Calendar />} label="Tanggal Submit" value={
                transaction?.submitted_at 
                  ? new Date(transaction.submitted_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '-'
              } />
              <InfoItem icon={<History />} label="Revisi ke-" value={transaction?.revision_count || 0} />
            </div>
          </div>

          {/* Visualized OCR Data */}
          {transaction?.ocr_data && (
            <div className="glass-card overflow-hidden">
              <div className="px-6 py-4 bg-dark-800/50 border-b border-dark-700/50 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-primary-400" />
                  Verifikasi Berkas (OCR)
                </h3>
                {transaction.ocr_data.match ? (
                  <span className="badge-success flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Sesuai Dokumen
                  </span>
                ) : (
                  <span className="badge-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Perlu Ditinjau
                  </span>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* Mismatches Alert */}
                {transaction.ocr_data.mismatches?.length > 0 && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                      <XCircle className="w-4 h-4" />
                      Ditemukan {transaction.ocr_data.mismatches.length} Ketidakcocokan
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {transaction.ocr_data.mismatches.map((m, i) => (
                        <div key={i} className="text-xs bg-dark-900/50 p-2 rounded-lg border border-rose-500/10">
                          <p className="text-dark-400 uppercase font-bold text-[10px] mb-1">{m.field?.replace('_', ' ')}</p>
                          <div className="flex justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-dark-500 mb-0.5">Input:</p>
                              <p className="text-dark-200 line-clamp-1">{m.expected}</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-rose-400/80 mb-0.5">OCR:</p>
                              <p className="text-rose-400 font-medium line-clamp-1">{m.detected || '(Tidak Terdeteksi)'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Fields Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OcrField 
                    label="Nama Vendor" 
                    value={transaction.ocr_data.parsed?.vendor} 
                    isMatch={!transaction.ocr_data.mismatches?.find(m => m.field === 'recipient_name')}
                  />
                  <OcrField 
                    label="Nomor Invoice" 
                    value={transaction.ocr_data.parsed?.invoiceNumber} 
                    isMatch={!transaction.ocr_data.mismatches?.find(m => m.field === 'invoice_number')}
                  />
                  <OcrField 
                    label="Tanggal Invoice" 
                    value={transaction.ocr_data.parsed?.invoiceDate} 
                    isMatch={true} 
                  />
                  <OcrField 
                    label="Total Nominal" 
                    value={transaction.ocr_data.parsed?.grandTotal ? 
                      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.ocr_data.parsed.grandTotal) 
                      : '-'} 
                    isMatch={!transaction.ocr_data.mismatches?.find(m => m.field === 'amount')}
                  />
                </div>

                {/* Items Detected in Doc */}
                {transaction.ocr_data.parsed?.items?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-dark-500 uppercase tracking-widest mb-3">Item Terdeteksi di Dokumen</p>
                    <div className="bg-dark-900/30 rounded-xl border border-dark-700/50 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-dark-800/50 border-b border-dark-700/50">
                          <tr>
                            <th className="text-left py-2 px-3 text-dark-400 font-medium">Deskripsi</th>
                            <th className="text-right py-2 px-3 text-dark-400 font-medium">Qty</th>
                            <th className="text-right py-2 px-3 text-dark-400 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-800/50">
                          {transaction.ocr_data.parsed.items.map((item, i) => (
                            <tr key={i} className="hover:bg-dark-800/30">
                              <td className="py-2 px-3 text-dark-200">{item.description}</td>
                              <td className="py-2 px-3 text-right text-dark-400">{item.qty}</td>
                              <td className="py-2 px-3 text-right text-dark-100 font-medium">
                                {item.totalAmount ? item.totalAmount.toLocaleString('id-ID') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          {transaction?.timeline && transaction.timeline.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-sky-400" />
                Timeline
              </h3>
              <div className="space-y-4">
                {transaction.timeline.map((event, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary-500" />
                      {index < transaction.timeline.length - 1 && (
                        <div className="w-0.5 flex-1 bg-dark-700 mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-dark-100">{event.action}</p>
                      <p className="text-sm text-dark-400">
                        {event.actor_alias} • {new Date(event.created_at).toLocaleString('id-ID')}
                      </p>
                      {event.details && (
                        <p className="text-sm text-dark-500 mt-1">{JSON.stringify(event.details)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Action Panel */}
        <div className="space-y-6">
          {/* Decision Panel - Only show if pending */}
          {['submitted', 'resubmitted'].includes(transaction?.status) && (
            <div className="glass-card p-6 sticky top-6 border-l-4 border-primary-500">
              <h3 className="text-lg font-semibold text-dark-100 mb-4">Keputusan</h3>
              
              {/* Approval Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Catatan Review (Opsional)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Tambahkan catatan untuk admin..."
                  className="input-field w-full h-24 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="w-full btn-primary py-4 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
                >
                  {processing ? (
                    <div className="spinner-sm" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Approve Transaksi
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowClarifyModal(true)}
                  disabled={processing}
                  className="w-full py-3 flex items-center justify-center gap-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors font-medium border border-amber-500/30"
                >
                  <MessageSquare className="w-5 h-5" />
                  Minta Revisi
                </button>

                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="w-full py-3 flex items-center justify-center gap-2 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30 transition-colors font-medium"
                >
                  <XCircle className="w-5 h-5" />
                  Tolak Transaksi
                </button>
              </div>

              {/* Warning for High Risk */}
              {transaction?.risk_level === 'high' && (
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-amber-300 font-medium text-sm">Perhatian</p>
                      <p className="text-amber-400/70 text-xs mt-1">
                        Transaksi ini ditandai sebagai High Risk. Mohon verifikasi dengan teliti sebelum mengambil keputusan.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Badge for Processed Items */}
          {!['submitted', 'resubmitted'].includes(transaction?.status) && (
            <div className="glass-card p-6 sticky top-6 border-l-4 border-emerald-500">
              <h3 className="text-lg font-semibold text-dark-100 mb-4">Status Keputusan</h3>
              <div className={`p-4 rounded-xl flex items-center gap-3 ${
                transaction?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {transaction?.status === 'approved' ? <CheckCircle /> : <XCircle />}
                <div>
                  <p className="font-bold capitalize">{transaction?.status}</p>
                  <p className="text-xs opacity-70">Laporan ini sudah diproses dan tidak dapat diubah lagi.</p>
                </div>
              </div>
              <button 
                onClick={() => router.push('/dashboard/approval/queue')}
                className="btn-ghost w-full mt-4"
              >
                Kembali ke Antrian
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clarify Modal - Return to Admin for Revision */}
      {showClarifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <MessageSquare className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-dark-100">Minta Revisi</h3>
            </div>
            
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
              <p className="text-sm text-amber-300">
                <strong>Transaksi akan dikembalikan ke Admin</strong> untuk direvisi dan dapat disubmit ulang setelah diperbaiki.
              </p>
            </div>

            <p className="text-dark-400 mb-4">
              Jelaskan apa yang perlu diperbaiki atau diklarifikasi.
            </p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <button 
                onClick={() => setClarifyReason('Dokumen pendukung tidak lengkap/buram. Mohon upload ulang.')}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700"
              >
                Template: Dokumen Kurang
              </button>
              <button 
                onClick={() => setClarifyReason('Nominal transaksi tidak sesuai dengan invoice terlampir.')}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700"
              >
                Template: Nominal Beda
              </button>
              <button 
                onClick={() => setClarifyReason('Mohon jelaskan tujuan pembayaran dan urgensi transaksi ini.')}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700"
              >
                Template: Butuh Penjelasan
              </button>
            </div>

            <textarea
              value={clarifyReason}
              onChange={(e) => setClarifyReason(e.target.value)}
              placeholder="Jelaskan apa yang perlu diperbaiki (minimal 10 karakter)..."
              className="input-field w-full h-32 resize-none mb-4"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowClarifyModal(false)}
                className="flex-1 btn-ghost"
              >
                Batal
              </button>
              <button
                onClick={handleClarify}
                disabled={processing || clarifyReason.length < 10}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-400 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Memproses...' : 'Kirim Permintaan Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal - Permanent Rejection */}
      {showRejectModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-6 w-full max-w-lg animate-slide-up shadow-2xl shadow-rose-500/10 border-rose-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-xl font-bold text-dark-100">Tolak Transaksi</h3>
            </div>
            
            <p className="text-dark-400 mb-4">
              Berikan alasan penolakan yang jelas. Admin akan menerima notifikasi sesuai opsi yang Anda pilih.
            </p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <button 
                onClick={() => setRejectReason('Transaksi tidak sesuai kebijakan perusahaan.')}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700 transition-colors"
              >
                Template: Kebijakan
              </button>
              <button 
                onClick={() => setRejectReason('Transaksi duplikat atau sudah pernah diproses.')}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700 transition-colors"
              >
                Template: Duplikat
              </button>
              <button 
                onClick={() => setRejectReason('Dokumen tidak valid atau terindikasi manipulasi.')}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700 transition-colors"
              >
                Template: Dokumen Tidak Valid
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan (minimal 10 karakter)..."
              className="input-field w-full h-32 resize-none mb-6 border-rose-500/20 focus:border-rose-500/50"
              autoFocus
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => handleReject('request_new')}
                disabled={processing || rejectReason.length < 10}
                className="flex flex-col items-center justify-center p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-sm font-bold text-amber-400">Reject & Buat Baru</span>
                <span className="text-[10px] text-amber-500/70 text-center mt-1">Admin disuruh buat transaksi baru yang serupa</span>
              </button>

              <button
                onClick={() => handleReject('permanent')}
                disabled={processing || rejectReason.length < 10}
                className="flex flex-col items-center justify-center p-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-sm font-bold text-rose-400">Reject & Tutup</span>
                <span className="text-[10px] text-rose-500/70 text-center mt-1">Transaksi di-reject & tidak perlu buat baru</span>
              </button>
            </div>

            <button
              onClick={() => setShowRejectModal(false)}
              className="w-full mt-4 py-2 text-dark-500 hover:text-dark-300 text-sm transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-full">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-dark-100 mb-2 text-center">Konfirmasi Approve</h3>
            <p className="text-dark-400 mb-6 text-center">
              Apakah yakin untuk approve laporan ini?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={processing}
                className="flex-1 py-3 bg-dark-800 text-dark-400 rounded-xl hover:bg-dark-700 hover:text-dark-200 transition-all font-semibold"
              >
                No
              </button>
              <button
                onClick={confirmApprove}
                disabled={processing}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all font-semibold flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="spinner-sm border-white/30 border-t-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Yes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-dark-800 rounded-lg text-dark-400">
        {icon}
      </div>
      <div>
        <p className="text-xs text-dark-500">{label}</p>
        <p className="font-medium text-dark-200">{value}</p>
      </div>
    </div>
  );
}

function OcrField({ label, value, isMatch }) {
  return (
    <div className={`p-3 rounded-xl border ${isMatch ? 'bg-dark-800/20 border-dark-700/50' : 'bg-rose-500/5 border-rose-500/20 shadow-lg shadow-rose-500/5'}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold text-dark-500 uppercase tracking-wider">{label}</p>
        {isMatch ? (
          <CheckCircle className="w-3 h-3 text-emerald-500/50" />
        ) : (
          <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" />
        )}
      </div>
      <p className={`text-sm font-medium ${isMatch ? 'text-dark-200' : 'text-rose-400'}`}>
        {value || '(Kosong)'}
      </p>
    </div>
  );
}
