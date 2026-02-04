'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Loader2, Shield } from 'lucide-react';
import { authAPI } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData.email, formData.password);
      if (response.data.success) {
        const { user, token } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-dark-950">
      <div className="w-full max-w-6xl">
        {/* Back Button */}
        <div className="max-w-4xl mx-auto lg:mx-0">
          <Link href="/" className="inline-flex items-center gap-2 text-dark-400 hover:text-primary-400 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
          {/* Left: Login Card */}
          <div className="glass-card p-10 flex-1 w-full max-w-2xl">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary-500 to-accent-500 
                              flex items-center justify-center shadow-glow mb-6 scale-110 lg:scale-125">
                <span className="text-3xl font-bold text-white">MF</span>
              </div>
              <h1 className="text-3xl font-bold text-dark-100 mb-2">Selamat Datang</h1>
              <p className="text-dark-400 text-lg">Masuk ke akun Anda</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-dark-200 ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 group-focus-within:text-primary-400 transition-colors" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field pl-12 h-14 bg-dark-800/50"
                    placeholder="email@perusahaan.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-dark-200 ml-1">
                  Secure Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 group-focus-within:text-primary-400 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field pl-12 pr-12 h-14 bg-dark-800/50"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-14 flex items-center justify-center gap-3 text-lg font-bold shadow-lg shadow-primary-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  'Masuk ke Dashboard'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-10 text-center border-t border-dark-700/50 pt-8">
              <p className="text-dark-400 font-medium">
                Belum memiliki akses?{' '}
                <Link href="/register" className="text-primary-400 hover:text-primary-300 font-bold underline-offset-4 hover:underline transition-all">
                  Request Akun Baru
                </Link>
              </p>
            </div>
          </div>

          {/* Right: Side Info & Credentials */}
          <div className="w-full lg:w-96 shrink-0 space-y-6">
            {/* Anonymity Notice */}
            <div className="p-7 bg-dark-800/40 border border-dark-700/50 rounded-[2rem] backdrop-blur-md shadow-xl">
              <div className="flex items-start gap-5">
                <div className="p-3 bg-primary-500/10 rounded-2xl text-primary-400 ring-1 ring-primary-500/20">
                  <Shield className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-dark-100 font-bold text-lg mb-1 tracking-tight">Financial Privacy</p>
                  <p className="text-dark-400 text-sm leading-relaxed">
                    Sistem ini terenkripsi end-to-end. Sesuai kebijakan perusahaan, identitas pribadi dikonversi menjadi Alias Publik untuk kepatuhan audit.
                  </p>
                </div>
              </div>
            </div>

            {/* Demo Credentials */}
            <div className="glass-card p-8 border-t-8 border-t-primary-500 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary-500/10 transition-colors"></div>
              
              <h3 className="text-base font-black text-dark-100 mb-6 flex items-center gap-3 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                Sandbox Mode
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-dark-900/80 rounded-2xl border border-dark-700 hover:border-primary-500/50 transition-all group/item">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black text-primary-500 uppercase">Administrator</p>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                  <p className="text-sm text-dark-100 font-mono tracking-tighter truncate selection:bg-primary-500/30">finance1@test.com</p>
                </div>
                
                <div className="p-4 bg-dark-900/80 rounded-2xl border border-dark-700 hover:border-accent-500/50 transition-all group/item">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black text-accent-500 uppercase">Approver</p>
                  </div>
                  <p className="text-sm text-dark-100 font-mono tracking-tighter truncate selection:bg-accent-500/30">approval1@test.com</p>
                </div>

                <div className="pt-4 text-center">
                  <div className="inline-block px-4 py-1 bg-dark-900 rounded-full border border-dark-700 mb-2">
                    <p className="text-[10px] text-dark-500 font-black uppercase tracking-[0.2em]">Universal Key</p>
                  </div>
                  <p className="text-xl font-black text-white selection:bg-primary-500">password123</p>
                </div>
              </div>
            </div>

            {/* Auth Service Status */}
            <div className="p-5 bg-green-500/5 rounded-2xl border border-green-500/10 flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-green-500"></div>
               <p className="text-[11px] text-dark-400 font-medium">All authentication services are operational</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
