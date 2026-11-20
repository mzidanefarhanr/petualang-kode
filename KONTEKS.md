# KONTEKS.md — Ringkasan Proyek Petualang Kode

> Dokumen ini adalah ringkasan satu halaman untuk memberi konteks cepat kepada siapa pun (termasuk agen AI) yang masuk ke proyek **Petualang Kode**. Untuk detail mengikat, lihat dokumen acuan di bagian akhir.

---

## Apa yang dibangun

**Petualang Kode** adalah platform belajar coding visual interaktif (ala Scratch / PictoBlox / CodeMonkey) yang dipandu langsung secara sinkron (*live-guided*) oleh satu **Admin** (pengajar).

Admin membuat kelas, mendaftarkan akun siswa, membagikan tautan **invite class**, dan menyusun materi belajar berbentuk **rangkaian Stage** (`Stage 1`, `Stage 2`, dst.). Tidak setiap stage berupa teka-teki blok coding—sebuah stage bisa berupa:
1. **Stage Cerita (`story`)**: cerita berjalan dengan latar, karakter/gambar bergerak di atas **timeline** berbasis waktu, dialog, dan **suara** (musik/efek/narasi).
2. **Stage Challenge (`challenge`)**: tantangan visual blok ala **CodeMonkey** untuk menggerakkan karakter di panggung/peta 2D menuju tujuan menggunakan blok visual (**Blockly**), lengkap dengan animasi langkah, efek suara, dan pemeriksaan solusi otomatis.

Saat pembelajaran berlangsung (maksimal **20 siswa** dalam satu sesi), **layar seluruh siswa terkunci mengikuti stage yang sedang ditampilkan Admin** secara real-time melalui WebSocket.

---

## Siapa yang mengerjakan

Satu pengajar/pengembang bekerja sendirian. Tidak ada tim developer, tidak ada peninjau kode, dan tidak ada tim operasional terpisah. Konsekuensinya: arsitektur harus tetap sederhana (satu aplikasi terpadu), perubahan kecil dan jelas lebih berharga daripada abstraksi rumit, dan kode harus mudah dirawat serta di-deploy online sendiri.

---

## Pengguna dan peran

| Peran | Siapa | Yang bisa dilakukan |
|---|---|---|
| **Admin** | Satu akun pengajar/pemilik | Membuat kelas, akun siswa, dan invite class; menyusun materi (stage cerita ber-timeline + suara, serta stage challenge blok); menjalankan sesi live; mengontrol stage & pemutaran cerita di layar semua siswa; memantau progres siswa secara langsung. |
| **Siswa** | Anak-anak yang diundang ke kelas (maks. 20/sesi) | Masuk memakai akun yang dibuatkan Admin, bergabung lewat invite class, menonton stage cerita yang dikendalikan Admin, dan menyusun blok pada stage challenge ketika dibuka Admin. Tidak bisa mendaftar sendiri, membuat materi, atau melompati stage. |

Tidak ada peran multi-admin, wali murid, atau registrasi publik mandiri di v1.

---

## Stack

| Bagian | Pilihan |
|---|---|
| Aplikasi web & server real-time | Next.js (App Router), TypeScript, Custom Node.js HTTP + WebSocket Server (`ws`) |
| Editor blok visual | Blockly (`blockly`) |
| Panggung cerita & peta challenge | HTML5 Canvas / SVG / DOM terstruktur + Web Audio / `<audio>` |
| Gaya | Tailwind CSS |
| Database | PostgreSQL 15+ (SQL migrasi sebagai sumber kebenaran) |
| Penyimpanan media (gambar & suara) | Volume persisten lokal / S3-kompatibel |
| Uji | Vitest (unit & integrasi), Playwright (E2E termasuk sinkronisasi real-time) |

**Sengaja tidak dipakai:** microservices/multi-repo, GraphQL, tabel sesi buatan sendiri, SaaS real-time berbayar terpisah, mesin Scratch `.sb3` (`scratch-gui`/`scratch-vm`), mode offline-first.

---

## Alur inti

1. Pengunjung membuka **Landing Page** (`/`) untuk melihat pengenalan **Petualang Kode**, fitur utama, tombol **Masuk**, dan kolom memasukkan kode **invite class** (tidak langsung dilempar ke halaman login).
2. Admin masuk di `/masuk`, membuat kelas, dan membuat akun siswa (`username` + kata sandi/PIN) serta tautan/kode **invite class**.
2. Admin menyusun **Pelajaran (Lesson)** berisi urutan **Stage**:
   - Stage **Cerita**: mengatur latar, aset gambar bergerak, track **timeline** (waktu mulai/selesai, gerak posisi, dialog), dan track **suara**.
   - Stage **Challenge**: mengatur peta 2D (ukuran grid, posisi awal karakter, target, koin/bintang, rintangan), daftar blok Blockly yang tersedia, serta efek suara.
3. Admin membuka **Sesi Live** untuk satu kelas dan satu pelajaran.
4. Siswa masuk memakai akun yang dibuat Admin, membuka tautan **invite class**, lalu otomatis masuk ke ruang sesi live.
5. Layar siswa **terkunci** pada stage aktif yang dipilih Admin:
   - Pada stage **Cerita**: Admin memicu putar/jeda/ulang timeline cerita, semua layar siswa memutar animasi dan suara yang sama.
   - Pada stage **Challenge**: saat interaksi dibuka Admin, siswa menyusun blok dan menekan **Jalankan** untuk menggerakkan karakter di peta; hasil percobaan & status selesai langsung terkirim ke dashboard Admin.
6. Admin memindah ke stage berikutnya/sebelumnya atau mengakhiri sesi kapan saja.

---

## Model data ringkas

```text
admins ─┬─< media_assets
        ├─< classes ─┬─< class_members >─ students
        │            ├─< class_invites
        │            └─< live_sessions ─< student_stage_progress
        └─< lessons ───< stages
```

---

## Batas keras (tidak bisa dinegosiasikan)

1. **Hanya Admin yang dapat membuat konten dan akun siswa.** Tidak ada endpoint registrasi publik untuk siswa maupun pembuatan materi oleh siswa.
2. **Kontrol stage live berpusat di server.** Siswa tidak bisa berpindah stage di luar `active_stage_id` pada `live_sessions` yang sedang berjalan atau saat interaksi dikunci Admin.
3. **Semua pemeriksaan izin dilakukan di server** (API dan handshake/event WebSocket wajib memverifikasi sesi JWT dan keanggotaan kelas/kepemilikan `admin_id`).
4. **Waktu keputusan berasal dari server** (`now()` PostgreSQL), bukan jam perangkat siswa.
5. **Berkas migrasi SQL (`db/migrations/`) tidak pernah diubah setelah dijalankan.** Perubahan skema selalu memakai berkas migrasi baru.
6. **Tidak membuat tabel sesi sendiri.** Autentikasi memakai Auth.js strategi JWT di cookie `HttpOnly`.
7. **Semua konten HTML/teks dan unggahan media divalidasi & dibatasi di server** (tipe MIME gambar/audio yang aman dan batas ukuran file).

---

## Dokumen acuan

| Dokumen | Isi |
|---|---|
| `AGENTS.md` | Kontrak kerja agen: konvensi, batas keras, alur kerja, struktur workspace |
| `ARCHITECTURE.md` | Arsitektur aplikasi terpadu, WebSocket real-time, media, dan deployment online |
| `REQUIREMENTS.md` | Kebutuhan fungsional, batas operasional (20 siswa/sesi), dan ruang lingkup v1 |
| `DATABASE.md` | Skema database PostgreSQL 15+ — sumber kebenaran SQL |
| `API-CONTRACTS.md` | Kontrak REST `/api/v1/*` dan protokol event WebSocket |
| `DESIGN.md` | Daftar layar Admin dan Siswa, timeline builder, panggung challenge, dan aturan UI |
| `DECISIONS.md` | Keputusan arsitektur dan produk yang dikunci |
| `ROADMAP.md` | Peta jalan pembangunan aplikasi per tahap (Tahap 1–6) |
| `TESTING.md` | Rencana pengujian unit, integrasi, E2E real-time, dan checklist deployment |
| `DEPLOYMENT.md` | Panduan konfigurasi, reverse proxy HTTPS/WSS, dan deployment ke server online |

Kalau kode dan dokumen berbeda, **dokumen yang benar** — kecuali dokumen tersebut jelas sudah usang. Dalam hal itu, hentikan dan tanyakan.
