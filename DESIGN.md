# DESIGN.md — Antarmuka Petualang Kode v1

> Daftar layar, tata letak, dan prinsip desain antarmuka untuk **Admin** (pengajar & pembuat materi) serta **Siswa** (anak SD/SMP peserta kelas).

---

## 1. Prinsip Desain, Palet Warna & Maskot

### 1.1 Prinsip Antarmuka
1. **Siswa fokus pada panggung, tanpa tombol keluar/loncat stage sendiri.** Saat sesi live aktif, layar siswa bersih: hanya header tipis (judul kelas & stage aktif), panggung cerita/challenge besar di tengah, dan (khusus stage `challenge`) kotak blok Blockly.
2. **Bahasa ramah anak untuk siswa.** Pesan status jelas dan menenangkan (*"Menunggu pengajar membuka tantangan…"*, *"Hebat! Kamu berhasil sampai tujuan!"*).
3. **Panel Admin efisien dan langsung pakai.** Halaman Admin ringkas agar satu pengajar bisa membuat materi, timeline cerita, peta challenge, dan mengontrol 20 siswa dengan klik minimal.
4. **Tipografi ramah anak.** Menggunakan font **`Nunito`** (`400, 600, 700, 800, 900`, fallback `system-ui, sans-serif`) agar mudah dibaca siswa SD/SMP.

### 1.2 Palet Warna Resmi (Acuan `petualang-kode-v3.html`)

| Token | Hex | Penggunaan |
|---|---|---|
| `--teal` / `--teal-dark` / `--teal-deeper` | `#04a5ad` / `#037d84` / `#025f65` | Latar hero landing page, header sticky, aksen blok `MAJU`, status sinkron live |
| `--navy` / `--navy-mid` | `#1e2d5a` / `#263670` | Heading utama, tombol utama `Masuk`, latar bagian langkah & footer, latar kartu kode/live |
| `--cream` / `--cream-dark` | `#FFF8F0` / `#F5EDE0` | Latar utama bagian fitur dan kartu konten terang |
| `--amber` | `#F5A623` | Tombol navigasi `Masuk`, sorotan teks hero, rompi maskot |
| `--coral` / `--coral-dark` | `#e3235b` / `#b81847` | Tombol `Gabung kelas`, blok `LOMPAT`, pin daun maskot |
| `--purple` (blok belok) | `#7c4dff` | Aksen blok `BELOK` pada editor/pratinjau blok |
| `--green` (sukses/aktif) | `#7ed957` | Indikator sesi aktif & status misi berhasil |
| `--ink` / `--muted` | `#1a1a2e` / `#6b7a9b` | Teks utama dan teks sekunder |

### 1.3 Panduan Penggunaan Maskot **Kelinci Penjelajah**
- **Landing Page (Hero)**: gunakan **SVG inline Kelinci Penjelajah** (latar transparan + animasi mengambang) agar tajam di semua ukuran layar.
- **Halaman Masuk (`/masuk`) & Layar Tunggu / Empty State**: gunakan `07-pose-menyapa-onboarding.jpg`.
- **Saat Challenge Gagal / Error / Periksa Blok**: gunakan `05-pose-berpikir-debugging.jpg`.
- **Saat Stage / Misi Challenge Selesai**: gunakan `06-pose-selebrasi-menang.jpg`.
- **Avatar Siswa, Badge, & Ikon Peta**: gunakan `08-ikon-kepala-avatar.jpg` (bingkai bulat `border-radius: 50%` dengan border `#1e2d5a`, karena latar file `.jpg` seragam `#04a5ad`).
- **Stiker Reaksi / Milestone / Mini-game**: gunakan variasi `maskot/gaya-visual/` (`01-gaya-flat-vektor.jpg` untuk ikon/peta, `02-gaya-3d-soft-clay.jpg` untuk sambutan/milestone, `03-gaya-pixel-art.jpg` untuk tema retro/easter-egg, `04-gaya-stiker-chibi.jpg` untuk pop-up penyemangat).

---

## 2. Daftar Layar

### Layar 1 — Landing Page (`/`)
- Halaman publik pertama saat membuka aplikasi (mengikuti struktur & palet `petualang-kode-v3.html`, tidak langsung redirect ke `/masuk`).
- Isi utama:
  - **Navbar (`#025f65`)**: tautan section (`#fitur`, `#cara`), logo `PetualangKode`, dan tombol **Masuk** (`#F5A623`) menuju `/masuk`.
  - **Hero (`#04a5ad`)**: judul & deskripsi **Petualang Kode**, tombol utama **Masuk** (`/masuk`), form **Masukkan Kode Kelas** (langsung menuju `/join/<kode>`), serta **SVG inline Kelinci Penjelajah** dengan animasi mengambang.
  - **Trust Strip (`#F5EDE0`)**: ringkasan metrik singkat (maks. 20 siswa/sesi, dipandu guru langsung, jenjang SD–SMP).
  - **Fitur Zigzag (`#FFF8F0`)**: (1) Cerita Bergerak & Suara (timeline), (2) Tantangan Blok Interaktif ala peta 2D, (3) Kontrol Layar Kelas Live (grid monitor siswa sinkron).
  - **Langkah Belajar (`#1e2d5a`)**: 3 langkah (Guru bagikan kode -> Masuk dengan akun dari guru -> Ikuti tahap live bersama).
  - **CTA Band (`#04a5ad`) & Footer (`#1e2d5a`)**: ajakan masuk + catatan bahwa akun siswa dibuatkan oleh guru/admin.
  - Jika pengguna sudah login, tombol **Masuk** dapat diarahkan ke dashboard sesuai peran (`/admin` atau ruang kelas).

### Layar 2 — Masuk (`/masuk`)
- Satu form masuk dengan dua tab: **Siswa** dan **Admin**.
- **Tab Siswa**: `Username` + `Kata sandi / PIN` (tanpa link daftar mandiri, dengan keterangan *"Minta nama pengguna dan kata sandi ke pengajar."*).
- **Tab Admin**: `Email` + `Kata sandi`.

### Layar 3 — Gabung Kelas lewat Invite (`/join/[kode]`)
- Menampilkan nama kelas dan nama pengajar dari invite class.
- Jika invite sudah kedaluwarsa/dicabut: tampilkan pesan ramah.
- Jika belum login sebagai Siswa: tampilkan form masuk Siswa (akun buatan Admin) langsung di halaman tersebut agar setelah login langsung masuk ke kelas.
- Jika sudah login sebagai Siswa yang terdaftar di kelas: tombol **Masuk ke Kelas** -> mengarahkan ke `/kelas/[class_id]/live`.

### Layar 4 — Ruang Pembelajaran Live Siswa (`/kelas/[class_id]/live`)
- **Jika belum ada sesi live aktif**: layar tunggu ramah (*"Halo [Nama]! Menunggu pengajar memulai pelajaran…"*), otomatis aktif begitu Admin memulai sesi lewat WebSocket.
- **Jika sesi live penuh (20 siswa)**: tampil pesan jelas (*"Kelas sedang penuh (maksimal 20 siswa). Hubungi pengajar."*).
- **Saat Stage Tipe `story` aktif**:
  - Panggung animasi penuh di tengah (latar + karakter/gambar bergerak + balon dialog).
  - Pemutar suara & animasi berjalan sinkron mengikuti kontrol Admin (**Putar / Jeda / Ulang**).
  - Tidak ada tombol pindah ke Stage berikutnya/sebelumnya.
- **Saat Stage Tipe `challenge` aktif**:
  - Sisi kiri: workspace **Blockly** berisi hanya blok yang diaktifkan untuk stage tersebut + tombol **Jalankan** & **Reset**.
  - Sisi kanan: panggung/peta 2D CodeMonkey (grid, karakter, rintangan, koin/bintang, tujuan) + instruksi misi singkat.
  - Jika `challenge_locked = true` dari Admin: overlay/banner *"Perhatikan penjelasan pengajar dulu ya…"* dan papan blok dinonaktifkan.
  - Saat program dijalankan: karakter bergerak langkah demi langkah disertai suara efek; muncul umpan balik berhasil atau ajakan mencoba lagi jika menabrak/belum sampai tujuan.

### Layar 5 — Dashboard Admin (`/admin`)
- Navigasi utama Admin: **Kelas**, **Siswa**, **Pelajaran**, **Media**.
- Ringkasan daftar kelas beserta jumlah siswa, tombol cepat buka kelas, buat kelas, atau mulai sesi live.

### Layar 6 — Kelola Kelas & Siswa (`/admin/kelas/[class_id]`, `/admin/siswa`)
- **Akun Siswa**: form tambah siswa (`Nama`, `Username`, `Kata sandi/PIN`), reset kata sandi, dan daftar siswa dalam kelas.
- **Invite Class**: buat tautan undangan (`/join/[kode]`), salin tautan, lihat masa berlaku, cabut undangan.
- **Mulai Sesi Live**: pilih pelajaran lalu tekan **Mulai Sesi Live**.

### Layar 7 — Pustaka Media (`/admin/media`)
- Tab **Gambar** dan **Suara**.
- Form unggah drag/pilih file (maks. 10 MB) + beri nama aset.
- Pratinjau thumbnail gambar dan pemutar audio mini untuk suara.

### Layar 8 — Pembuat Pelajaran & Stage (`/admin/pelajaran` & `/admin/pelajaran/[lesson_id]`)
- Daftar stage berurutan (`Stage 1`, `Stage 2`, ...) dengan tombol naik/turun urutan, tambah **Stage Cerita**, tambah **Stage Challenge**, dan hapus.
- **Editor Stage Cerita (`story`)**:
  - Kiri/atas: panggung pratinjau langsung (drag/atur posisi aktor) + kontrol **Putar / Jeda / Reset Pratinjau**.
  - Bawah: **Timeline Editor** berbasis detik:
    - Baris/track per aktor (gerak `x,y`, skala, muncul/sembunyi), track dialog, dan track suara (`asset audio`, waktu mulai, volume, loop).
    - Klik track untuk mengedit waktu mulai/durasi dan nilai keyframe.
- **Editor Stage Challenge (`challenge`)**:
  - Editor peta grid visual (klik petak untuk memasang dinding/rintangan, bintang/koin, posisi awal karakter + arah hadap, dan tujuan).
  - Pilih aset karakter & aset suara efek.
  - Centang blok Blockly yang diizinkan di stage tersebut (`maju`, `putar_kiri`, `putar_kanan`, `ulangi`, `ambil`, `lompat`).
  - Panel **Uji Stage** di tempat untuk mencoba menyusun blok & memverifikasi solusi.

### Layar 9 — Panel Kontrol Live Admin (`/admin/live/[session_id]`)
- **Bar Kontrol Atas**:
  - Judul kelas & pelajaran.
  - Daftar pil/tombol Stage (`Stage 1`, `Stage 2`, ...) + tombol **Sebelumnya** & **Berikutnya**.
  - Jika stage `story`: tombol **Putar Cerita di Layar Siswa**, **Jeda**, **Ulangi**.
  - Jika stage `challenge`: toggle **Kunci Interaksi Siswa / Buka Interaksi**.
  - Tombol **Akhiri Sesi** (dengan konfirmasi).
- **Area Utama**:
  - Kiri: pratinjau mini stage yang sedang tampil di layar siswa.
  - Kanan: **Grid Pemantau 20 Siswa** — menampilkan nama siswa, indikator online/offline real-time, serta untuk stage challenge: status (*Belum mencoba / Sedang mencoba N kali / Selesai*), jumlah blok yang dipakai.
