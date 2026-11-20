# ROADMAP.md — Tahapan Pembangunan Petualang Kode v1

> Dokumen ini menjadi acuan bertahap dalam membangun **Petualang Kode** dari nol hingga siap di-deploy ke server online.
>
> Prinsip pengerjaan: setiap tahap harus dapat diuji dan berjalan bersih (`typecheck`, test terkait, dan build/verifikasi) sebelum melangkah ke tahap berikutnya.

---

## Ringkasan Peta Tahapan

| Tahap | Fokus Utama | Hasil Akhir yang Bisa Diuji |
|---|---|---|
| **Tahap 1** | Fondasi, Database Dasar, & Auth | Next.js + Custom Server HTTP/WS berjalan; migrasi `001`–`002`; login Admin & Siswa (JWT) |
| **Tahap 2** | Landing Page, Kelas, Siswa, & Invite | Landing Page `/` (`petualang-kode-v3`), `/masuk`, CRUD kelas/siswa/invite, alur `/join/[kode]` |
| **Tahap 3** | Media & Stage Cerita (Timeline + Suara) | Migrasi `003`; upload gambar/audio; CRUD pelajaran; Timeline Editor + pemutar cerita bersuara |
| **Tahap 4** | Stage Challenge Blok (ala CodeMonkey) | Evaluator peta 2D deterministik, Blockly workspace, editor peta Admin, animasi & suara efek |
| **Tahap 5** | Sesi Live Real-Time & Kontrol Layar | Migrasi `004`; WebSocket Hub (`maks. 20 siswa`), kunci layar siswa ke stage Admin, E2E multi-browser |
| **Tahap 6** | Pemolesan & Kesiapan Deployment Online | Auto-reconnect WS, optimasi aset, konfigurasi produksi HTTPS/WSS, uji regresi penuh |

---

## Tahap 1 — Fondasi Proyek, Database Dasar, & Autentikasi

**Tujuan:** Menyiapkan kerangka aplikasi tunggal (`Next.js App Router + Custom Node HTTP/WebSocket Server`), koneksi PostgreSQL, dan sistem autentikasi Admin/Siswa.

### Ruang Lingkup Pekerjaan
1. **Inisialisasi Aplikasi & Gaya (`package.json`, `tsconfig.json`, Tailwind CSS):**
   - Pasang dependensi inti (`next`, `react`, `react-dom`, `next-auth`, `pg`, `bcryptjs`, `ws`, `typescript`, `tailwindcss`, `vitest`, `@playwright/test`).
   - Pasang font `Nunito` dan definisikan token warna resmi (`--teal`, `--navy`, `--cream`, `--amber`, `--coral`, dll.) sesuai [DESIGN.md](DESIGN.md).
   - Salin aset maskot **Kelinci Penjelajah** dari paket desain ke `public/mascot/` (`00`–`08`).
2. **Custom Server (`src/server.ts`):**
   - Menjalankan Next.js handler dan WebSocket server (`ws`) di path `/ws` dalam satu proses Node.js (`PORT=3000`).
3. **Database Awal (`db/migrations/001_akun.sql`, `002_kelas.sql`, `db/migrate.mjs`, `db/seed-dev.mjs`):**
   - Tabel `schema_migrations`, `admins`, `students`, `classes`, `class_members`, `class_invites`.
   - Script `db:migrate` dan `db:seed` untuk menanam 1 akun Admin dev.
4. **Autentikasi & Guard (`src/auth.ts`, `src/lib/access.ts`):**
   - Auth.js v5 strategi JWT (cookie `HttpOnly; SameSite=Lax`, tanpa tabel sesi DB).
   - Provider `admin` (`email + password`) dan `student` (`username + password`).
   - Helper `requireAdmin` dan `requireStudent` beserta format error seragam (`API-CONTRACTS.md`).

### Kriteria Selesai Tahap 1
- `npm run db:migrate` dan `npm run db:seed` berhasil pada database kosong.
- `typecheck`, unit test `requireAdmin` / `requireStudent`, dan `next build` lulus.
- Server dapat dijalankan dan halaman dasar merespons di `http://localhost:3000`.

---

## Tahap 2 — Landing Page, Halaman Masuk, & Manajemen Kelas/Siswa/Invite

**Tujuan:** Menghadirkan halaman publik `/` dan seluruh alur manajemen kelas serta akun siswa oleh Admin.

### Ruang Lingkup Pekerjaan
1. **Landing Page (`/` — `src/app/page.tsx`):**
   - Mengimplementasikan tata letak dan animasi referensi `petualang-kode-v3.html`: Navbar sticky, Hero dengan SVG inline **Kelinci Penjelajah**, tombol **Masuk** (`/masuk`), input cepat **Kode Kelas** (`/join/<kode>`), Trust Strip, 3 baris fitur zigzag, 3 langkah cara belajar, CTA band, dan Footer.
   - Jika pengguna sudah login, tampilkan tombol pintas ke `/admin` atau kelasnya.
2. **Halaman Masuk (`/masuk`):**
   - Dua tab (**Siswa** dan **Admin**) ditemani maskot `07-pose-menyapa-onboarding.jpg`.
   - Tab Siswa menampilkan keterangan bahwa akun dibuat oleh pengajar (tanpa form daftar publik).
3. **Panel Admin Kelas & Siswa (`/admin`, `/admin/kelas/[class_id]`, `/admin/siswa`):**
   - API & UI membuat/mengarsipkan kelas.
   - API & UI membuat akun siswa (`nama`, `username`, `password`), reset kata sandi, dan memasukkan/mengeluarkan siswa dari kelas.
   - API & UI membuat serta mencabut **Invite Class** (`/api/v1/admin/classes/[class_id]/invites`, `/api/v1/admin/invites/[invite_id]`).
4. **Halaman Gabung Kelas (`/join/[kode]`):**
   - Menampilkan info kelas & nama pengajar (`GET /api/v1/invites/[kode]`), menolak undangan kedaluwarsa/dicabut (`410`), dan mengarahkan siswa yang sudah login & terdaftar ke `/kelas/[class_id]/live`.

### Kriteria Selesai Tahap 2
- Pengunjung membuka `/` melihat Landing Page lengkap (tidak langsung ke `/masuk`).
- Integration test DB + API: Admin membuat kelas, membuat akun siswa, membuat invite; siswa lain atau pengguna tak berhak ditolak `401`/`403`/`404`; undangan dicabut/kedaluwarsa ditolak `410`.

---

## Tahap 3 — Pustaka Media, Pelajaran, & Stage Cerita (Timeline + Suara)

**Tujuan:** Memungkinkan Admin mengunggah aset gambar & suara serta menyusun pelajaran berisi **Stage Cerita** dengan animasi bergerak di atas timeline dan audio.

### Ruang Lingkup Pekerjaan
1. **Database Materi & Media (`db/migrations/003_materi_dan_media.sql`):**
   - Tabel `media_assets`, `lessons`, `stages` (constraint urutan `deferrable initially deferred`).
2. **Penyimpanan & Layanan Media (`src/lib/storage.ts`, `/api/v1/admin/media`, `/api/v1/media/[asset_id]`):**
   - Driver `local` (`.media/`) dan `s3` S3-kompatibel.
   - Validasi MIME gambar (`png/jpg/jpeg/webp/gif`) & audio (`mp3/wav/ogg`), batas ukuran **10 MB**, dan pencegahan hapus media yang masih dipakai stage (`409`).
   - UI Pustaka Media (`/admin/media`).
3. **Pembuat Pelajaran & Urutan Stage (`/admin/pelajaran`, `/admin/pelajaran/[lesson_id]`):**
   - CRUD `lessons` dan `stages`, plus reorder urutan stage dalam satu transaksi SQL.
4. **Pemutar & Timeline Editor Stage Cerita (`src/lib/story/`, komponen `StoryPlayer` & `StoryBuilder`):**
   - Skema JSON tervalidasi: `duration_ms`, `background_asset_id`, `actors[]`, `timeline[]` (`move`, `dialogue`, `audio`).
   - `StoryPlayer`: merender panggung + interpolasi posisi/opasitas aktor sesuai waktu pemutaran, balon dialog, dan pemutaran track suara (`<audio>` / Web Audio).
   - `StoryBuilder`: editor Admin untuk memilih latar/aktor, menyusun track waktu gerak/dialog/suara di timeline berbasis detik, dan tombol **Pratinjau**.

### Kriteria Selesai Tahap 3
- Unit test validator skema timeline cerita dan validasi upload media lulus.
- Integration test CRUD `lessons`, `stages`, dan `reorder` lulus.
- Admin dapat mengunggah gambar & audio, menyusun Stage 1 bertipe `story`, dan memutar pratinjau animasi + suaranya.

---

## Tahap 4 — Stage Challenge Visual Blok (ala CodeMonkey)

**Tujuan:** Menyediakan teka-teki coding visual berbasis peta 2D dan Blockly lengkap dengan editor peta Admin serta verifikasi solusi deterministik di klien dan server.

### Ruang Lingkup Pekerjaan
1. **Mesin Simulator & Evaluator Challenge (`src/lib/challenge/`):**
   - Definisi grid 2D (maks. `16x12`), arah (`N/E/S/W`), tile (`floor`, `wall`, `hazard`), `stars/coins`, `goal`, dan daftar aksi (`move`, `turn_left`, `turn_right`, `jump`, `collect`, `repeat`).
   - Batas maksimal **200 langkah** eksekusi per percobaan (mencegah infinite loop).
   - Menghasilkan jejak langkah (*step trace*) untuk animasi di browser sekaligus status akhir (`completed` / `failed` + alasan ramah anak) yang identik di server.
2. **Workspace Blockly & Panggung Peta 2D (`ChallengePlayer`):**
   - Integrasi `blockly` dengan blok visual berwarna konsisten dengan palet `DESIGN.md` (`maju` teal, `belok` ungu, `lompat` coral, `ulangi` amber).
   - Panggung peta 2D yang menganimasikan gerakan karakter langkah demi langkah, memutar suara efek (langkah, ambil item, menang, gagal), dan menampilkan maskot `05-pose-berpikir-debugging.jpg` saat gagal atau `06-pose-selebrasi-menang.jpg` saat berhasil.
3. **Editor Stage Challenge di Admin (`ChallengeBuilder`):**
   - Pembuat peta visual klik-petak, pengaturan posisi awal & arah, pemilihan karakter & suara efek, centang blok yang tersedia, batas blok ideal, serta mode **Uji Stage** langsung di editor.

### Kriteria Selesai Tahap 4
- Unit test evaluator challenge (jalan lurus, belok, lompat rintangan, ambil semua bintang, tabrak dinding, batas 200 langkah pada loop) lulus 100%.
- Admin dapat membuat Stage 2 bertipe `challenge` dan menguji solusinya langsung di editor.

---

## Tahap 5 — Sesi Live Real-Time & Kontrol Layar Siswa (WebSocket)

**Tujuan:** Mengaktifkan inti pembelajaran sinkron—Admin mengontrol stage & pemutaran secara real-time, layar hingga 20 siswa terkunci mengikuti Admin, dan progres tercatat langsung.

### Ruang Lingkup Pekerjaan
1. **Database Sesi Live (`db/migrations/004_sesi_live.sql`):**
   - Tabel `live_sessions` (maks. 1 sesi aktif per kelas, `maks_siswa <= 20`) dan `student_stage_progress`.
2. **WebSocket Hub (`src/ws/hub.ts`):**
   - Verifikasi cookie JWT saat upgrade `/ws?session_id=...`.
   - Penegakan kapasitas maksimal **20 siswa** per sesi (tolak koneksi siswa ke-21 dengan close code `4009`).
   - Broadcast event `session:state`, `session:presence`, `student:progress`, `session:ended`, serta penolakan pesan kontrol dari klien non-Admin.
3. **Panel Kontrol Live Admin (`/admin/live/[session_id]` & `/api/v1/admin/live-sessions/*`):**
   - Memilih stage aktif (`Stage 1`, `Stage 2`, ...), tombol **Sebelumnya / Berikutnya**.
   - Kontrol `Putar / Jeda / Ulang` untuk stage `story` dan toggle `Kunci / Buka Interaksi` untuk stage `challenge`.
   - Grid pemantau **20 siswa** real-time (online/offline, status pengerjaan, jumlah percobaan & blok) dan tombol **Akhiri Sesi**.
4. **Ruang Pembelajaran Siswa (`/kelas/[class_id]/live` & `POST /api/v1/live-sessions/[id]/progress`):**
   - Layar tunggu jika sesi belum dimulai; otomatis masuk saat sesi aktif.
   - Layar terkunci pada `active_stage_id` tanpa kontrol navigasi stage mandiri.
   - Pengiriman percobaan challenge memvalidasi ulang solusi di server sebelum menyimpan `student_stage_progress` dan memancarkan pembaruan ke Admin.

### Kriteria Selesai Tahap 5
- Integration test API live session (penolakan akses stage lain, penolakan saat `challenge_locked`, batas 20 siswa) lulus.
- **Playwright E2E multi-browser** (Browser Admin + Browser Siswa) membuktikan: Landing `/` -> login Admin & Siswa -> join invite -> sinkron pindah stage & putar cerita -> kunci/buka challenge -> siswa menyelesaikan challenge & Admin melihat status selesai secara real-time -> batas 20 siswa vs ke-21.

---

## Tahap 6 — Pemolesan, Ketahanan Jaringan, & Kesiapan Deployment Online

**Tujuan:** Memastikan aplikasi tangguh saat koneksi siswa terputus-sambung, aman di server publik, dan terdokumentasi untuk deployment.

### Ruang Lingkup Pekerjaan
1. **Ketahanan Real-Time & UX:**
   - Auto-reconnect WebSocket dengan backoff di klien siswa & sinkron ulang `session:state` otomatis.
   - Dukungan `prefers-reduced-motion` dan pesan status ramah anak saat koneksi terputus sementara.
   - Optimasi ukuran & header `Cache-Control` pada aset maskot serta `/api/v1/media/[asset_id]`.
2. **Kesiapan Produksi Online:**
   - Verifikasi konfigurasi `NODE_ENV=production`, `AUTH_URL` HTTPS, `trustHost`, cookie `__Secure-` di balik reverse proxy.
   - Tambahkan `Dockerfile` (opsional bila deploy container) atau panduan deploy VPS (PostgreSQL + Node.js `server.ts` + Caddy/Nginx reverse proxy HTTPS/WSS + S3/volume persisten `.media/`).
3. **Gerbang Verifikasi Akhir (Berurutan):**
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm run test:e2e`
   - Uji manual alur lengkap Admin + minimal 2 browser siswa (desktop & suara aktif).

### Kriteria Selesai Tahap 6
- Seluruh suite test (`typecheck`, unit, integrasi, `next build`, Playwright E2E) lulus tanpa error.
- Aplikasi berhasil dijalankan dalam mode produksi (`next build` + `node dist/server.js` / `start`) dan siap di-deploy ke server online.
