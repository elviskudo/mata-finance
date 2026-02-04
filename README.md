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

## 📚 API Reference (Swagger Style)

Seluruh request (kecuali Auth) harus menyertakan header:
`Authorization: Bearer <JWT_TOKEN>`

---

### 🔑 Module: Authentication (`/api/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/register` | Mendaftarkan pengguna baru (admin_finance / approval) |
| `POST` | `/login` | Mengautentikasi pengguna & mendapatkan token |
| `GET` | `/me` | Mendapatkan data profil pengguna yang sedang login |
| `GET` | `/validate` | Validasi apakah sesi/token masih aktif |
| `POST` | `/logout` | Mengakhiri sesi dan membuang token |

#### `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string (min 8)",
    "fullName": "string",
    "role": "admin_finance | approval",
    "department": "string"
  }
  ```
- **Responses**: `201 Created`, `400 Bad Request`

#### `POST /api/auth/login`
- **Request Body**:
  ```json
  { "email": "string", "password": "string" }
  ```
- **Responses**: `200 OK` (returns token), `401 Unauthorized`

---

### 📊 Module: Dashboard (`/api/dashboard`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/summary` | Ringkasan statistik performa kerja pribadi |
| `GET` | `/activity` | Daftar log aktivitas atau history tindakan user |
| `GET` | `/company-data` | Data keuangan konsolidasi (Hanya untuk simulasi 403) |

#### `GET /api/dashboard/summary`
- **Security**: Guard Personal Data (Hanya data milik user sendiri)
- **Response**:
  ```json
  {
    "today": { "transactionsCount": 5, "date": "2024-03-24" },
    "drafts": { "activeCount": 2 },
    "pending": { "count": 1 },
    "revisions": { "count": 1 },
    "slaWarnings": [],
    "alerts": [],
    "recentTransactions": []
  }
  ```

---

### 💸 Module: Transactions (`/api/transactions`)

Manajemen siklus hidup transaksi dari Draft hingga Approved.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | List transaksi pribadi (dengan filter) |
| `GET` | `/entry-hub` | Ringkasan cepat untuk menu Input Transaksi |
| `POST` | `/init` | **Step 1**: Inisialisasi ID dan Tipe Transaksi |
| `PUT` | `/:id/header` | **Step 2**: Simpan data vendor, tanggal, dan nilai |
| `POST` | `/:id/items` | **Step 3**: Simpan rincian item (multi-item) |
| `POST` | `/:id/upload` | **Step 4**: Upload bukti fisik & Trigger OCR |
| `GET` | `/:id/pre-check` | **Step 5**: Jalankan validasi silang (OCR vs Input) |
| `POST` | `/:id/submit` | Finalisasi & Kirim ke Approval Queue |
| `GET` | `/:id` | Mendapatkan detail lengkap satu transaksi |
| `GET` | `/:id/timeline` | Melihat sejarah status dan aktivitas transaksi |
| `PUT` | `/:id/draft` | Simpan sebagai draft (tidak terkunci) |

#### `GET /api/transactions`
- **Query Params**:
  - `status`: Filter status (e.g. `draft,returned,submitted`)
  - `type`: Filter tipe (e.g. `payment,expense`)
  - `limit`: Default 20
  - `offset`: Default 0

#### `POST /api/transactions/:id/submit`
- **Request Body**:
  ```json
  {
    "notes": "string",
    "isEmergency": "boolean",
    "emergencyReason": "string (required if emergency is true)"
  }
  ```
- **Responses**: `200 OK` (Submitted), `200 OK` (Exception Created if OCR Mismatch)

---

### ⚙️ Module: Revision Workflow

Khusus untuk menangani transaksi yang dikembalikan (`returned`) untuk diperbaiki.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/:id/revision-details` | Detail perbandingan data salah vs instruksi approver |
| `PUT` | `/:id/save-revision` | Menyimpan perubahan pada kolom yang di-allow saja |
| `POST` | `/:id/resubmit` | Mengirim kembali setelah diperbaiki |
| `GET` | `/:id/revision-status` | Cek sisa waktu deadline revisi (SLA) |

---

### ⚖️ Module: Exceptions (`/api/exceptions`)

Penanganan data yang tidak terbaca OCR atau tidak cocok secara sistem.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Daftar kasus exception yang perlu ditangani user |
| `GET` | `/:caseId` | Detail ketidakcocokan data OCR |
| `PUT` | `/:caseId/patch` | Input data manual sebagai overlay koreksi |
| `POST` | `/:caseId/recheck` | Jalankan ulang validasi dengan overlay data baru |

---

### 🛡️ Module: Approval Workflow (`/api/approval`)

Endpoint khusus untuk pengguna dengan role `approval`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/home-context` | Summary beban kerja approver |
| `GET` | `/stats` | Statistik persentase approval & kecepatan proses |
| `GET` | `/queue` | Antrean transaksi (Masked Data - No Vendor/Name) |
| `GET` | `/transactions/:id` | Review detail transaksi |
| `POST` | `/transactions/:id/approve` | Menyetujui transaksi |
| `POST` | `/transactions/:id/reject` | Mengembalikan transaksi ke admin (Return) |
| `GET` | `/emergency-list` | Daftar permintaan darurat yang perlu diprioritaskan |

---

### 🔔 Module: Alerts & SOP (`/api/alerts` & `/api/help`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/alerts` | Daftar notifikasi personal user |
| `POST` | `/api/alerts/:id/read` | Menandai satu notifikasi sebagai dibaca |
| `POST` | `/api/alerts/read-all` | Menandai semua notifikasi sebagai dibaca |
| `GET` | `/api/alerts/count` | Mendapatkan jumlah unread (normal & critical) |
| `GET` | `/api/help/sop` | SOP berdasarkan konteks (e.g. `payment`) |

---

## Sesuai Diagram Sequence

Implementasi backend telah mengikuti 10 poin utama dalam diagram sequence:
1. ✅ **Sesi & Role**: Validasi via JWT Middleware.
2. ✅ **Guard Personal**: Filter data otomatis berdasarkan `userId`.
3. ✅ **Statistik Harian**: Kalkulasi dinamis transaksi hari ini.
4. ✅ **Draft Management**: Filter draft aktif vs expired.
5. ✅ **Queue Status**: Monitoring transaksi dalam proses review.
6. ✅ **SLA Monitoring**: Peringatan otomatis mendekati batas waktu.
7. ✅ **Personal Alerts**: Notifikasi input salah (revisi) atau deadline.
8. ✅ **Activity Logs**: Pencatatan setiap tindakan user.
9. ✅ **Data Sanitization**: Menghilangkan data sensitif perusahaan.
10. ✅ **Forbidden Access**: Implementasi 403 untuk akses ilegal ke keuangan perusahaan.

## License

MIT
