# Replacement Mode - Mandatory Transaction Flow

## Overview
Implementasi sistem "Replacement Mode" yang memaksa admin untuk menyelesaikan pembuatan transaksi pengganti untuk transaksi yang di-reject dengan instruksi "buat baru".

**PENTING**: Transaksi pengganti dibuat **BLANK/KOSONG**, TIDAK meng-copy data dari transaksi yang di-reject. Ini karena transaksi lama itu salah (makanya di-reject), jadi tidak masuk akal untuk copy data yang salah.

## Fitur Utama

### 1. **Mode Aktivasi**
- Diaktifkan ketika admin klik "Buat Sekarang" dari notification rejection
- Query parameter `replacementMode=true` ditambahkan ke URL
- State `isReplacementMode` diset ke `true`

### 2. **Pembatasan Navigasi**
- **Tombol Back Disabled**: Tombol back arrow di-disable dan diberi tooltip
- **Browser Navigation Warning**: `beforeunload` event listener mencegah close tab/window
- **All Menu Items Locked**: Semua menu sidebar di-disable dengan icon lock 🔒
- **Alert & User Menu Disabled**: Notifikasi dan menu user juga tidak bisa diklik
- **Tooltip Everywhere**: Hover pada menu yang disabled menampilkan penjelasan
- **Forced Flow**: Admin harus menyelesaikan semua step (1-5) dan submit

### 3. **Visual Indicators**
- **Warning Banner**: Banner merah di atas form menjelaskan mode replacement
- **Disabled Back Button**: Tombol back menjadi abu-abu dan tidak bisa diklik
- **Rose Color Scheme**: Stepper menggunakan warna merah/rose (bukan biru/hijau)
- **Title Change**: Judul berubah menjadi "🔄 Buat Transaksi Pengganti"

### 4. **Flow Control**
```
User Flow dalam Replacement Mode:
1. Admin klik notifikasi rejection
2. Klik "Buat Sekarang" untuk transaksi yang di-reject
3. System membuat draft baru BLANK (hanya copy tipe transaksi)
4. Redirect ke form dengan replacementMode=true
5. Admin HARUS menyelesaikan dengan data BARU (tidak ada pre-fill):
   - Step 1: Inisialisasi (sudah dipilih tipenya)
   - Step 2: Metadata (KOSONG - isi dari awal)
   - Step 3: Detail Items (KOSONG - isi dari awal)
   - Step 4: Upload & OCR (upload dokumen baru)
   - Step 5: Validasi & Submit (cek semua data baru)
6. Setelah submit berhasil, replacementMode di-clear
7. Admin bisa navigate away setelah submit sukses
8. Transaksi lama tetap di database dengan status replacement_status='completed'
```

## Implementasi Teknis

### File yang Dimodifikasi

#### 1. `RejectionNotices.js`
```javascript
// Ubah routing untuk include replacementMode
router.push(`/dashboard/admin/transactions/new?id=${newId}&replacementMode=true`);
```

#### 2. `transactions/new/page.js`

**State Management:**
```javascript
const [isReplacementMode, setIsReplacementMode] = useState(false);
const [originalRejectedId, setOriginalRejectedId] = useState(null);
```

**Query Parameter Detection:**
```javascript
useEffect(() => {
  const replacementMode = searchParams.get('replacementMode') === 'true';
  if (replacementMode) {
    setIsReplacementMode(true);
  }
}, [searchParams]);
```

**Browser Navigation Prevention:**
```javascript
useEffect(() => {
  if (!isReplacementMode) return;

  const handleBeforeUnload = (e) => {
    e.preventDefault();
    e.returnValue = 'Anda sedang dalam mode penggantian transaksi...';
    return e.returnValue;
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isReplacementMode]);
```

**Submit Handler:**
```javascript
const handleSubmit = async () => {
  // ... submit logic ...
  
  // Clear replacement mode to allow navigation after successful submit
  setIsReplacementMode(false);
  
  router.push('/dashboard/admin/transactions');
};
```

#### `dashboard/layout.js` - Navigation Locking

**Detection:**
```javascript
const searchParams = useSearchParams();
const isReplacementMode = searchParams.get('replacementMode') === 'true';
```

**Menu Item Rendering:**
```javascript
{navItems.map((item) => {
  const isDisabled = isReplacementMode && !pathname.includes('transactions/new');
  
  if (isDisabled) {
    return (
      <div className="nav-link opacity-40 cursor-not-allowed">
        <Icon className="w-5 h-5" />
        <span>{item.label}</span>
        <Lock className="w-4 h-4 text-rose-400" />
        {/* Tooltip explaining why disabled */}
      </div>
    );
  }
  
  return <Link href={item.href}>...</Link>;
})}
```

**Disabled Features in Replacement Mode:**
- ❌ All sidebar navigation links
- ❌ Alert/notification bell
- ❌ User menu & logout
- ❌ Mobile menu toggle (masih bisa buka sidebar tapi semua disabled)

**Visual Indicators:**
- 🔒 Lock icon di setiap menu yang disabled
- 🚨 Warning banner di atas sidebar
- 💡 Tooltip on hover menjelaskan kenapa disabled

### Backend Implementation

#### `transaction.routes.js` - Create Replacement Endpoint

**CRITICAL CHANGE**: Endpoint `/api/transactions/:id/create-replacement` sekarang membuat transaksi **BLANK** bukan clone!

```javascript
// BEFORE (SALAH - Copy data yang error):
// Clone amount, description, items, dll dari transaksi rejected

// AFTER (BENAR - Blank transaction):
await query(
  `INSERT INTO transactions 
   (id, user_id, transaction_type, transaction_code, amount, currency, status, internal_flags, created_at)
   VALUES ($1, $2, $3, $4, 0, 'IDR', 'in_progress', $5, CURRENT_TIMESTAMP)`,
  [newId, userId, oldTx.transaction_type, newCode, JSON.stringify(internalFlags)]
);

// NO CLONING OF ITEMS - admin must re-enter everything from scratch
```

**Alasan Perubahan**:
1. ❌ Transaksi lama di-reject karena ada yang **SALAH**
2. ❌ Copy data yang salah = Duplikasi error
3. ✅ Fresh start = Admin dipaksa periksa ulang semua data
4. ✅ Hanya copy `transaction_type` (payment/expense) karena itu bukan data yang error

**Yang Di-copy dari Transaksi Lama**:
- ✅ `transaction_type` saja (payment/expense/dll)

**Yang TIDAK Di-copy** (dijadikan blank/default):
- ❌ `amount` → 0
- ❌ `description` → null
- ❌ `recipient_name` → null
- ❌ `invoice_number` → null
- ❌ `cost_center` → null
- ❌ `items` → empty array (no items)
- ❌ `documents` → none

## Edge Cases yang Ditangani

1. **Page Refresh**: Warning beforeunload akan muncul
2. **Browser Close**: Warning beforeunload akan muncul
3. **Back Button**: Disabled dan tidak bisa diklik
4. **URL Manual Change**: beforeunload warning akan muncul
5. **Successful Submit**: Mode di-clear, navigasi diizinkan

## Testing Checklist

- [ ] Klik notifikasi rejection mengarah ke form dengan replacementMode
- [ ] Banner warning muncul dengan jelas
- [ ] Tombol back disabled dan abu-abu
- [ ] Stepper menggunakan warna rose
- [ ] Hover tooltip muncul di tombol back
- [ ] beforeunload warning muncul saat coba close tab
- [ ] Semua step bisa dilewati normal
- [ ] Submit berhasil menghapus mode dan izinkan navigasi
- [ ] Normal flow (non-replacement) tidak terpengaruh

## Catatan Penting

⚠️ **Mode ini HANYA untuk case rejection**
- Normal draft: Navigasi bebas
- Revision flow: Navigasi bebas
- Replacement mode: Navigasi terbatas hingga submit

🎯 **Tujuan**: Memastikan admin menyelesaikan replacement untuk transaksi yang di-reject, tidak ada draft yang terbengkalai.

## Future Enhancements

1. Progress tracker: Simpan progress untuk recovery jika ada force refresh
2. Session storage: Track waktu start replacement mode
3. Admin notification: Notifikasi ke admin lain jika replacement belum selesai
4. Auto-save: Auto-save draft setiap step untuk recovery
