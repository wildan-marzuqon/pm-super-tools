# Walkthrough — Teams Load Feature & Notes Selection Bug Fix

Dokumentasi mengenai penambahan menu baru **Teams Load** untuk memproyeksikan kapasitas kerja tim dari Jira export serta perbaikan bug **Notes auto-save overwrite** ketika berpindah catatan.

---

## 1. Fitur Baru: Teams Load (Proyeksi Kapasitas Tim)

Fitur ini membantu Project Manager untuk melihat proyeksi alokasi beban kerja harian tim selama seminggu, sebulan, atau rentang waktu kustom (custom dates) berdasarkan file ekspor CSV dari Jira.

### Perubahan File & Struktur:
- **Database Model**: Menambahkan tabel [JiraIssue](file:///Users/wildanmarzuqon/Documents/PM%20Advancements/Learning/pm-1/prisma/schema.prisma#L92-L106) di schema Prisma untuk menyimpan informasi tugas yang diimpor.
- **Sidebar Menu**: Menambahkan menu "Teams Load" di [Sidebar.tsx](file:///Users/wildanmarzuqon/Documents/PM%20Advancements/Learning/pm-1/src/components/Sidebar.tsx#L59-L69).
- **API Endpoint**: Membuat [route.ts](file:///Users/wildanmarzuqon/Documents/PM%20Advancements/Learning/pm-1/src/app/api/jira-issues/route.ts) untuk mengambil (`GET`) dan menyimpan (`POST` via database transaction bulk replace) data isu Jira.
- **Halaman Proyeksi**: Membuat halaman visualisasi utama di [page.tsx](file:///Users/wildanmarzuqon/Documents/PM%20Advancements/Learning/pm-1/src/app/teams-load/page.tsx) dan stylesheet [page.module.css](file:///Users/wildanmarzuqon/Documents/PM%20Advancements/Learning/pm-1/src/app/teams-load/page.module.css).

### Fungsionalitas & Desain UI/UX Premium:
1. **Drag-and-Drop CSV Upload**: Modal upload mendukung drag-and-drop file dengan indikasi visual yang responsif.
2. **Robust Date Parsing**: Kompatibel dengan format tanggal Jira (`DD/MM/YYYY`, `YYYY-MM-DD`, dan singkatan nama bulan bahasa Inggris maupun bahasa Indonesia seperti `Jun`, `Mei`, `Agu`, `Oct`, dll.).
3. **Date Baseline Terkini (Sistem)**: Halaman selalu memproyeksikan rentang tanggal berdasarkan tanggal sistem saat ini (`new Date()`).
   - Mingguan akan selalu ditarik dari hari Senin di minggu berjalan.
   - Bulanan ditarik dari tanggal 1 bulan berjalan.
4. **Task Range Overlap Filtering**: Tabel kini disaring secara cerdas sehingga hanya menampilkan tugas-tugas yang rentang kerjanya bersinggungan langsung dengan range tanggal terpilih, sehingga menghindari baris kosong/tidak relevan.
5. **Continuous Pill Highlights**: Sel-sel aktif pengerjaan tugas yang berlangsung lebih dari 1 hari digabungkan secara visual menjadi satu pill bar horizontal berkelanjutan (tanpa border kiri-kanan pada sel tengah, dan dilengkapi *rounded corners* di ujung kiri/kanan pengerjaan) lengkap dengan kalkulasi jam/hari kerja yang proporsional.
6. **Dynamic Team Capacity Scaling**: Jika memfilter "Semua Anggota Tim" (All), kapasitas dasar harian otomatis dikalikan dengan jumlah anggota yang ada di database agar perbandingan total alokasi dan kapasitas tetap akurat.

---

## 2. Perbaikan Bug: Notes Auto-Save Overwrite

### Masalah:
Saat berpindah-pindah catatan (misal dari Note A ke Note B), ProseMirror/Tiptap memicu event `onUpdate` secara asinkron. Karena render React asinkron dan status `selectedNote` di dalam callback masih menyimpan Note lama (Note A) sementara isi editor sudah berubah ke Note baru (Note B), sistem menyimpan isi Note B ke dalam data Note A.

### Solusi:
- **`data-note-id` Validation**: Menambahkan atribut `data-note-id` pada container editor. Sebelum `handleContentChange` dipicu pada event `onUpdate`, editor memvalidasi apakah note ID saat ini sesuai dengan state render `selectedNote.id`. Jika tidak sama, update diabaikan karena merupakan sisa transition asinkron.
- **Synchronous Reference Update**: Melakukan pembaruan terhadap `lastSavedContentRef.current` secara sinkron langsung di dalam fungsi `selectNote` sebelum content editor di-set ulang. Hal ini mencegah perbandingan konten mendeteksi "perubahan" palsu akibat membandingkan note baru dengan konten note lama yang tersisa di cache.

---

## 3. Hasil Verifikasi

- Menjalankan build via `rtk npm run build` (Build selesai sukses tanpa error TypeScript maupun Turbopack).
- **Status Git**: Semua perubahan telah di-push ke branch `main`.
