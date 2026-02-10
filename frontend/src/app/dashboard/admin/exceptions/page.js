'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertOctagon, RefreshCcw, ArrowRight, Loader2, CheckCircle, XCircle, Save, Edit } from 'lucide-react';
import { exceptionAPI, helpAPI } from '@/lib/api';
import { useAlertModal } from '@/components/AlertModal';

export default function MyExceptionsPage() {
  const router = useRouter();
  const alertModal = useAlertModal();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [patchData, setPatchData] = useState({});
  const [recheckLoading, setRecheckLoading] = useState(false);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const response = await exceptionAPI.getAll();
      if (response?.data?.success) {
        setCases(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCase = async (caseItem) => {
    try {
      const response = await exceptionAPI.getById(caseItem.id);
      if (response?.data?.success) {
        setSelectedCase(response.data.data);
        setPatchData(response.data.data.patch || {});
      }
    } catch (error) {
      console.error('Error fetching case details:', error);
    }
  };

  const handlePatchChange = (field, value) => {
    setPatchData(prev => ({ ...prev, [field]: value }));
  };

  const handleSavePatch = async () => {
    if (!selectedCase) return;
    try {
      await exceptionAPI.patch(selectedCase.id, patchData);
      // Refresh case details
      await handleSelectCase(selectedCase);
      fetchCases(); // Refresh list
    } catch (error) {
      console.error('Error saving patch:', error);
    }
  };

  const handleRecheck = async () => {
    if (!selectedCase) return;
    setRecheckLoading(true);
    try {
      const response = await exceptionAPI.recheck(selectedCase.id);
      if (response?.data?.success) {
        if (response.data.data.match) {
          alertModal.success('Berhasil! Transaksi telah divalidasi dengan patch dan dikirim ke Approval.');
          if (response.data.data.redirect) {
            router.push(response.data.data.redirect);
          } else {
            setSelectedCase(null);
            fetchCases();
          }
        } else {
          // Update mismatch summary
          setSelectedCase(prev => ({
            ...prev,
            mismatch_summary: response.data.data.summary
          }));
          alertModal.warning('Validasi ulang masih menemukan selisih: ' + response.data.data.summary);
        }
      }
    } catch (error) {
      console.error('Error rechecking:', error);
      alertModal.error('Gagal melakukan validasi ulang: ' + (error.response?.data?.message || error.message));
    } finally {
      setRecheckLoading(false);
    }
  };

  const isFieldAllowed = (field) => {
    return selectedCase?.allowlist?.includes(field);
  };

  const fetchSOP = async (contextType, contextCode) => {
    try {
      const response = await helpAPI.getSOP(contextType, contextCode);
      if (response.data.success) {
        setSop(response.data.data);
        setShowSopModal(true);
      }
    } catch (err) {
      console.error('Failed to fetch SOP:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in">
        {/* Header */}
        <div className="flex items-center gap-3">
           <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <AlertOctagon className="w-8 h-8" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-dark-100">My Exceptions</h1>
             <p className="text-dark-400">Daftar Exception Cases untuk diperbaiki sebelum submit</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cases List */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-amber-400 mb-4 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" /> Open Exception Cases
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              </div>
            ) : cases.length > 0 ? (
              <div className="space-y-4">
                {cases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                      selectedCase?.id === caseItem.id
                        ? 'bg-amber-500/20 border-amber-500/40'
                        : 'bg-dark-800/50 border-dark-700 hover:bg-dark-800/70'
                    }`}
                    onClick={() => handleSelectCase(caseItem)}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-dark-100">{caseItem.transaction_code}</span>
                      <span className="text-xs text-amber-300">
                        {new Date(caseItem.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-dark-300">{caseItem.description}</p>
                    <p className="text-sm text-amber-400 mt-1">Amount: Rp {caseItem.amount?.toLocaleString()}</p>
                    <p className="text-xs text-dark-400 mt-1">{caseItem.mismatch_summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-dark-400">Tidak ada exception cases.</p>
            )}
          </div>

          {/* Case Details & Patch Form */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-blue-400 mb-4 flex items-center gap-2">
              <Edit className="w-5 h-5" /> Patch Exception Case
            </h3>
            {selectedCase ? (
              <div className="space-y-4">
                <div className="p-4 bg-dark-800/50 rounded-xl">
                  <h4 className="font-medium text-dark-100 mb-2">Transaction Details</h4>
                  <p className="text-sm text-dark-300">Code: {selectedCase.transaction_code}</p>
                  <p className="text-sm text-dark-300">Amount: Rp {selectedCase.amount?.toLocaleString()}</p>
                  <p className="text-sm text-dark-300">Recipient: {selectedCase.recipient_name}</p>
                  <p className="text-sm text-amber-400 mt-2">Mismatch: {selectedCase.mismatch_summary}</p>
                  <p className="text-sm text-blue-400 mt-1">Allowed fields: {selectedCase.allowlist?.join(', ')}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-dark-100">Patch Corrections</h4>

                  {isFieldAllowed('recipient_name') && (
                    <div>
                      <label className="block text-sm text-dark-300 mb-1">Recipient Name</label>
                      <input
                        type="text"
                        value={patchData.recipient_name || selectedCase.recipient_name || ''}
                        onChange={(e) => handlePatchChange('recipient_name', e.target.value)}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100"
                      />
                    </div>
                  )}

                  {isFieldAllowed('amount') && (
                    <div>
                      <label className="block text-sm text-dark-300 mb-1">Amount</label>
                      <input
                        type="number"
                        value={patchData.amount || selectedCase.amount || ''}
                        onChange={(e) => handlePatchChange('amount', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100"
                      />
                    </div>
                  )}

                  {isFieldAllowed('due_date') && (
                    <div>
                      <label className="block text-sm text-dark-300 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={patchData.due_date || selectedCase.due_date?.split('T')[0] || ''}
                        onChange={(e) => handlePatchChange('due_date', e.target.value)}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100"
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleSavePatch}
                      className="btn-primary py-2 px-4 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Patch
                    </button>
                    <button
                      onClick={handleRecheck}
                      disabled={recheckLoading}
                      className="btn-secondary py-2 px-4 flex items-center gap-2"
                    >
                      {recheckLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                      Validasi Ulang
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-dark-400">Select an exception case to patch</p>
            )}
          </div>
        </div>
     </div>
   );
}
