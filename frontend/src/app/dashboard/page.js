'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Get user from localStorage and redirect based on role
    const userStr = localStorage.getItem('user');
    
    if (!userStr) {
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const role = String(user?.role ?? '').toLowerCase();

      if (role === 'approval') {
        router.replace('/dashboard/approval');
      } else if (role === 'admin_finance' || role.includes('finance')) {
        router.replace('/dashboard/admin');
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.error('Failed to parse user:', e);
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4">
        <div className="spinner"></div>
        <p className="text-dark-400">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
