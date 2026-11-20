# DECISIONS.md — Keputusan Arsitektur & Produk (v1)

> Dokumen ini mengunci keputusan teknis dan produk untuk **Petualang Kode v1** beserta alasannya agar tidak diperdebatkan ulang selama pembangunan.

---

## Ringkasan Keputusan Terkunci

### D-01: Satu Aplikasi Web Terpadu (Next.js + Custom HTTP/WebSocket Server)
- **Keputusan**: Menggunakan satu aplikasi Next.js App Router + TypeScript dengan custom `server.ts` Node.js yang juga menjalankan server WebSocket (`ws`) pada `/ws`.
- **Alasan**: Menghilangkan kerumitan dua aplikasi, masalah cookie lintas subdomain di browser (seperti `Domain=.localhost`), dan CORS, serta siap di-deploy ke satu container/VPS online dengan WebSocket bawaan.

### D-02: Kontrol Akun Sepenuhnya oleh Admin (Tanpa Registrasi Mandiri Siswa)
- **Keputusan**: Hanya Admin yang dapat login untuk membuat kelas, membuat materi, membuat akun siswa (`username` + kata sandi/PIN), dan membuat invite class. Tidak ada halaman registrasi bebas untuk siswa.
- **Alasan**: Sesuai kebutuhan pengelolaan kelas anak-anak agar identitas siswa terkendali dan hanya siswa yang terdaftar yang bisa mengikuti sesi live.

### D-03: Materi Berbasis Stage (`story` dan `challenge`)
- **Keputusan**: Setiap pelajaran (`lesson`) terdiri dari stage berurutan dengan dua tipe:
  1. `story`: cerita berjalan dengan gambar bergerak, balon dialog, **timeline** berbasis waktu, dan **suara**.
  2. `challenge`: tantangan visual blok ala **CodeMonkey** untuk menggerakkan karakter di panggung/peta 2D menuju target.
- **Alasan**: Memungkinkan alur belajar campuran—tidak semua tahap berupa puzzle coding, melainkan diawali atau diselingi cerita visual interaktif.

### D-04: Blockly + Evaluator Aksi Terstruktur (Bukan `scratch-gui` dan Bukan `eval`)
- **Keputusan**: Stage challenge memakai `blockly` yang mengekspor daftar instruksi JSON terstruktur (gerak, putar, ulangi, ambil, kondisi) dan dievaluasi oleh simulator deterministik di klien (animasi) sekaligus di server (verifikasi kelulusan).
- **Alasan**: Jauh lebih ringan daripada `scratch-gui`, mendukung aturan menang/kalah peta ala CodeMonkey, dan aman karena tidak mengeksekusi kode arbitrer di server.

### D-05: Layar Siswa Terkunci Mengikuti Stage Aktif Admin via WebSocket
- **Keputusan**: Selama `live_session` aktif, server menjadi sumber kebenaran `active_stage_id`, `playback_state`, dan `challenge_locked`. Siswa tidak memiliki kontrol berpindah stage sendiri; perpindahan dari Admin langsung mendorong pembaruan ke seluruh layar siswa via WebSocket.
- **Alasan**: Memastikan seluruh kelas fokus pada slide/stage yang sama dengan instruksi Admin.

### D-06: Batas Kapasitas Sesi Live Maksimal 20 Siswa
- **Keputusan**: Satu sesi live dibatasi maksimal **20 siswa** aktif secara bersamaan (ditegakkan di server).
- **Alasan**: Memberi jaminan performa sinkronisasi WebSocket, pemutaran media, dan pemantauan real-time pada satu server Node.js.

### D-07: Autentikasi Auth.js v5 Strategi JWT (Tanpa Tabel Sesi)
- **Keputusan**: Menggunakan Auth.js strategi JWT dengan cookie `HttpOnly; SameSite=Lax`, tanpa membuat tabel sesi sendiri di PostgreSQL.
- **Alasan**: Sederhana, aman, dan dapat diverifikasi baik di Next.js App Router maupun pada handshake koneksi WebSocket.

### D-08: SQL Migrasi Berurutan sebagai Sumber Kebenaran Database
- **Keputusan**: PostgreSQL 15+ dengan berkas migrasi berurutan di `db/migrations/`. Migrasi yang sudah dijalankan tidak pernah diedit; perubahan skema selalu lewat migrasi baru.
- **Alasan**: Integritas relasi dan tipe data (`jsonb`, `timestamptz`, `uuid`) eksplisit dan mudah dipelihara oleh satu pengembang.

### D-09: Penyimpanan Media Gambar & Suara Terpisah dari Database
- **Keputusan**: Biner gambar dan file suara disimpan di penyimpanan berkas (`local` disk/volume atau S3-kompatibel), sedangkan PostgreSQL hanya menyimpan metadata aset (`media_assets`).
- **Alasan**: Menjaga ukuran database tetap kecil dan mempermudah caching serta penyajian streaming audio/gambar.

### D-10: Keputusan Waktu Berasal dari Server (`now()`)
- **Keputusan**: Masa berlaku invite class, timestamp sesi live, sinkronisasi `started_at` timeline cerita, dan waktu penyelesaian challenge menggunakan waktu server/database, bukan jam perangkat siswa.
- **Alasan**: Mencegah ketidaksinkronan jam perangkat siswa saat memutar cerita atau memvalidasi undangan.
