# Walkthrough — Daily Plan Page & Dashboard Rework 📅⚡

Dokumentasi ini mencakup penambahan fitur **Daily Plan** baru, perbaikan bug offset tanggal (timezone), perombakan layout halaman menjadi split-screen dengan Sidebar Kalender, inline quick add, compact 1-line cards, serta pembaruan Dashboard utama.

---

## 1. Perbaikan & Fitur yang Diimplementasikan:

### A. Solusi Bug Offset Tanggal (Timezone Bug Fix)
- **Masalah**: Fungsi `getJakartaTodayStr()` sebelumnya menggunakan `.toISOString().split('T')[0]` setelah memanipulasi waktu UTC. Hal ini menyebabkan konversi balik ke UTC di mana jam awal hari (pagi hari di Jakarta) direpresentasikan sebagai hari sebelumnya di UTC, sehingga data tersimpan di tanggal kemarin dan tidak muncul di Dashboard hari ini.
- **Solusi**: Mengganti kalkulasi offset manual dengan `Intl.DateTimeFormat` menggunakan locale `'sv-SE'` dan zona waktu `'Asia/Jakarta'`. Fungsi ini secara native menghasilkan format `"YYYY-MM-DD"` yang konsisten di server maupun client.
- **Dampak**: Sinkronisasi antara data yang dimasukkan di halaman Daily Plan dengan data yang dipanggil di Dashboard berjalan dengan sempurna pada tanggal yang sama.

### B. Split-Screen Layout & Sidebar Kalender
- **Masalah**: Tampilan selector tanggal sebelumnya memakan ruang vertikal di atas, dan loading penuh halaman terasa lambat saat berpindah tanggal.
- **Solusi**: 
  - Membuat tata letak split-screen (dua kolom):
    - **Kiri (Sidebar Kalender)**: Menampilkan panel daftar hari (rentang 3 minggu: 7 hari sebelum hingga 14 hari sesudah tanggal terpilih) yang dilengkapi dot indikator status kegiatan (abu-abu/orange/hijau).
    - **Kanan (Timeline)**: Menampilkan timeline kegiatan compact untuk hari terpilih.
  - **Pre-fetched Range**: Mengubah API dan client agar mem-fetch seluruh entri agenda dalam rentang 3 minggu tersebut dalam satu request API. Perpindahan tanggal di sidebar kini berjalan secara instan (0ms latency) karena data disaring langsung dari memory.

### C. Inline Quick Add & Compact 1-Row Cards
- **Masalah**: Menambahkan rencana baru mengharuskan pengguna bolak-balik membuka modal popup, dan kartu rencana sebelumnya memakan banyak ruang vertikal.
- **Solusi**:
  - **Inline Quick Add**: Menambahkan form satu baris di bagian atas timeline. Pengguna cukup memilih jam mulai/selesai, tipe, mengetik judul, dan menekan Enter (atau klik tombol "Tambah") untuk menyimpan agenda baru secara instan.
  - **Compact 1-Row Cards**: Menyusutkan tampilan entri agenda menjadi baris tunggal horizontal yang ringkas, menata informasi waktu, ikon tipe, judul, tautan Action Item, dropdown status, dan tombol hapus/edit dalam satu baris.

### D. Loading States & Visual Feedback
- **Masalah**: Kurangnya penanda visual ketika data sedang disimpan atau dihapus membuat antarmuka terasa tidak responsif.
- **Solusi**:
  - Menambahkan indikasi visual dinamis: tombol "Simpan" berubah menjadi "Menyimpan..." dan dinonaktifkan ketika form modal dikirim.
  - Tombol Quick Add inline dinonaktifkan dan menunjukkan status loading (`...`).
  - Baris kartu agenda yang sedang diperbarui statusnya atau sedang dihapus menunjukkan efek transparansi/disabled (`processingRow`) untuk mencegah double-submission.

---

## 2. Hasil Verifikasi dan Build:

- **Build Sukses**: Kompilasi Next.js (`npm run build`) berjalan dengan sukses tanpa error TypeScript.
- **Push ke GitHub**: Semua perubahan kode telah di-stage, di-commit, dan sukses di-push ke branch `main`.
