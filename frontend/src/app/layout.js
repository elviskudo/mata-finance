import './globals.css';

export const metadata = {
  title: 'Mata Finance - Dashboard Admin Finance',
  description: 'Sistem manajemen keuangan untuk Admin Finance',
  keywords: ['finance', 'dashboard', 'admin', 'transaksi'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen mesh-bg">
        {children}
      </body>
    </html>
  );
}
