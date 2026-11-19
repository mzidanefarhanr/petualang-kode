# ARCHITECTURE.md — Arsitektur Sistem Scratch Kelas v1

> Dokumen ini menjelaskan pembagian aplikasi, batas tanggung jawab, alur komunikasi, dan mekanisme keamanan sistem Scratch Kelas v1.
>
> Prinsip utama: sederhana untuk dirawat oleh satu guru, aman di sisi server, dan menjaga berkas `.sb3` tetap utuh dari editor hingga diunggah ke Scratch.

---

## 1. Gambaran Umum Sistem

Sistem terdiri dari dua aplikasi web terpisah di bawah satu domain induk yang sama, didukung oleh satu database PostgreSQL dan satu object storage S3-kompatibel.

```text
+-----------------------------------+       HTTPS + Cookie Sesi       +-----------------------------------+
|        Aplikasi Kelas             | <-----------------------------> |          Editor Scratch           |
|   [https://app.domainanda.com](https://app.domainanda.com)      |        (API /api/v1/*)          |  [https://editor.domainanda.com](https://editor.domainanda.com)    |
|   Next.js (App Router), TS, TW    |                                 |    scratch-gui + scratch-vm       |
+-----------------+-----------------+                                 +-----------------------------------+
                  |
        +---------+---------+
        |                   |
        v                   v
+---------------+   +-------------------+
| PostgreSQL    |   | Object Storage    |
| 15+ (SQL)     |   | S3-Compatible     |
| Metadata &    |   | Private Bucket    |
| Waktu Server  |   | (.sb3 byte asli)  |
+---------------+   +-------------------+
```

---

## 2. Struktur Workspace

Repository menggunakan satu root `package.json` dengan npm workspaces:

```text
/
├── package.json          # workspaces: ["kelas", "editor"]
├── db/
│   └── migrations/       # Sumber kebenaran skema SQL (001, 002, 003, ...)
├── kelas/                # Aplikasi Next.js App Router (halaman + API /api/v1/*)
└── editor/               # Aplikasi scratch-gui yang dimodifikasi
```

Aturan batas kode:
- `kelas/` dan `editor/` tidak saling mengimpor kode internal secara langsung.
- `editor/` tidak boleh terhubung ke PostgreSQL atau object storage.
- Seluruh komunikasi `editor/` ke backend wajib melalui endpoint `/api/v1/*` di `kelas/`.

---

## 3. Pembagian Tanggung Jawab

### 3.1 Aplikasi Kelas (`kelas/`)
- **Antarmuka web**: halaman masuk, pendaftaran lewat undangan, daftar tugas murid, halaman guru (kelas, undangan, tugas, daftar pengumpulan, riwayat snapshot, komentar).
- **Autentikasi & sesi**: verifikasi kata sandi, penerbitan dan pencabutan cookie sesi lintas subdomain.
- **Otorisasi terpusat**: pemeriksaan rantai kepemilikan (`requireAccess`) sebelum mengakses data atau berkas.
- **Logika bisnis & waktu**: seluruh keputusan jendela waktu (`dibuka_pada`, `ditutup_pada`), status terlambat, dedup snapshot, save intent, pengumpulan berulang, dan retensi.
- **Gerbang berkas**: menerima unggahan `.sb3`, menghitung SHA-256 dan ukuran, menyimpan ke object storage, serta menyajikan unduhan setelah memeriksa izin.

### 3.2 Aplikasi Editor (`editor/`)
- Menjalankan `scratch-gui` dan `scratch-vm` apa adanya untuk penyuntingan proyek Scratch.
- Menampilkan bar atas tipis berisi judul tugas, indikator status penyimpanan, dan tombol **Kumpulkan**.
- Mengelola jadwal autosave (debounce 30 detik, paksa tiap 5 menit, `sendBeacon` saat menutup tab) serta simpan manual.
- Mengelola alur `save-intent` menjelang tenggat dan langsung mengubah antarmuka menjadi baca-saja ketika waktu tutup tercapai.
- Tidak pernah menyimpan `object_key` atau memutuskan hak akses berdasarkan jam perangkat murid.

### 3.3 PostgreSQL 15+
- Sumber kebenaran skema melalui berkas migrasi SQL berurutan (`db/migrations/`).
- Sumber kebenaran waktu (`now()` dengan tipe `timestamptz`).
- Menyimpan entitas akun, sekolah, kelas, keanggotaan, undangan, tugas, submission, snapshot (metadata saja), komentar, dan status save intent.

### 3.4 Object Storage (S3-Kompatibel)
- Bucket bersifat **privat** (tidak ada akses publik permanen).
- Menyimpan berkas `.sb3` sebagai byte mentah tanpa penguraian ZIP atau modifikasi `project.json`.
- Struktur kunci:
  - `snapshots/{assignment_id}/{student_id}/{snapshot_id}.sb3`
  - `submissions/{assignment_id}/{student_id}/{submission_id}.sb3` (atau menyalin referensi kunci objek yang aman dari snapshot sumber)

---

## 4. Batas Komunikasi, Sesi, dan Keamanan

### 4.1 Sesi Lintas Subdomain
- Kedua aplikasi berada di bawah domain induk yang sama sehingga berbagi cookie sesi:
  `Set-Cookie: sesi=<token>; HttpOnly; Secure; SameSite=Lax; Domain=.domainanda.com; Path=/`
- Tidak menggunakan tabel sesi buatan sendiri; pengelolaan sesi memakai cookie bertanda tangan atau library autentikasi yang sesuai.
- Semua panggilan `fetch` dari `editor/` wajib menyertakan `credentials: "include"`.

### 4.2 CORS dan CSRF
- `kelas/` mengatur header CORS secara eksplisit hanya untuk origin `editor/` (dilarang menggunakan `*` bersama kredensial).
- Semua endpoint mutasi menerapkan perlindungan CSRF dan validasi input di server.

### 4.3 Pemeriksaan Izin Terpusat (`requireAccess`)
Setiap request ke endpoint terproteksi melewati urutan pemeriksaan yang sama:
1. **Autentikasi**: sesi valid? Jika tidak -> `401 BELUM_MASUK`.
2. **Peran**: peran sesuai dengan endpoint? Jika tidak -> `403 PERAN_TIDAK_SESUAI`.
3. **Kepemilikan**:
   - Guru: telusuri rantai `sumber daya -> classes.teacher_id = sesi_guru.id`.
   - Murid: telusuri `students.id -> class_members -> assignments.class_id`.
   - Jika tidak cocok atau tidak ada -> `404` (mencegah kebocoran keberadaan data).
4. **Waktu**: operasi baca tetap diizinkan setelah tenggat; operasi tulis wajib memeriksa jendela tugas atau `save_intent` yang sah.

### 4.4 Perlindungan `object_key` dan Berkas `.sb3`
- `object_key` hanya hidup di database dan layer server `kelas/`; tidak pernah dikirim dalam respons JSON, HTML, atau log.
- Pengunduhan selalu lewat endpoint berizin (`/api/v1/submissions/{id}/content` atau `/api/v1/snapshots/{id}/content`). Jika memakai signed URL internal, masa berlaku maksimal 5 menit setelah pemeriksaan izin.
- Batas ukuran unggahan awal: **50 MB** (diperiksa di server, ditolak dengan `413`).

---

## 5. Alur Teknis Kritis

### 5.1 Inisialisasi Sesi Editor
1. Murid membuka editor dengan parameter `assignment_id`.
2. Editor memanggil `GET /api/v1/editor/session`.
3. Server mengembalikan status tugas (`belum_dibuka`, `dibuka`, `ditutup`), flag `boleh_edit` dan `boleh_kumpul`, serta metadata `proyek_terakhir`.
4. Jika `boleh_edit: true`, editor mengunduh `.sb3` terakhir melalui `GET /api/v1/editor/projects/{assignment_id}` dan memuatnya ke `scratch-vm`.

### 5.2 Autosave, Deduplikasi, dan `sendBeacon`
1. Editor memicu simpan pada debounce **30 detik** setelah perubahan terakhir, simpan paksa setiap **5 menit**, atau simpan manual.
2. Editor mengirim biner `.sb3` ke `POST /api/v1/editor/projects/{assignment_id}/snapshots` dengan header `Idempotency-Key`.
3. Server menghitung SHA-256 byte mentah dan memeriksa rate limit autosave (minimal 20 detik antar autosave biasa; simpan manual tidak diblokir).
4. Deduplikasi menggunakan unique index `(assignment_id, student_id, isi_hash)`. Jika hash sama, server tidak membuat objek atau baris baru (`baru: false`).
5. Saat tab ditutup, editor mengirim fallback ke `.../snapshots/beacon` melalui `navigator.sendBeacon`. Keberhasilan tetap ditentukan server, bukan nilai kembalian `sendBeacon()`.

### 5.3 Save Intent saat Tenggat
1. Menjelang `ditutup_pada`, editor mengekspor byte `.sb3` terakhir, menghitung hash serta ukurannya, lalu meminta izin ke `POST /api/v1/editor/projects/{assignment_id}/save-intents` sebelum tenggat.
2. Server memverifikasi waktu database `< ditutup_pada` dan menyimpan intent persisten berjangka pendek (misalnya toleransi 30 detik setelah tenggat, maksimal 1 kali pakai).
3. Ketika tenggat tiba, editor langsung menjadi baca-saja.
4. Jika unggahan akhir baru selesai sedikit setelah tenggat, server tetap menerimanya selama token intent valid, belum kedaluwarsa, belum dipakai, dan SHA-256 + ukuran byte cocok secara atomik.

### 5.4 Pengumpulan (`submissions`) dan Retensi (`snapshots`)
1. Menekan tombol **Kumpulkan** memanggil `POST /api/v1/assignments/{assignment_id}/submissions` (merujuk `snapshot_id` atau biner `.sb3` baru).
2. Server mencatat `terlambat = (now() >= ditutup_pada)` dan `perlu_tinjauan = terlambat && !izinkan_terlambat`. Nilai ini dibekukan saat kejadian.
3. Tabel `submissions` tidak memiliki foreign key ke `snapshots` dan menyimpan salinan metadata objek sendiri.
4. Pekerjaan retensi berkala memangkas snapshot biasa di atas batas **20 snapshot** per `(assignment_id, student_id)`, dengan syarat `isi_hash` tidak dirujuk oleh baris `submissions` mana pun. Penghapusan objek di storage hanya dilakukan setelah baris DB berhasil dihapus dan tidak ada referensi aktif.