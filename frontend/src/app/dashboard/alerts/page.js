'use client';

import { useState, useEffect } from 'react';
import {
  Bell, AlertTriangle, Clock, FileText, RefreshCw, Check, CheckCheck, Info, XCircle
} from 'lucide-react';
import { alertAPI } from '@/lib/api';

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await alertAPI.getAll({ unreadOnly: false });
      if (response.data.success) {
        setAlerts(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await alertAPI.markAsRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
    } catch (error) {
      console.error('Error marking alert:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await alertAPI.markAllAsRead();
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
    } catch (error) {
      console.error('Error marking all alerts:', error);
    }
  };

  const unreadAlerts = alerts.filter(a => !a.isRead);
  const readAlerts = alerts.filter(a => a.isRead);
  const unreadCount = unreadAlerts.length;

  const getAlertIcon = (type, severity) => {
    if (severity === 'critical') return <XCircle className="w-5 h-5" />;
    if (severity === 'warning') return <AlertTriangle className="w-5 h-5" />;
    if (type === 'sla_warning') return <Clock className="w-5 h-5" />;
    if (type === 'draft_expiring') return <FileText className="w-5 h-5" />;
    return <Info className="w-5 h-5" />;
  };

  const getSeverityStyles = (severity) => {
    const styles = {
      critical: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      info: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    };
    return styles[severity] || styles.info;
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
            <Bell className="w-7 h-7 text-primary-400" />
            Peringatan
            {unreadCount > 0 && (
              <span className="px-2.5 py-1 bg-rose-500 text-white text-sm font-medium rounded-full">
                {unreadCount} belum dibaca
              </span>
            )}
          </h1>
          <p className="text-dark-400 mt-1">Peringatan dan notifikasi personal Anda</p>
        </div>
        <div className="flex gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="btn-primary flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Tandai Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={<XCircle className="w-6 h-6" />}
          label="Kritikal"
          count={alerts.filter(a => a.severity === 'critical' && !a.isRead).length}
          color="rose"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Peringatan"
          count={alerts.filter(a => a.severity === 'warning' && !a.isRead).length}
          color="amber"
        />
        <SummaryCard
          icon={<Info className="w-6 h-6" />}
          label="Informasi"
          count={alerts.filter(a => a.severity === 'info' && !a.isRead).length}
          color="sky"
        />
      </div>

      <div className="space-y-8">
        {/* Latest Notifications Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-lg font-bold text-dark-100 uppercase tracking-wider">Notifikasi Terbaru</h2>
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </div>
          
          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="spinner"></div>
              </div>
            ) : unreadAlerts.length > 0 ? (
              <div className="divide-y divide-dark-700/50">
                {unreadAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} onMarkAsRead={handleMarkAsRead} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto text-dark-600 mb-3" />
                <p className="text-dark-400">Tidak ada notifikasi baru hari ini.</p>
              </div>
            )}
          </div>
        </section>

        {/* History Section */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-lg font-bold text-dark-400 uppercase tracking-wider">History Notifikasi</h2>
          </div>
          
          <div className="glass-card overflow-hidden bg-dark-900/20 grayscale-[0.2]">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="spinner"></div>
              </div>
            ) : readAlerts.length > 0 ? (
              <div className="divide-y divide-dark-700/50">
                {readAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} onMarkAsRead={handleMarkAsRead} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-dark-600 mb-3 opacity-50" />
                <p className="text-dark-500">Belum ada history notifikasi.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={fetchAlerts}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Muat Ulang
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, count, color }) {
  const colorClasses = {
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30',
    sky: 'from-sky-500/20 to-sky-500/5 text-sky-400 border-sky-500/30',
  };

  return (
    <div className={`glass-card p-5 bg-gradient-to-br ${colorClasses[color]} border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-dark-100">{count}</p>
          <p className="text-sm text-dark-400">{label}</p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AlertItem({ alert, onMarkAsRead }) {
  const getAlertIcon = (type, severity) => {
    if (severity === 'critical') return <XCircle className="w-5 h-5" />;
    if (severity === 'warning') return <AlertTriangle className="w-5 h-5" />;
    if (type === 'sla_warning') return <Clock className="w-5 h-5" />;
    if (type === 'draft_expiring') return <FileText className="w-5 h-5" />;
    return <Info className="w-5 h-5" />;
  };

  const getSeverityStyles = (severity) => {
    const styles = {
      critical: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      info: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    };
    return styles[severity] || styles.info;
  };

  return (
    <div
      className={`p-5 transition-all duration-300 ${
        alert.isRead ? 'bg-transparent opacity-70' : 'bg-dark-800/30 border-l-2 border-l-primary-500'
      } hover:bg-dark-800/50 group`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-3 rounded-xl border transition-transform group-hover:scale-110 ${getSeverityStyles(alert.severity)}`}>
          {getAlertIcon(alert.type, alert.severity)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className={`font-semibold transition-colors ${alert.isRead ? 'text-dark-400' : 'text-dark-100'}`}>
                {alert.title}
              </h3>
              <p className={`mt-1 text-sm ${alert.isRead ? 'text-dark-500' : 'text-dark-300'}`}>{alert.message}</p>
            </div>
            {!alert.isRead && (
              <button
                onClick={() => onMarkAsRead(alert.id)}
                className="p-2 text-dark-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors shrink-0"
                title="Tandai sudah dibaca"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
              alert.severity === 'critical' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
              alert.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
              'bg-sky-500/10 text-sky-400 border border-sky-500/20'
            }`}>
              {alert.severity === 'critical' ? 'Kritikal' :
               alert.severity === 'warning' ? 'Peringatan' : 'Info'}
            </span>
            <span className="text-xs text-dark-500 font-mono">
              {new Date(alert.createdAt).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            {alert.relatedEntity && (
              <span className="text-xs text-dark-600 bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
                {alert.relatedEntity.type}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
