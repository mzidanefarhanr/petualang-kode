# ARCHITECTURE.md — Arsitektur Sistem Petualang Kode v1

> Dokumen ini menjelaskan arsitektur aplikasi terpadu **Petualang Kode**, komunikasi real-time WebSocket, penyimpanan media (gambar & suara), dan strategi deployment online.

---

## 1. Gambaran Umum Sistem

**Petualang Kode** dibangun sebagai **satu aplikasi web terpadu** (monolith sederhana berbasis Node.js + Next.js App Router) agar mudah dirawat satu orang dan mudah di-deploy ke server online tanpa masalah CORS atau cookie lintas subdomain.

```text
+-----------------------------------------------------------------------+
|                    Server Node.js Tunggal (Online)                    |
|                                                                       |
|  +-----------------------------+   +-------------------------------+  |
|  |   Next.js App Router        |   |   WebSocket Hub (`ws`)        |  |
|  |   - UI Admin & Builder      |   |   - Room per `live_session`   |  |
|  |   - UI Siswa & Player       |<->|   - Broadcast stage aktif     |  |
|  |   - REST API `/api/v1/*`    |   |   - Kontrol putar cerita      |  |
|  |   - Auth.js JWT Session     |   |   - Status & progres live     |  |
|  +--------------+--------------+   +---------------+---------------+  |
|                 |                                  |                  |
+-----------------|----------------------------------|------------------+
                  |                                  |
        +---------+---------+              +---------+---------+
        |                   |              |                   |
        v                   v              v                   |
+---------------+   +-------------------+                      |
| PostgreSQL    |   | Media Storage     |                      |
| 15+ (SQL)     |   | Gambar & Suara    |  (Koneksi WSS/HTTPS  |
| Data, Stage,  |   | Lokal / S3-Compat |   maks. 20 siswa/sesi|
| Timeline, Log |   +-------------------+   + 1 Admin)         |
+---------------+                                              |
```

---

## 2. Alasan Arsitektur Tunggal

1. **Tanpa lintas subdomain**: Admin dan Siswa berada di origin yang sama (`https://domainanda.com`), sehingga cookie sesi `HttpOnly; SameSite=Lax` bekerja stabil di semua browser tanpa konfigurasi CORS/cookie lintas subdomain.
2. **WebSocket bawaan di server Node.js**: Custom `server.ts` membungkus `http.createServer` yang meneruskan request HTTP ke Next.js dan upgrade `/ws` ke server WebSocket `ws`. Untuk skala 20 siswa per sesi + 1 Admin, satu instance Node.js sudah sangat ringan dan stabil tanpa memerlukan Redis atau layanan WebSocket eksternal.
3. **Siap deploy online**: Dapat dijalankan langsung di VPS (Ubuntu + Nginx/Caddy reverse proxy HTTPS/WSS) atau platform PaaS berbasis container (Docker / Railway / Fly.io / Render).

---

## 3. Pembagian Modul Internal (`src/`)

- **`src/server.ts`**: Titik masuk produksi & dev; menginisialisasi Next.js app, HTTP server, dan WebSocket server pada path `/ws`.
- **`src/auth.ts`**: Auth.js v5 strategi JWT dengan dua provider kredensial: `admin` (`email + password`) dan `student` (`username + password`).
- **`src/lib/access.ts`**: Guard otorisasi terpusat (`requireAdmin`, `requireStudent`) yang menelusuri kepemilikan hingga `admins.id` atau keanggotaan `class_members`.
- **`src/lib/challenge/`**:
  - Definisi struktur peta 2D CodeMonkey (grid, arah `N/E/S/W`, rintangan, koin/bintang, target).
  - Evaluator/simulator langkah yang dijalankan **di browser untuk animasi** sekaligus **di server untuk memvalidasi kemenangan** saat siswa mengirim solusi (mencegah manipulasi status selesai dari browser).
- **`src/lib/story/`**: Validator skema JSON timeline cerita (durasi, track aktor/gambar bergerak, keyframe posisi/opasitas, track dialog, track audio).
- **`src/lib/storage.ts`**: Penyimpanan media gambar & audio (`local` volume disk atau `s3` S3-kompatibel).
- **`src/ws/hub.ts`**: Pengelola koneksi WebSocket per `live_session_id`:
  - Memverifikasi cookie sesi JWT saat HTTP upgrade (`ws` `verifyClient`/handshake).
  - Menjaga daftar peserta aktif (maksimal 20 siswa per sesi).
  - Menerima perintah kontrol hanya dari Admin pemilik sesi, memperbarui state DB (`live_sessions`), lalu menyiarkan (`broadcast`) state terbaru ke semua siswa di room.

---

## 4. Alur Teknis Kritis

### 4.1 Autentikasi & Invite Class
1. Admin membuat kelas (`classes`), membuat akun siswa (`students` dengan `username` unik & `password_hash`), memasukkan siswa ke kelas (`class_members`), dan membuat kode/tautan undangan kelas (`class_invites`).
2. Siswa membuka tautan `/join/<kode>`:
   - Jika belum login: diarahkan untuk login memakai `username` + kata sandi/PIN yang diberikan Admin (bukan mendaftar akun baru secara bebas).
   - Setelah login valid: server memverifikasi siswa memang terdaftar di kelas tersebut (atau menambahkan keanggotaan khusus siswa yang sudah dibuat Admin bila undangan mengizinkan), lalu mengarahkan ke ruang sesi live kelas (`/kelas/<class_id>/live`).

### 4.2 Sinkronisasi Layar Live (Admin → Siswa)
1. Admin memulai `live_session` untuk `(class_id, lesson_id)` dengan `active_stage_id = stage_1.id`.
2. Klien Siswa membuka koneksi WebSocket ke `/ws?session_id=<id>`. Server memverifikasi:
   - Cookie JWT sesi valid dan `role === 'student'`.
   - Siswa adalah anggota `class_members` untuk kelas sesi tersebut.
   - Jumlah siswa aktif dalam sesi `< 20` (atau siswa tersebut sudah terhubung dan melakukan reconnect).
3. Server mengirim pesan `session:state` berisi:
   - `active_stage` (lengkap dengan konfigurasi cerita atau peta challenge — tanpa membocorkan kunci jawaban admin bila ada).
   - `playback_state` (untuk stage cerita: `idle | playing | paused`, `started_at_server_ms`, `offset_ms`).
   - `challenge_locked` (boolean: apakah siswa boleh menyusun & menjalankan blok pada stage challenge saat ini).
4. Ketika Admin menekan **Pindah Stage**, **Putar/Jeda Cerita**, atau **Kunci/Buka Challenge**:
   - Server memperbarui kolom terkait di `live_sessions` di PostgreSQL.
   - Server langsung mem-broadcast `session:state` ke seluruh siswa di room sehingga layar semua siswa terkunci dan berpindah seketika.

### 4.3 Eksekusi Stage Cerita (Timeline & Suara)
- Setiap stage `story` menyimpan konfigurasi JSON `story_config`:
  - `duration_ms`: total durasi adegan.
  - `background_asset_id`: gambar latar.
  - `actors`: daftar sprite/gambar bergerak (posisi awal `x, y`, ukuran, `asset_id`).
  - `timeline`: daftar track event/keyframe terurut waktu (`start_ms`, `end_ms`):
    - **Gerak (`move`)**: interpolasi posisi `(x, y)`, skala, rotasi, atau tampil/sembunyi (`opacity`) pada aktor tertentu.
    - **Dialog (`dialogue`)**: teks narasi/balon bicara yang muncul pada rentang waktu tertentu.
    - **Suara (`audio`)**: memutar aset audio (`asset_id`) pada `start_ms` dengan volume & opsi loop (musik latar / efek suara / narasi).
- Saat mode live, posisi waktu pemutaran disinkronkan berdasarkan `playback_state` dari server agar semua komputer siswa menampilkan adegan yang selaras.

### 4.4 Eksekusi Stage Challenge (Blockly ala CodeMonkey)
- Setiap stage `challenge` menyimpan `challenge_config` JSON:
  - Ukuran grid (`cols`, `rows`), peta tile (`floor`, `wall`, `water`), posisi & arah awal karakter, daftar item (`star`/`coin`), posisi target (`goal`), daftar blok Blockly yang diaktifkan, serta aset suara (langkah, ambil item, menang, gagal).
- Siswa menyusun blok di Blockly lalu menekan **Jalankan**:
  - Kode/AST blok yang disusun dikonversi menjadi daftar aksi terstruktur (mis. `["move", "turn_left", "repeat(3, [...])"]`) — **bukan `eval()` sembarang JavaScript** demi keamanan.
  - Klien menjalankan animasi langkah demi langkah di kanvas + memutar efek suara.
  - Klien mengirim urutan aksi (atau XML/JSON workspace Blockly) ke server (`POST /api/v1/live-sessions/{id}/progress`).
  - Server menjalankan simulator deterministik yang sama untuk memverifikasi apakah karakter benar-benar mencapai target, mencatat `status` (`attempted` / `completed`), `attempts`, `blocks_used`, dan langsung mengirim pembaruan progres ke Admin via WebSocket.

---

## 5. Media Storage & Keamanan Konten

- Admin mengunggah gambar (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg` — dengan sanitasi atau pembatasan tipe aman; hindari eksekusi skrip di SVG dengan `Content-Security-Policy: sandbox` / `Content-Disposition: inline` aman atau batasi SVG bila perlu) dan audio (`.mp3`, `.wav`, `.ogg`, `.webm`).
- Batas awal ukuran unggahan media: **10 MB** per berkas.
- Berkas disajikan lewat `/api/v1/media/{asset_id}` dengan header cache yang tepat serta pemeriksaan izin pengguna yang sudah login.

---

## 6. Kesiapan Deployment Online

- **Reverse proxy (Nginx / Caddy / Cloud Load Balancer)** meneruskan HTTPS (`443`) dan upgrade WebSocket (`Upgrade: websocket`, `Connection: upgrade`) ke port aplikasi Node.js (`3000`).
- **Environment produksi**:
  - `NODE_ENV=production`
  - `AUTH_URL=https://domainanda.com`
  - `DATABASE_URL=postgresql://...`
  - `MEDIA_STORAGE=s3` (atau `local` dengan persistent volume disk bila single-server VPS)
  - Cookie `secure: true` otomatis aktif saat `NODE_ENV=production` dan di balik HTTPS (`trustHost: true`).
