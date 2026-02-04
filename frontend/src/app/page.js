'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Shield, Zap, BarChart3, Lock } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        {/* Logo/Brand */}
        <div className="mb-8 animate-float">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 
                          flex items-center justify-center shadow-glow-lg">
            <span className="text-3xl font-bold text-white">MF</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-6xl font-bold text-center mb-6 animate-in">
          <span className="gradient-text">Mata Finance</span>
        </h1>
        
        <p className="text-xl text-dark-400 text-center max-w-2xl mb-12 animate-in" style={{ animationDelay: '0.1s' }}>
          Platform manajemen keuangan modern untuk Admin Finance. 
          Kelola transaksi, pantau SLA, dan tingkatkan produktivitas kerja Anda.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 animate-in" style={{ animationDelay: '0.2s' }}>
          <Link href="/login" className="btn-primary flex items-center justify-center gap-2 text-lg">
            Masuk ke Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/register" className="btn-secondary flex items-center justify-center text-lg">
            Daftar Akun Baru
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20 max-w-6xl w-full animate-in" 
             style={{ animationDelay: '0.3s' }}>
          <FeatureCard 
            icon={<BarChart3 className="w-6 h-6" />}
            title="Dashboard Interaktif"
            description="Pantau ringkasan kerja harian dan statistik transaksi secara real-time"
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6" />}
            title="SLA Tracking"
            description="Dapatkan peringatan otomatis untuk transaksi mendekati batas waktu"
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6" />}
            title="Keamanan Data"
            description="Akses terbatas hanya ke data transaksi pribadi Anda"
          />
          <FeatureCard 
            icon={<Lock className="w-6 h-6" />}
            title="Kontrol Akses"
            description="Sistem otorisasi berbasis peran untuk keamanan maksimal"
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-dark-500 text-sm border-t border-dark-800">
        <p>© 2024 Mata Finance. All rights reserved.</p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="glass-card-hover p-6">
      <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center mb-4 text-primary-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-dark-100 mb-2">{title}</h3>
      <p className="text-dark-400 text-sm">{description}</p>
    </div>
  );
}
