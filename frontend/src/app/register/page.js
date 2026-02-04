'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, User, Building2, ArrowLeft, Loader2, Shield } from 'lucide-react';
import { authAPI } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    department: '',
    role: 'admin_finance', // Default role
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

    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password minimal 8 karakter');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.register({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role,
        department: formData.department || undefined,
      });

      if (response.data.success) {
        const { user, token } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registrasi gagal. Silakan coba lagi.');
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

        <div className="flex flex-col lg:flex-row gap-10 items-start">
          {/* Left: Register Card */}
          <div className="glass-card p-10 flex-[1.5] w-full">
            {/* Header */}
            <div className="text-center lg:text-left mb-10">
               <div className="hidden lg:flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 
                                flex items-center justify-center shadow-glow">
                  <span className="text-xl font-bold text-white">MF</span>
                </div>
                <div>
                   <h1 className="text-2xl font-bold text-dark-100">Buat Akun Baru</h1>
                   <p className="text-dark-400">Bergabung dengan ekosistem keuangan anonim</p>
                </div>
              </div>

              {/* Mobile Header */}
              <div className="lg:hidden">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 
                                flex items-center justify-center shadow-glow mb-4">
                  <span className="text-2xl font-bold text-white">MF</span>
                </div>
                <h1 className="text-2xl font-bold text-dark-100 mb-2">Buat Akun Baru</h1>
                <p className="text-dark-400">Pilih peran dan lengkapi data Anda</p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Role Selection */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-dark-200 tracking-wider uppercase ml-1">
                  Pilih Peran Akses
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'admin_finance' })}
                    className={`p-6 rounded-2xl border-2 transition-all group ${
                      formData.role === 'admin_finance'
                        ? 'border-primary-500 bg-primary-500/10 text-primary-300 shadow-glow'
                        : 'border-dark-700 bg-dark-800/50 text-dark-400 hover:border-dark-600'
                    }`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="text-4xl group-hover:scale-110 transition-transform">📊</div>
                      <div>
                        <p className="font-bold text-lg mb-0.5">Admin Finance</p>
                        <p className="text-xs opacity-60">Manajemen & Input Transaksi</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'approval' })}
                    className={`p-6 rounded-2xl border-2 transition-all group ${
                      formData.role === 'approval'
                        ? 'border-accent-500 bg-accent-500/10 text-accent-300 shadow-glow-accent'
                        : 'border-dark-700 bg-dark-800/50 text-dark-400 hover:border-dark-600'
                    }`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="text-4xl group-hover:scale-110 transition-transform">✅</div>
                      <div>
                        <p className="font-bold text-lg mb-0.5">Approval</p>
                        <p className="text-xs opacity-60">Review & Otorisasi Keuangan</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-semibold text-dark-200 ml-1">
                    Nama Lengkap <span className="text-dark-500 font-normal italic">(Enkripsi Internal)</span>
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 group-focus-within:text-primary-400 transition-colors" />
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="input-field pl-12 h-14 bg-dark-800/50"
                      placeholder="Nama lengkap sesuai ID"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-dark-200 ml-1">
                    Email Kerja
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

                <div className="space-y-2 w-full">
                  <label htmlFor="department" className="block text-sm font-semibold text-dark-200 ml-1">
                    Departemen
                  </label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 group-focus-within:text-primary-400 transition-colors" />
                    <input
                      type="text"
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="input-field pl-12 h-14 bg-dark-800/50"
                      placeholder={formData.role === 'approval' ? 'Contoh: Finance Director' : 'Contoh: Admin AR'}
                    />
                  </div>
                </div>

                <div className="hidden md:block" />

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-semibold text-dark-200 ml-1">
                    Password
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
                      placeholder="Minimal 8 karakter"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-200"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-dark-200 ml-1">
                    Konfirmasi Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 group-focus-within:text-primary-400 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="input-field pl-12 h-14 bg-dark-800/50"
                      placeholder="Ulangi password"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full h-16 flex items-center justify-center gap-3 text-xl font-bold rounded-2xl shadow-xl shadow-primary-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Menciptakan Akun...
                    </>
                  ) : (
                    'Selesaikan Registrasi'
                  )}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-10 text-center border-t border-dark-700/50 pt-8">
              <p className="text-dark-400 font-medium">
                Sudah memiliki akses terdaftar?{' '}
                <Link href="/login" className="text-primary-400 hover:text-primary-300 font-bold underline-offset-4 hover:underline transition-all">
                  Masuk ke Dashboard
                </Link>
              </p>
            </div>
          </div>

          {/* Right: Sidebar Info */}
          <div className="w-full lg:w-80 shrink-0 space-y-6">
            {/* Identity Shield */}
            <div className="p-8 bg-dark-800/40 border border-dark-700/50 rounded-[2.5rem] backdrop-blur-md shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary-500/20 transition-colors"></div>
               
               <div className="relative z-10">
                <div className="p-4 bg-primary-500/10 rounded-2xl text-primary-400 ring-1 ring-primary-500/20 w-fit mb-6">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-dark-100 mb-3 tracking-tight">Identity Protection</h3>
                <p className="text-dark-400 text-sm leading-relaxed mb-4">
                  Kami menggunakan protokol anonimitas tingkat tinggi. Identitas asli Anda hanya digunakan untuk verifikasi sistem dan tidak akan pernah dipublikasikan di dashboard atau laporan umum.
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black text-primary-500 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></span>
                  Verified Anonymous
                </div>
               </div>
            </div>

            {/* Role Info */}
            <div className="glass-card p-6 border-l-4 border-l-primary-500">
               <h4 className="text-xs font-black text-dark-300 uppercase tracking-widest mb-4">Role Capabilities</h4>
               <ul className="space-y-4">
                 <li className="flex items-start gap-3">
                   <div className="mt-1 text-primary-500">✨</div>
                   <p className="text-xs text-dark-400 italic">"Admin Finance memiliki kontrol penuh atas alur kerja input data."</p>
                 </li>
                 <li className="flex items-start gap-3">
                   <div className="mt-1 text-accent-500">🛡️</div>
                   <p className="text-xs text-dark-400 italic">"Approval Officer memegang kunci otoritas pengeluaran dana."</p>
                 </li>
               </ul>
            </div>

            {/* Compliance Note */}
            <div className="p-5 bg-dark-900/50 rounded-2xl border border-dark-700">
               <p className="text-[10px] text-dark-500 leading-relaxed text-center">
                 Dengan mendaftar, Anda menyetujui seluruh kebijakan kerahasiaan data dan prosedur Standard Operating Procedure (SOP) perusahaan.
               </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
