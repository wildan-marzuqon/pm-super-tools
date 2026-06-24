# Walkthrough — Daily Plan Page & Dashboard Rework 📅⚡

Perubahan ini menambahkan halaman **Daily Plan** baru untuk pengelolaan agenda harian (Task, Meeting, Focus Block) yang terintegrasi dengan Action Items, melengkapi menu Sidebar dengan dot badge indikator, serta mendesain ulang layout **Dashboard** utama dengan visualisasi progress bar proyek dan ringkasan agenda.

---

## 1. Perubahan Utama yang Dilakukan:

### A. Skema Database & Sinkronisasi (`prisma/schema.prisma`)
- Menambahkan model `DailyPlanEntry` untuk melacak entri agenda harian:
  - `date`: format tanggal `"YYYY-MM-DD"`.
  - `startTime` & `endTime`: format waktu `"HH:MM"`.
  - `type`: tipe entri (`"task"` | `"meeting"` | `"focus"`).
  - `status`: untuk tipe `task` (`"open"`, `"in_progress"`, `"done"`) dan tipe `meeting/focus` (`"pending"`, `"done"`, `"skipped"`).
  - `actionItemId`: relasi opsional ke `ActionItem` (dengan opsi `onDelete: SetNull`).
- Menambahkan relasi `dailyPlanEntries` ke dalam model `ActionItem`.
- Menjalankan sinkronisasi skema ke database Neon PostgreSQL (`npx prisma db push`) dan memperbarui client (`npx prisma generate`).

### B. API Routes (`src/app/api/daily-plan`)
- **`GET /api/daily-plan?date=YYYY-MM-DD`**:
  - Mengambil daftar agenda harian berdasarkan tanggal, diurutkan kronologis berdasarkan `startTime`.
  - Mendukung pengecekan badge di sidebar (`?date=today&badge=true`) yang memeriksa apakah ada agenda aktif untuk hari ini yang sedang berjalan (*ongoing*) atau akan mulai dalam 15 menit (*upcoming*).
- **`POST /api/daily-plan`**:
  - Membuat rencana harian baru.
  - Jika bertipe `task` dan opsi `"Buat action item baru otomatis"` dicentang, sistem otomatis membuat `ActionItem` baru dengan default PIC `"Wildan"` dan menautkannya.
- **`PUT /api/daily-plan/[id]`**:
  - Mengubah detail rencana harian.
  - **Sinkronisasi Status Otomatis**: Jika tipe entri adalah `task` dan status rencana diubah (`open`/`in_progress`/`done`), sistem otomatis menyinkronkan status tersebut ke `ActionItem` yang terhubung.
- **`PUT /api/action-items/[id]` (Sync Tambahan)**:
  - Ketika status `ActionItem` diubah langsung di halaman Action Items tracker, sistem otomatis menyinkronkan status tersebut ke semua entri `DailyPlanEntry` bertipe `task` yang terhubung.
- **`DELETE /api/daily-plan/[id]`**:
  - Menghapus rencana harian secara aman.

### C. Halaman Daily Plan (`src/app/daily-plan`)
- **Timeline Harian**: Menampilkan daftar agenda secara kronologis dengan garis timeline visual yang elegan.
- **Current Time Indicator**: Garis horizontal merah dengan penunjuk waktu riil `"jam sekarang (09:32)"` yang otomatis tersisip secara dinamis di sela-sela entri agenda harian (hanya aktif jika tanggal yang dipilih adalah hari ini).
- **In-App Banner Reminder** (Sticky di atas):
  - 🔴 **Overdue**: Muncul jika ada rencana hari ini yang sudah lewat jam selesainya namun statusnya belum diselesaikan.
  - 🟠 **Ongoing**: Muncul jika rencana sedang berlangsung.
  - 🟡 **Upcoming**: Muncul jika rencana akan dimulai dalam waktu $\le 15$ menit.
  - Banner dapat di-dismiss oleh pengguna (tombol &times;) dan mengevaluasi status secara otomatis setiap 60 detik.
- **Read-Only Mode untuk Tanggal Lampau**: Jika pengguna melihat tanggal kemarin/lampau, tombol tambah rencana, edit, hapus, dan tombol aksi cepat status dinonaktifkan secara penuh.
- **Modal Add/Edit**: Form premium dengan validasi, di mana pilihan waktu selesai otomatis diset +1 jam saat waktu mulai diubah, serta dropdown pencarian Action Item pending untuk kemudahan tautan.

### D. Sidebar Menu (`src/components/Sidebar.tsx`)
- Menata ulang menu Sidebar dan menyisipkan **Daily Plan** di urutan ke-2 (setelah Dashboard).
- Menambahkan dot badge berkedip (merah untuk *ongoing*, amber untuk *upcoming*) di samping nama menu "Daily Plan" berdasarkan polling API latar belakang setiap 60 detik.

### E. Desain Baru Dashboard (`src/app/page.tsx`)
- **5 Metric Cards**: Ditambah kartu statistik **"Rencana Hari Ini"** yang menampilkan progres kegiatan hari ini (misal: `2/5 selesai`).
- **Akses Cepat (Quick Actions)**: Baris tombol pintasan cepat untuk membuat Rencana Harian, tambah Action Item, Note Baru, dan Sync Jira.
- **Rencana Hari Ini (Mini Preview)**: Menampilkan 3 rencana teratas hari ini secara kronologis dengan indikator tipe dan status.
- **Proyek Aktif (Stage progress)**: Menampilkan seluruh proyek yang berstatus aktif lengkap dengan visual progress bar persentase tahap pengerjaan proyek.

---

## 2. Hasil Verifikasi dan Build:

- **Build Sukses**: Kompilasi production Next.js (`npm run build`) berjalan dengan sukses tanpa error tipe data atau Turbopack.
- **Bahasa Indonesia**: Seluruh antarmuka rencana harian, penunjuk waktu, modal, formulir, dan tombol aksi menggunakan Bahasa Indonesia yang ramah pengguna.
- **Scrolling Lancar**: Sesuai dengan aturan layout workspace, kontainer halaman `/daily-plan` menggunakan CSS module dengan `height: 100%` dan `overflow-y: auto`.
