'use client';

import { useState, useEffect } from 'react';
import { Activity, Clock, Calendar, RefreshCw } from 'lucide-react';
import { dashboardAPI } from '../../../../lib/api';

export default function ActivityPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getActivity({ limit: 50 });
      setActivities(response.data.data);
      setError(null);
    } catch (err) {
      setError('Gagal memuat aktivitas');
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const formatActivity = (activity) => {
    const { action, entityType, entityId, details, createdAt } = activity;
    const timestamp = new Date(createdAt).toLocaleString('id-ID');

    let description = '';
    let iconColor = 'border-dark-500';

    switch (action) {
      case 'LOGIN':
        description = 'Log Masuk Sistem';
        iconColor = 'border-green-500';
        break;
      case 'INIT_TRANSACTION':
        description = `Memulai Draft Baru (${details?.type || 'Transaksi'})`;
        iconColor = 'border-blue-500';
        break;
      case 'CREATE_TRANSACTION':
        description = 'Membuat Transaksi Baru';
        iconColor = 'border-blue-500';
        break;
      case 'SAVE_DRAFT':
        description = `Menyimpan Draft (${details?.action || 'update'})`;
        iconColor = 'border-yellow-500';
        break;
      case 'UPLOAD_DOCUMENT':
        description = `Upload Dokumen (${details?.fileName || 'file'})`;
        iconColor = 'border-purple-500';
        break;
      case 'SUBMIT_TRANSACTION':
        description = 'Submit Transaksi';
        iconColor = 'border-orange-500';
        break;
      case 'CREATE_EXCEPTION_CASE':
        description = 'Membuat Exception Case';
        iconColor = 'border-red-500';
        break;
      case 'SAVE_REVISION':
        description = 'Menyimpan Revisi';
        iconColor = 'border-indigo-500';
        break;
      default:
        description = action;
        iconColor = 'border-dark-500';
    }

    if (entityId && entityType === 'transaction') {
      description += ` <span class="text-primary-400">${entityId}</span>`;
    }

    return { description, timestamp, iconColor };
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-500/10 rounded-xl text-primary-400">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Aktivitas Saya</h1>
            <p className="text-dark-400">Log kerja dan histori aktivitas Anda</p>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-primary-400" />
            <span className="ml-2 text-dark-400">Memuat aktivitas...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-in">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-500/10 rounded-xl text-primary-400">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Aktivitas Saya</h1>
            <p className="text-dark-400">Log kerja dan histori aktivitas Anda</p>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="text-center py-8">
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchActivities}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
       {/* Header */}
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-primary-500/10 rounded-xl text-primary-400">
                <Activity className="w-8 h-8" />
             </div>
             <div>
               <h1 className="text-2xl font-bold text-dark-100">Aktivitas Saya</h1>
               <p className="text-dark-400">Log kerja dan histori aktivitas Anda</p>
             </div>
          </div>
          <button
            onClick={fetchActivities}
            className="p-2 bg-dark-800 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-dark-100"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
       </div>

       {/* Timeline */}
       <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-dark-100 mb-6">Timeline Aktivitas</h3>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-dark-400">Belum ada aktivitas tercatat</p>
            </div>
          ) : (
            <div className="space-y-6 border-l-2 border-dark-700 ml-3 pl-6 relative">
              {activities.map((activity, index) => {
                const { description, timestamp, iconColor } = formatActivity(activity);
                return (
                  <div key={activity.id || index} className="relative">
                    <span className={`absolute -left-[33px] bg-dark-900 border-2 ${iconColor} w-4 h-4 rounded-full`}></span>
                    <p className="text-xs text-dark-400 mb-1">{timestamp}</p>
                    <p className="text-dark-100 font-medium" dangerouslySetInnerHTML={{ __html: description }} />
                  </div>
                );
              })}
            </div>
          )}
       </div>

       {/* Insights */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6">
             <h3 className="font-semibold text-dark-100 mb-4">Pola Kerja</h3>
             <div className="flex items-center gap-4">
               <div className="p-4 bg-dark-800 rounded-xl text-center flex-1">
                 <Clock className="w-6 h-6 mx-auto text-primary-400 mb-2" />
                 <p className="text-2xl font-bold text-dark-100">09-11</p>
                 <p className="text-xs text-dark-400">Jam Puncak Input</p>
               </div>
               <div className="p-4 bg-dark-800 rounded-xl text-center flex-1">
                 <Calendar className="w-6 h-6 mx-auto text-primary-400 mb-2" />
                 <p className="text-2xl font-bold text-dark-100">Senin</p>
                 <p className="text-xs text-dark-400">Hari Tersibuk</p>
               </div>
             </div>
          </div>
       </div>
    </div>
  );
}
