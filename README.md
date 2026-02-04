# Mata Finance - Dashboard Admin Finance

Aplikasi web full-stack untuk Dashboard Admin Finance dengan Next.js, Express.js, dan PostgreSQL.

## Fitur

- ✅ Autentikasi JWT (Login/Register)
- ✅ Dashboard Beranda dengan ringkasan kerja pribadi
- ✅ Manajemen Transaksi (CRUD)
- ✅ Peringatan SLA (mendekati batas waktu)
- ✅ Notifikasi Personal
- ✅ Kontrol Akses (hanya data pribadi)
- ✅ Akses terlarang ke data keuangan perusahaan

## Tech Stack

- **Frontend**: Next.js 14, TailwindCSS, Lucide Icons
- **Backend**: Express.js, Swagger API Docs
- **Database**: PostgreSQL dengan UUID
- **Auth**: JWT
- **Runtime**: Bun
- **Container**: Docker Compose

## Struktur Proyek

```
mata_finance/
├── backend/
│   ├── database/
│   │   └── init.sql           # Database schema
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js    # PostgreSQL connection
│   │   ├── middleware/
│   │   │   └── auth.middleware.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── dashboard.routes.js
│   │   │   ├── transaction.routes.js
│   │   │   └── alert.routes.js
│   │   ├── database/
│   │   │   └── seed.js        # Demo data seeder
│   │   └── index.js           # Express server
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.js
│   │   │   │   ├── page.js
│   │   │   │   ├── transactions/page.js
│   │   │   │   └── alerts/page.js
│   │   │   ├── login/page.js
│   │   │   ├── register/page.js
│   │   │   ├── layout.js
│   │   │   ├── page.js
│   │   │   └── globals.css
│   │   ├── lib/
│   │   │   └── api.js
│   │   └── context/
│   │       └── AuthContext.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
└── docker-compose.yml
```

## Menjalankan dengan Bun (Development)

### 1. Jalankan PostgreSQL dengan Docker

```bash
docker compose up postgres -d
```

### 2. Setup Backend

```bash
cd backend

# Copy environment
cp .env.example .env

# Install dependencies
bun install

# Seed demo data
bun run db:seed

# Run development server
bun run dev
```

Backend akan berjalan di http://localhost:3001

API Documentation: http://localhost:3001/api-docs

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
bun install

# Run development server
bun run dev
```

Frontend akan berjalan di http://localhost:3000

## Menjalankan dengan Docker Compose (Production)

```bash
# Build dan jalankan semua service
docker compose up --build -d

# Seed database (opsional)
docker exec -it mata_finance_backend bun run db:seed
```

## Demo Credentials

```
Email: admin@matafinance.com
Password: admin123
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register user baru
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get profile
- `GET /api/auth/validate` - Validate session

### Dashboard
- `GET /api/dashboard/summary` - Ringkasan beranda
- `GET /api/dashboard/activity` - Log aktivitas
- `GET /api/dashboard/company-data` - Data keuangan perusahaan (403 Forbidden)

### Transactions
- `GET /api/transactions` - List transaksi
- `GET /api/transactions/:id` - Detail transaksi
- `POST /api/transactions` - Buat transaksi
- `POST /api/transactions/:id/submit` - Kirim transaksi

### Alerts
- `GET /api/alerts` - List peringatan
- `GET /api/alerts/count` - Hitung belum dibaca
- `POST /api/alerts/:id/read` - Tandai dibaca
- `POST /api/alerts/read-all` - Tandai semua dibaca

## Sesuai Diagram Sequence

1. ✅ Validasi sesi & peran pengguna (JWT Middleware)
2. ✅ Pembatasan akses hanya data pribadi (guardPersonalData)
3. ✅ Hitung transaksi hari ini berdasarkan userId
4. ✅ Hitung draft aktif (tidak termasuk yang kedaluwarsa)
5. ✅ Hitung transaksi menunggu proses (submitted/under_review)
6. ✅ Peringatan SLA mendekati batas waktu
7. ✅ Peringatan personal (draft hampir habis, revisi tertunda)
8. ✅ Ringkasan aktivitas pribadi
9. ✅ Sanitasi data terlarang (kas perusahaan, laporan laba rugi, admin lain)
10. ✅ Akses terlarang menampilkan pesan pembatasan (403 Forbidden)

## License

MIT
