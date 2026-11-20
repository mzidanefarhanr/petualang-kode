# AGENTS.md — Kontrak Kerja untuk Agen AI

> Dokumen ini wajib dibaca sebelum menulis atau mengubah kode maupun dokumen proyek **Petualang Kode**.
>
> Prinsip utama: perubahan kecil, jelas, aman, dan dapat diuji lebih berharga daripada perubahan besar yang sulit dirawat.

---

## 1. Konteks Proyek

**Petualang Kode** adalah aplikasi pembelajaran coding visual interaktif (seperti Scratch / PictoBlox / CodeMonkey) berbasis stage/slide yang dikendalikan secara langsung (*live*) oleh satu **Admin** (pengajar) untuk maksimal **20 siswa** per sesi, dan dirancang untuk di-deploy ke server online.

Ringkasan kemampuan:
- **Admin** adalah satu-satunya peran pembuat konten dan akun:
  - Membuat kelas, mendaftarkan akun login siswa (`username` + kata sandi/PIN), dan membuat tautan **invite class**.
  - Menyusun pelajaran (*lessons*) yang terdiri dari urutan stage (`Stage 1`, `Stage 2`, dst.).
  - Membuat **Stage Cerita** dengan gambar bergerak, balon dialog, **timeline** berbasis waktu, dan **suara**.
  - Membuat **Stage Challenge** visual blok ala **CodeMonkey** (karakter bergerak di panggung/peta 2D menuju target dengan blok visual).
  - Menjalankan **Sesi Live**, memindah stage aktif, mengontrol putar/jeda cerita, mengunci/membuka interaksi siswa, dan memantau status progres 20 siswa secara langsung.
- **Siswa**:
  - Hanya dapat masuk memakai akun yang dibuat Admin, lalu mengikuti sesi kelas melalui tautan/kode **invite class**.
  - Layar siswa **langsung terkunci mengikuti stage yang sedang ditampilkan Admin**.
  - Menonton cerita bergerak + suara atau mengerjakan challenge blok ketika stage challenge dibuka oleh Admin.

---

## 2. Siapa yang Mengerjakan

Proyek dikerjakan dan dioperasikan oleh satu orang (Admin/pengajar sekaligus pengembang tunggal).

Konsekuensinya:
1. Jangan membuat solusi yang membutuhkan perawatan rumit (hindari microservices, broker eksternal tambahan bila satu proses Node.js sudah cukup).
2. Jangan menambahkan abstraksi atau generik untuk kebutuhan yang belum ada di v1.
3. Utamakan kode yang mudah dipahami setelah enam bulan tidak disentuh.
4. Pilih solusi yang paling sederhana, eksplisit, dan mudah diuji.

---

## 3. Stack Teknologi

| Bagian | Teknologi | Ketentuan |
|---|---|---|
| Aplikasi Web | Next.js (App Router) | Halaman Admin, Siswa, dan API `/api/v1/*` |
| Bahasa | TypeScript | Ketik tegas untuk kontrak stage, timeline, peta challenge, dan event WS |
| Server Real-Time | Custom Node.js HTTP + `ws` | Satu proses Node.js menjalankan Next.js + WebSocket untuk kontrol layar live |
| Editor Blok Visual | `blockly` | Blok perintah karakter ala CodeMonkey/Scratch |
| Panggung & Audio | HTML5 Canvas / SVG + Web Audio / `<audio>` | Animasi timeline cerita, gerak karakter di peta, dan pemutaran suara |
| Styling | Tailwind CSS | Antarmuka sederhana, kontras jelas, tanpa sistem desain berlebih |
| Database | PostgreSQL 15+ | SQL migrasi adalah sumber kebenaran |
| Media Storage | Disk lokal / S3-kompatibel | Menyimpan gambar dan suara unggahan Admin |
| Autentikasi | Auth.js v5 (JWT) | Cookie `HttpOnly; SameSite=Lax`, tanpa tabel sesi di DB |
| Unit & Integrasi | Vitest | Menguji logika stage, evaluator challenge, izin, dan DB |
| E2E | Playwright | Menguji alur Admin + Siswa secara real-time lintas dua konteks browser |

### 3.1 Aturan dependensi

Sebelum menambah package baru, pastikan:
- Tidak ada package yang sudah terpasang yang bisa menyelesaikan masalahnya.
- Tidak mengikat aplikasi ke layanan eksternal berbayar tanpa alasan kuat.
- Package kompatibel dengan Node.js tunggal untuk deployment online.

### 3.2 Teknologi yang tidak digunakan

- Microservices / pemisahan server tanpa kebutuhan nyata.
- GraphQL.
- Tabel sesi buatan sendiri di database.
- ORM yang mengklaim skema sendiri sebagai sumber kebenaran.
- Mesin `scratch-gui` / `scratch-vm` dan arsip `.sb3` (tidak digunakan di proyek baru ini).

---

## 4. Struktur Workspace

Satu aplikasi terpadu di root repository:

```text
/
├── package.json
├── db/
│   ├── migrations/       # Sumber kebenaran skema SQL (001, 002, ...)
│   ├── migrate.mjs
│   └── seed-dev.mjs
├── src/
│   ├── server.ts         # Custom HTTP + WebSocket server + Next.js handler
│   ├── auth.ts           # Konfigurasi Auth.js JWT (admin & student)
│   ├── app/              # Next.js App Router (halaman & /api/v1/*)
│   ├── components/       # UI Admin, Timeline Builder, Stage Player, Blockly Challenge
│   ├── lib/              # DB pool, access guard, storage, validator, evaluator challenge
│   └── ws/               # Hub WebSocket room per live_session
└── e2e/                  # Pengujian Playwright multi-klien
```

---

## 5. Batas Keras — Tidak Bisa Dinegosiasikan

1. **Hanya Admin yang boleh membuat akun siswa, kelas, materi, dan media.**
   - Dilarang menyediakan endpoint registrasi publik siswa (`/daftar` bebas tanpa dibuat Admin).
   - Semua endpoint mutasi materi/kelas/akun/live-control wajib memverifikasi `role === 'admin'` dan kepemilikan `admin_id`.
2. **Layar siswa wajib terkunci pada stage aktif di server.**
   - Siswa tidak boleh mengambil atau memodifikasi stage selain `active_stage_id` pada `live_sessions` yang sedang aktif untuk kelasnya.
   - Pemeriksaan dilakukan di server (REST maupun WebSocket), bukan hanya menyembunyikan tombol di UI.
3. **Kredensial siswa & rahasia aman.**
   - Kata sandi/PIN siswa dan Admin selalu di-hash memakai `bcryptjs` (atau Argon2), tidak pernah disimpan atau dikirim kembali dalam teks terang setelah dibuat.
   - Autentikasi WebSocket harus memverifikasi cookie sesi / token bertanda tangan milik pengguna yang sah, tidak pernah mempercayai `student_id` atau `role` dari payload pesan klien.
4. **Waktu dari server (`now()`).**
   - Semua keputusan masa berlaku undangan, waktu mulai/selesai sesi live, dan waktu penyelesaian challenge memakai waktu database/server.
5. **Integritas migrasi database.**
   - Berkas migrasi SQL yang sudah dijalankan tidak boleh diedit; perubahan skema wajib melalui berkas migrasi berurutan baru.
6. **Validasi unggahan media (gambar & suara).**
   - Periksa ukuran file dan tipe konten yang diizinkan di server sebelum menyimpan; jangan pernah menyimpan path disk mentah yang bisa dimanipulasi (*path traversal*).
7. **Kapasitas sesi.**
   - Batas maksimal **20 siswa** per sesi live ditegakkan di server saat siswa bergabung/terhubung ke sesi.

---

## 6. Prosedur Kerja Agen AI

1. **Baca konteks**: baca `KONTEKS.md`, `AGENTS.md`, dan dokumen teknis area terkait sebelum menyentuh kode.
2. **Perubahan terarah**: satu lingkup tugas dalam satu perubahan; hindari refactor yang tidak diminta.
3. **Verifikasi sebelum selesai**: jalankan `typecheck`, `vitest`, `next build`, dan `playwright` (berurutan, tidak bersamaan saat menyentuh `.next`) sesuai perubahan.
4. **Laporkan jujur**: sebutkan file yang diubah, pengujian yang benar-benar dijalankan beserta hasilnya, dan hal yang belum diuji.

---

## 7. Penanganan Konflik Dokumen

Jika dua dokumen bertentangan atau kode berbeda dengan dokumen:
1. Jangan menebak atau diam-diam mengubah dokumen agar mengikuti bug kode.
2. Identifikasi bagian yang bertentangan dan jelaskan dampaknya sebelum mengambil keputusan besar.
