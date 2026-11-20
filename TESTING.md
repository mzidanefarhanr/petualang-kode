# TESTING.md — Rencana Pengujian Petualang Kode v1

> Panduan pengujian unit, integrasi, E2E multi-browser (WebSocket), dan verifikasi pra-deployment untuk **Petualang Kode**.

---

## 1. Tujuan Pengujian

Pengujian harus membuktikan lima hal utama:
1. **Otorisasi ketat**: hanya Admin yang dapat membuat kelas, akun siswa, media, pelajaran, stage, dan mengontrol sesi live; siswa tidak bisa mendaftar sendiri atau mengakses data admin.
2. **Kunci layar real-time**: layar siswa otomatis mengikuti stage aktif Admin via WebSocket, dan siswa tidak dapat melompat ke stage lain melalui API maupun WebSocket.
3. **Batas kapasitas 20 siswa**: hingga 20 siswa dapat bergabung ke satu sesi live bersamaan; siswa ke-21 ditolak dengan kode error yang benar.
4. **Keutuhan Stage Cerita & Challenge**:
   - Stage cerita menyimpan konfigurasi timeline & aset audio/gambar secara valid dan memutar sesuai offset waktu.
   - Evaluator challenge ala CodeMonkey di server dan klien menghasilkan hasil identik untuk gerakan, belokan, rintangan, pengambilan item, loop, dan kondisi menang/kalah.
5. **Kesiapan deployment online**: aplikasi terbuild bersih (`next build`), custom server HTTP + WebSocket berjalan stabil, dan cookie sesi aman di balik HTTPS/WSS.

---

## 2. Jenis Pengujian

### 2.1 Uji Unit (Vitest)
- Simulator / evaluator challenge CodeMonkey (gerak lurus, putar, tabrak dinding, ambil bintang, blok `ulangi`, batas langkah 200 untuk mencegah loop tak terbatas).
- Validator skema JSON timeline stage cerita (durasi, keyframe posisi, dialog, track audio).
- Validasi MIME, ekstensi, dan batas ukuran 10 MB untuk unggahan media.
- Guard otorisasi `requireAdmin` / `requireStudent` dan helper rantai kepemilikan.

### 2.2 Uji Integrasi Database & API (Vitest + PostgreSQL Uji)
- Pembuatan kelas, siswa, keanggotaan, dan invite class (valid, kedaluwarsa, dicabut).
- CRUD pelajaran & stage termasuk reorder stage dalam transaksi.
- Pembuatan `live_session` (maks. 1 sesi aktif per kelas), perubahan kontrol stage, dan penolakan akses siswa ke stage selain `active_stage_id`.
- Penolakan `POST /progress` ketika `challenge_locked = true`.

### 2.3 Uji Ujung-ke-Ujung & Real-Time (Playwright)
Menggunakan dua konteks browser terpisah (**Browser Admin** dan **Browser Siswa**):
1. Pengunjung membuka `/` dan melihat Landing Page publik (bukan redirect paksa ke `/masuk`), serta tersedia tombol **Masuk** dan input kode invite class.
2. Admin login, membuat kelas, membuat akun siswa, dan membuat invite class.
3. Admin membuat pelajaran dengan Stage 1 (`story` dengan gambar bergerak + timeline + suara) dan Stage 2 (`challenge` peta CodeMonkey).
4. Admin memulai sesi live.
5. Siswa login memakai akun buatan Admin lewat `/join/<kode>` dan masuk ke `/kelas/<id>/live`.
6. Browser Siswa otomatis menampilkan **Stage 1 (Cerita)** tanpa tombol pindah stage.
7. Admin menekan **Putar Cerita** -> Browser Siswa memulai pemutaran timeline cerita.
8. Admin menekan **Stage Berikutnya (Stage 2)** -> Browser Siswa otomatis berpindah ke **Stage 2 (Challenge)** secara real-time.
9. Admin mengunci challenge -> papan blok siswa terkunci; Admin membuka kunci -> siswa menyusun blok di Blockly, menekan **Jalankan**, karakter mencapai target, dan status **Selesai** langsung muncul di panel Admin.
10. Uji kapasitas: 20 koneksi siswa diterima, koneksi ke-21 ditolak (`SESI_PENUH`).

---

## 3. Aturan Menjalankan Pengujian

- Database uji terpisah pada `TEST_DATABASE_URL` (atau `DATABASE_URL` khusus uji yang di-truncate pada global setup E2E).
- Jalankan `next build` dan `playwright test` secara **berurutan** (tidak bersamaan) agar direktori `.next` tidak bentrok.
- Urutan verifikasi sebelum deployment:
  1. `npm run typecheck`
  2. `npm test`
  3. `npm run build`
  4. `npm run test:e2e`
