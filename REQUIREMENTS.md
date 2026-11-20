# REQUIREMENTS.md — Petualang Kode v1

> Dokumen ini menetapkan ruang lingkup **Petualang Kode v1** beserta batas teknis dan fitur yang sengaja ditunda agar pembangunan oleh satu orang tetap fokus dan selesai.

---

## 1. Tujuan

Membangun aplikasi pembelajaran coding visual interaktif (ala Scratch / PictoBlox / CodeMonkey) yang dipandu secara langsung oleh satu **Admin** untuk kelas hingga **20 siswa** per sesi, dan siap di-deploy ke server online.

Kemampuan inti:
- **Admin** membuat kelas, mendaftarkan akun siswa, membuat invite class, menyusun materi berbasis stage, dan mengontrol layar seluruh siswa secara real-time.
- **Materi berbentuk Stage/Slide**:
  - **Stage Cerita (`story`)**: cerita berjalan dengan gambar bergerak, dialog, **timeline** berbasis waktu, dan **suara**.
  - **Stage Challenge (`challenge`)**: tantangan menyusun blok visual untuk menggerakkan karakter di panggung/peta 2D menuju tujuan.
- **Siswa** login dengan akun yang dibuat Admin, masuk lewat invite class, dan layarnya otomatis terkunci mengikuti stage yang ditampilkan Admin.

---

## 2. Pengguna dan Peran

| Peran | Siapa | Hak Akses |
|---|---|---|
| **Admin** | Pengajar / pemilik platform (akun tunggal) | Membuat kelas, akun siswa, invite class, media (gambar/suara), pelajaran, stage cerita & challenge, memulai sesi live, mengontrol stage & pemutaran cerita, melihat progres semua siswa. |
| **Siswa** | Peserta didik (maks. 20/sesi) | Login memakai akun buatan Admin, masuk kelas lewat invite class, melihat stage sesuai kontrol Admin, menonton cerita bergerak + suara, menyusun & menjalankan blok pada stage challenge. |

**Tidak ada di v1:** registrasi mandiri siswa, banyak admin/guru kolaborator, akun orang tua, forum/chat antar siswa, rapor angka formal.

---

## 3. Kebutuhan Fungsional v1

### 3.1 Landing Page, Autentikasi & Manajemen Kelas oleh Admin
- Rute utama `/` menampilkan **Landing Page** publik **Petualang Kode** (memperkenalkan konsep belajar coding berbasis cerita & tantangan blok, alur live class, tombol **Masuk**, dan input kode **Invite Class**), bukan langsung me-redirect ke `/masuk`.
- Admin login memakai `email` + kata sandi.
- Admin dapat membuat dan mengarsipkan **Kelas**.
- Admin membuat akun **Siswa** (`nama`, `username` unik, kata sandi/PIN) dan memasukkannya ke satu atau beberapa kelas.
- Siswa login memakai `username` + kata sandi/PIN yang dibuatkan Admin.
- Admin dapat membuat tautan/kode **Invite Class** (dengan masa berlaku dan status aktif/dicabut) untuk mengarahkan siswa ke ruang pembelajaran kelas tersebut.

### 3.2 Manajemen Aset Media (Gambar & Suara)
- Admin dapat mengunggah aset **gambar** (`png`, `jpg`, `jpeg`, `webp`, `gif`) untuk latar panggung, sprite karakter cerita, karakter peta challenge, dan objek/rintangan.
- Admin dapat mengunggah aset **suara** (`mp3`, `wav`, `ogg`) untuk musik latar, narasi, dan efek suara (langkah, ambil item, menang, gagal).
- Admin dapat memberi label nama aset dan menghapus aset yang tidak dipakai.

### 3.3 Pembuat Pelajaran & Stage (Admin Builder)
- Admin dapat membuat **Pelajaran (`lesson`)** dan menambah, mengurutkan ulang, menyunting, atau menghapus **Stage** (`Stage 1`, `Stage 2`, ...).
- Setiap stage bertipe `story` atau `challenge`.

#### A. Stage Cerita (`story`) — Timeline & Suara
- Memilih gambar latar panggung.
- Menambahkan satu atau lebih **aktor/objek gambar bergerak** (posisi awal `x, y`, ukuran, balik arah/flip).
- Menyusun **Timeline** berbasis waktu (misal dalam detik / milidetik, dengan pratinjau langsung di editor Admin):
  - **Track Gerak / Animasi Aktor**: mengatur waktu mulai & selesai, perpindahan posisi `(x1, y1) -> (x2, y2)`, perubahan skala/rotasi/opasitas (*muncul/hilang*).
  - **Track Dialog / Narasi**: mengatur teks, pembicara/posisi, waktu tampil & selesai.
  - **Track Suara**: memilih file suara, waktu mulai, durasi/stop, volume, dan loop.
- Tombol **Pratinjau (Preview)** di editor Admin untuk menguji animasi + suara sesuai timeline sebelum dipakai di kelas.

#### B. Stage Challenge (`challenge`) — Visual Blok ala CodeMonkey
- Mengatur **panggung/peta 2D berbasis grid**:
  - Ukuran grid (misal `5x5` hingga `12x8`).
  - Tile dasar (rumput/lantai, dinding/rintangan, air/lubang).
  - Posisi & arah awal karakter utama (aset gambar karakter dapat dipilih).
  - Posisi target tujuan (misal bendera/harta karun) dan item opsional (bintang/koin yang harus dikumpulkan).
- Memilih **blok visual (Blockly)** yang tersedia pada stage tersebut (misal: `maju`, `mundur`, `putar kiri`, `putar kanan`, `ulangi N kali`, `ambil`, `lompat`).
- Mengatur petunjuk misi singkat dan batas blok ideal (opsional, untuk indikator efisiensi/bintang).
- Mengatur efek suara bawaan/kustom saat jalan, ambil item, gagal, dan berhasil.
- Tombol **Uji Stage** di editor Admin untuk memastikan challenge dapat diselesaikan.

### 3.4 Sesi Pembelajaran Live & Kontrol Layar Siswa
- Admin dapat memulai **Sesi Live** untuk kelas dan pelajaran tertentu, memilih stage awal (bawaan: Stage 1), serta mengakhiri sesi.
- Kapasitas: maksimal **20 siswa** terhubung dalam satu sesi live.
- Siswa yang masuk lewat invite class dan telah login otomatis terhubung ke sesi live kelas tersebut (bila sesi sedang aktif; jika belum dimulai, tampil layar tunggu ramah *"Menunggu pengajar memulai pelajaran..."*).
- **Kunci Layar Siswa**:
  - Layar siswa otomatis menampilkan stage yang sedang aktif di kontrol Admin.
  - Siswa tidak dapat berpindah ke stage lain secara mandiri.
  - Ketika Admin berpindah stage (`Stage 1` -> `Stage 2`, dst.), layar semua siswa berpindah otomatis dalam hitungan detik (< 1 detik pada koneksi normal).
- **Kontrol Interaksi Live oleh Admin**:
  - Pada stage `story`: Admin dapat menekan **Putar**, **Jeda**, atau **Ulangi** sehingga animasi timeline dan suara berjalan di layar seluruh siswa.
  - Pada stage `challenge`: Admin dapat mengunci atau membuka papan blok siswa (`challenge_locked`), dan memantau status real-time ke-20 siswa (online/offline, jumlah percobaan, sudah selesai / belum).
- Pada stage `challenge` (saat dibuka): siswa menyusun blok di Blockly, menekan **Jalankan** untuk melihat animasi karakter & mendengar efek suara, atau **Reset**, lalu sistem mencatat progres di server.

---

## 4. Yang Tidak Dilakukan di v1

| Tidak ada di v1 | Alasan |
|---|---|
| Registrasi bebas oleh siswa | Sesuai aturan: hanya Admin yang membuat form/akun login siswa. |
| Mode bebas/eksplorasi siswa di luar kontrol Admin saat live | Fokus utama adalah pembelajaran terarah di mana layar siswa terkunci mengikuti Admin. |
| Ekspor/impor `.sb3` atau `scratch-gui` penuh | Challenge v1 berfokus pada puzzle gerak karakter ala CodeMonkey + stage cerita ber-timeline. |
| Chat teks / video call bawaan | Pengajaran berlangsung langsung atau lewat alat komunikasi terpisah; menjaga aplikasi tetap ringan. |
| Mode offline-first | Membutuhkan sinkronisasi lokal dan bertentangan dengan kontrol layar real-time online. |
| Multi-admin / banyak guru dalam satu kelas | Diperuntukkan untuk satu Admin pengajar. |

---

## 5. Batas Teknis dan Operasional Awal

| Batas | Nilai Awal | Keterangan |
|---|---:|---|
| Maksimal siswa per sesi live | 20 | Ditegakkan server saat koneksi WebSocket / gabung sesi |
| Ukuran maks. 1 file media (gambar/audio) | 10 MB | Diperiksa server sebelum disimpan |
| Durasi maks. timeline per stage cerita | 300 detik (5 menit) | Mencegah beban memori berlebih |
| Ukuran grid maks. peta challenge | 16 x 12 petak | Menjaga kejelasan tampilan di layar desktop/laptop |
| Batas langkah eksekusi program blok | 200 langkah | Mencegah infinite loop pada blok `ulangi` |
| Panjang minimal `username` siswa | 3 karakter | Unik tidak peka huruf besar/kecil |
| Panjang minimal kata sandi/PIN siswa | 4 karakter | Dibuat oleh Admin |

---

## 6. Kriteria Selesai v1

v1 dinyatakan selesai jika semua alur berikut teruji berjalan:
1. Admin dapat login, membuat kelas, membuat akun siswa, dan membuat invite class.
2. Siswa tidak dapat mendaftar akun sendiri; siswa hanya bisa login dengan akun buatan Admin dan masuk sesi kelas lewat invite class.
3. Admin dapat mengunggah gambar & suara, membuat pelajaran dengan minimal 1 Stage Cerita (gambar bergerak + timeline + suara) dan 1 Stage Challenge (peta CodeMonkey + blok Blockly + suara).
4. Admin dapat memulai Sesi Live, dan hingga 20 koneksi siswa dapat terhubung ke sesi tersebut (siswa ke-21 ditolak dengan pesan jelas).
5. Saat Admin berpindah stage, memutar/menjeda cerita, atau mengunci challenge, layar siswa langsung mengikuti dan tidak bisa melewati stage lewat UI maupun API/WebSocket.
6. Siswa dapat menyusun blok, menjalankan simulasi karakter + suara pada stage challenge, menang, dan status selesainya langsung muncul di panel Admin.
7. Aplikasi lolos `typecheck`, unit/integration tests, `next build`, Playwright E2E multi-browser (Admin + Siswa), dan siap dijalankan sebagai satu server Node.js untuk deployment online.
