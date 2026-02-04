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

## API Documentation

Dokumentasi API lengkap dengan detail request dan response. Semua endpoint (kecuali Auth) memerlukan Header `Authorization: Bearer <token>`.

### 🔐 Authentication (`/api/auth`)

Informasi login dan manajemen sesi.

#### `POST /api/auth/register`
*   **Summary**: Register user baru (Admin Finance atau Approval)
*   **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "password123",
      "fullName": "John Doe",
      "role": "admin_finance", // atau "approval"
      "department": "Finance"
    }
    ```
*   **Responses**:
    *   `201`: User berhasil dibuat
    *   `400`: Validation error / Email sudah terdaftar

#### `POST /api/auth/login`
*   **Summary**: Login user
*   **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "password123"
    }
    ```
*   **Responses**:
    *   `200`: Login berhasil, mengembalikan token JWT dan data anonim
    *   `401`: Email atau password salah

#### `GET /api/auth/me`
*   **Summary**: Ambil profil user saat ini (anonim)
*   **Responses**:
    *   `200`: Mengembalikan `loginId`, `publicAlias`, `role`, dan `department`

#### `GET /api/auth/validate`
*   **Summary**: Validasi sesi dan token
*   **Responses**:
    *   `200`: Sesi valid

---

### 📊 Dashboard (`/api/dashboard`)

Data ringkasan untuk halaman beranda.

#### `GET /api/dashboard/summary`
*   **Summary**: Ambil ringkasan beranda (hanya data pribadi)
*   **Responses**:
    *   `200`: Ringkasan transaksi hari ini, draft aktif, pending, revisi, peringatan SLA, dan aktivitas terbaru.

#### `GET /api/dashboard/activity`
*   **Summary**: Ambil log aktivitas pribadi
*   **Parameters**:
    *   `limit` (query): Jumlah maksimal data (default: 20)
    *   `offset` (query): Offset untuk pagination
*   **Responses**:
    *   `200`: Daftar aktivitas terbaru

#### `GET /api/dashboard/company-data`
*   **Summary**: Akses data keuangan perusahaan (Simulasi pembatasan)
*   **Responses**:
    *   `403`: Akses ditolak (Admin Finance tidak diizinkan)

---

### 💸 Transactions (`/api/transactions`)

Manajemen transaksi, workflow input, dan revisi.

#### `GET /api/transactions`
*   **Summary**: Ambil daftar transaksi pribadi
*   **Parameters**:
    *   `status` (query): Filter berdasarkan status (contoh: `draft,returned`)
    *   `type` (query): Filter berdasarkan tipe transaksi
*   **Responses**:
    *   `200`: Daftar transaksi dengan metadata pagination

#### `POST /api/transactions/init`
*   **Summary**: Inisialisasi transaksi baru (Step 1)
*   **Request Body**:
    ```json
    {
      "transactionType": "payment" // payment, expense, general
    }
    ```
*   **Responses**:
    *   `201`: Transaksi diinisialisasi, mengembalikan `id` dan `transaction_code`

#### `PUT /api/transactions/{id}/header`
*   **Summary**: Simpan data utama (header) transaksi (Step 2)
*   **Request Body**:
    ```json
    {
      "vendorName": "PT Contoh",
      "invoiceDate": "2024-03-20",
      "invoiceNumber": "INV-001",
      "amount": 1500000,
      "currency": "IDR",
      "description": "Pembayaran sewa"
    }
    ```

#### `POST /api/transactions/{id}/items`
*   **Summary**: Simpan item-item transaksi (Step 3)
*   **Request Body**:
    ```json
    {
      "items": [
        {
          "description": "Item 1",
          "quantity": 2,
          "price": 500000,
          "accountCode": "GL001"
        }
      ]
    }
    ```

#### `POST /api/transactions/{id}/upload`
*   **Summary**: Upload dokumen & Jalankan OCR (Step 4)
*   **Request Body**: `multipart/form-data` dengan field `document` (file)
*   **Responses**:
    *   `200`: File diproses, mengembalikan hasil OCR

#### `POST /api/transactions/{id}/submit`
*   **Summary**: Kirim transaksi untuk approval
*   **Request Body**:
    ```json
    {
      "notes": "Keperluan mendesak",
      "isEmergency": false,
      "emergencyReason": ""
    }
    ```
*   **Responses**:
    *   `200`: Berhasil disubmit atau ditahan (Exception Case dibuat jika OCR tidak cocok)

#### `GET /api/transactions/{id}/timeline`
*   **Summary**: Ambil timeline aktivitas transaksi
*   **Responses**:
    *   `200`: Daftar event (Created, Submitted, Approved, dll)

---

### 🔔 Alerts (`/api/alerts`)

Sistem notifikasi dan peringatan personal.

#### `GET /api/alerts`
*   **Summary**: Ambil peringatan personal
*   **Parameters**:
    *   `unreadOnly` (query): `true` untuk hanya yang belum dibaca
*   **Responses**:
    *   `200`: Daftar notifikasi/peringatan

#### `POST /api/alerts/{id}/read`
*   **Summary**: Tandai peringatan sebagai sudah dibaca

---

### ⚖️ Exceptions (`/api/exceptions`)

Penanganan ketidakcocokan data OCR.

#### `GET /api/exceptions`
*   **Summary**: Ambil daftar exception cases milik user
#### `PUT /api/exceptions/{caseId}/patch`
*   **Summary**: Berikan overlay data manual untuk memperbaiki error OCR

---

### ❓ Help (`/api/help`)

Akses bantuan dan SOP kontekstual.

#### `GET /api/help/sop`
*   **Summary**: Ambil SOP kontekstual berdasarkan context
*   **Parameters**:
    *   `contextType` (query): Tipe konteks (contoh: `transaction_type`)
    *   `contextCode` (query): Kode konteks (contoh: `payment`)

---

### 🛡️ Approval (`/api/approval`)

Endpoints khusus untuk role `approval`.

#### `GET /api/approval/queue`
*   **Summary**: Ambil antrean transaksi yang menunggu approval
*   **Description**: Menggunakan *Exception-Aware Routing* (masking data sensitif)

#### `POST /api/approval/transactions/{id}/approve`
*   **Summary**: Setujui transaksi

#### `POST /api/approval/transactions/{id}/reject`
*   **Summary**: Kembalikan transaksi untuk revisi (Status: `returned`)

---

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
