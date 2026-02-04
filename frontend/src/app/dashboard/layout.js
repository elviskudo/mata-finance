'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  PlusCircle,
  Edit3,
  AlertCircle,
  Activity,
  HelpCircle,
  Send,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { alertAPI } from '@/lib/api';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token) {
      router.push('/login');
      return;
    }

    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        console.error('Invalid user in localStorage:', e);
        localStorage.removeItem('user');
      }
    }

    fetchAlertCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAlertCount = async () => {
    try {
      const response = await alertAPI.getCount();
      if (response?.data?.success) {
        setAlertCount(Number(response.data.data?.unread ?? 0));
      }
    } catch (error) {
      console.error('Error fetching alert count:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const role = String(user?.role ?? '').toLowerCase();

  // Determine home path based on role
  const homePath = role === 'approval' ? '/dashboard/approval' : '/dashboard/admin';

  const allNavItems = [
    { href: homePath, icon: Home, label: 'Home' },
    { href: '/dashboard/approval/emergency', icon: ShieldAlert, label: 'Emergency Requests', roles: ['approval'] },
    { href: '/dashboard/approval/queue', icon: FileText, label: 'Antrian Approval', roles: ['approval'] },
    { href: '/dashboard/admin/transactions/new', icon: PlusCircle, label: 'Input Transaksi', roles: ['admin_finance'] },
    { href: '/dashboard/admin/draft', icon: FileText, label: 'Draft', roles: ['admin_finance'] },
    { href: '/dashboard/admin/revision', icon: Edit3, label: 'Revisi', roles: ['admin_finance'] },
    { href: '/dashboard/admin/submission-timeline', icon: Send, label: 'Submission Timeline', roles: ['admin_finance'] },
    { href: '/dashboard/admin/exceptions', icon: AlertCircle, label: 'My Exceptions', badge: alertCount, roles: ['admin_finance'] },
    { href: '/dashboard/admin/activity', icon: Activity, label: 'Activity Saya', roles: ['admin_finance'] },
    { href: '/dashboard/approval/activity', icon: Activity, label: 'Activity Saya', roles: ['approval'] },
    { href: '/dashboard/admin/help', icon: HelpCircle, label: 'Help & SOP', roles: ['admin_finance'] },
    { href: '/dashboard/approval/help', icon: HelpCircle, label: 'Help & SOP', roles: ['approval'] },
  ];

  const navItems = allNavItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });



  const pageTitle = (() => {
    if (pathname === '/dashboard') return 'Home';
    if (pathname === '/dashboard/admin') return 'Admin Finance Dashboard';
    if (pathname === '/dashboard/approval') return 'Approval Dashboard';
    if (pathname === '/dashboard/approval/emergency') return 'Emergency Requests';
    if (pathname === '/dashboard/approval/queue') return 'Antrian Approval';
    if (pathname.startsWith('/dashboard/approval/review')) return 'Review Transaksi';
    if (pathname === '/dashboard/admin/transactions/new') return 'Input Transaksi';
    if (pathname === '/dashboard/admin/transactions') return 'Transaksi';
    if (pathname === '/dashboard/admin/draft') return 'Draft';
    if (pathname === '/dashboard/admin/revision') return 'Revisi';
    if (pathname === '/dashboard/admin/submission-timeline') return 'Submission Timeline';
    if (pathname === '/dashboard/admin/exceptions') return 'My Exceptions';
    if (pathname === '/dashboard/admin/activity') return 'Activity Saya';
    if (pathname === '/dashboard/approval/activity') return 'Activity Saya';
    if (pathname === '/dashboard/admin/help') return 'Help & SOP';
    if (pathname === '/dashboard/approval/help') return 'Help & SOP';
    if (pathname === '/dashboard/alerts') return 'Peringatan';
    return '';
  })();


  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed dengan max-h-screen, tidak scroll */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50
        h-screen max-h-screen
        transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full max-h-screen overflow-hidden">
          {/* Logo */}
          <div className="p-6 border-b border-dark-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <span className="text-lg font-bold text-white">MF</span>
              </div>
              <div>
                <h1 className="font-bold text-dark-100">Mata Finance</h1>
                <p className="text-xs text-dark-400">Admin Dashboard</p>
              </div>
            </div>
          </div>

          {/* Navigation - Scrollable jika menu terlalu banyak */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  {Number(item.badge ?? 0) > 0 && (
                    <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-medium rounded-full">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-dark-700/50">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dark-100 truncate">{user?.publicAlias ?? user?.loginId?.slice(0, 8) ?? '-'}</p>
                  <p className="text-xs text-dark-400 truncate capitalize">{user?.role?.replace('_', ' ') ?? '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Scrollable area */}
      <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden">
        {/* Top Header - Fixed */}
        <header className="flex-shrink-0 sticky top-0 z-30 bg-dark-950/80 backdrop-blur-xl border-b border-dark-700/50">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Page Title */}
            <div className="hidden lg:block">
              <h2 className="text-xl font-semibold text-dark-100">{pageTitle}</h2>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* Alerts Button */}
              <Link
                href="/dashboard/alerts"
                className="relative p-2 text-dark-400 hover:text-primary-400 rounded-lg hover:bg-primary-500/10 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </Link>

              {/* User Menu */}
              <div className="relative z-40">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-dark-400 transition-transform ${
                      userMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 glass-card py-2 shadow-xl animate-fade-in">
                    <div className="px-4 py-3 border-b border-dark-700/50">
                      <p className="font-medium text-dark-100">{user?.publicAlias ?? 'Anonymous'}</p>
                      <p className="text-sm text-dark-400">Login ID: {user?.loginId?.slice(0, 8) ?? '...'}</p>
                    </div>

                    <div className="py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Keluar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</main>
      </div>

      {/* Click outside to close user menu */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)} />
      )}
    </div>
  );
}
