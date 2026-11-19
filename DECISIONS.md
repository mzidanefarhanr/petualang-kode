# DECISIONS.md — Keputusan Arsitektur & Produk (v1)

> Dokumen ini mengunci keputusan teknis dan produk untuk Scratch Kelas v1 beserta alasannya, agar tidak diperdebatkan ulang selama pengembangan.
>
> Perubahan atas keputusan di bawah memerlukan pembaruan serentak pada dokumen terkait (`REQUIREMENTS.md`, `DATABASE.md`, `DESIGN.md`, `API-CONTRACTS.md`, `TESTING.md`).

---

## Ringkasan Keputusan Terkunci

### D-01: Dua Aplikasi dalam Satu Monorepo npm Workspaces
- **Keputusan**: Menggunakan satu repository dengan npm workspaces (`kelas/` untuk Next.js App Router dan `editor/` untuk `scratch-gui`), berjalan pada dua subdomain di bawah domain induk yang sama (`app.*` dan `editor.*`).
- **Alasan**: Memisahkan kompleksitas build `scratch-gui` dari aplikasi Next.js tanpa menambah beban operasional multi-repo atau microservices bagi satu pengembang.

### D-02: Memakai `scratch-gui` dan `scratch-vm` Apa Adanya
- **Keputusan**: Tidak menulis mesin Scratch sendiri dan tidak memodifikasi perilaku internal `scratch-vm` untuk penyimpanan biasa.
- **Alasan**: `scratch-vm` sudah teruji kompatibel dengan ekosistem Scratch. Modifikasi editor dibatasi pada lapisan integrasi penyimpanan dan bar atas antarmuka.

### D-03: Integritas `.sb3` Byte-Identik (Dilarang Mengurai/Mengubah `project.json`)
- **Keputusan**: Berkas `.sb3` disimpan dan dikirim kembali sebagai byte mentah apa adanya. Server dilarang membuka ZIP, menyunting `project.json`, atau menambahkan metadata ke dalam arsip.
- **Alasan**: Tujuan utama murid adalah mengunduh `.sb3` dan mengunggahnya ke akun Scratch asli mereka. Perubahan struktur ZIP atau `project.json` berisiko ditolak oleh Scratch.

### D-04: Biner `.sb3` Disimpan di Object Storage, Bukan PostgreSQL
- **Keputusan**: PostgreSQL hanya menyimpan metadata (`object_key`, `isi_hash`, `ukuran_bytes`), sedangkan isi biner `.sb3` disimpan di object storage S3-kompatibel dalam bucket privat.
- **Alasan**: Menghindari pembengkakan database oleh data biner besar dan mempermudah pencadangan serta retensi berkas.

### D-05: `object_key` Tidak Pernah Dikirim ke Klien
- **Keputusan**: Seluruh pengunduhan berkas melewati endpoint API yang memeriksa izin. `object_key` tidak boleh muncul di JSON API, HTML, JS, atau URL publik permanen.
- **Alasan**: Mencegah akses lintas murid atau penebakan lokasi berkas di object storage.

### D-06: SQL sebagai Sumber Kebenaran Skema Database
- **Keputusan**: Menggunakan PostgreSQL 15+ dengan migrasi SQL (`db/migrations/`) sebagai sumber kebenaran. Jika memakai ORM, skema ORM wajib mengikuti SQL. Migrasi yang sudah dijalankan tidak boleh diedit.
- **Alasan**: Menjaga integritas relasi (composite foreign key, check constraint, unique index) tetap eksplisit dan mudah dipahami setelah lama tidak disentuh.

### D-07: Pemisahan `snapshots` dan `submissions`
- **Keputusan**: `submissions` tidak memiliki foreign key ke `snapshots` dan menyalin referensi objeknya sendiri. `snapshots` mencatat `jenis_simpan` (`otomatis` / `manual`), sedangkan `submissions` mencatat `terlambat` dan `perlu_tinjauan`.
- **Alasan**: `snapshots` bersifat sementara (dibatasi retensi), sedangkan `submissions` adalah catatan permanen pekerjaan murid yang tidak boleh hilang saat retensi berjalan.

### D-08: Autentikasi Menggunakan Auth.js (NextAuth) Strategi JWT Lintas Subdomain
- **Keputusan**: Pengelolaan sesi menggunakan library autentikasi standar (Auth.js / NextAuth) dengan **strategi JWT** (tanpa tabel sesi di database) dan cookie `HttpOnly; Secure; SameSite=Lax; Domain=.domainanda.com` agar berlaku di `app.*` dan `editor.*`.
- **Alasan**: Memenuhi aturan tanpa tabel sesi buatan sendiri dan tanpa menambah layanan eksternal seperti Redis, sekaligus berbagi sesi secara aman antara aplikasi kelas dan editor.

### D-09: Identitas Login & Rute Undangan
- **Keputusan**:
  - Guru masuk di `/masuk` menggunakan **email** + kata sandi.
  - Murid mendaftar pertama kali lewat `/join/<kode>` (mengisi nama, `username`, email opsional, kata sandi), lalu masuk kembali di `/masuk` menggunakan **`username`** + kata sandi.
- **Alasan**: Murid SD tidak selalu memiliki email, sehingga `username` unik memberi pengenal yang jelas dan mudah diingat saat login ulang.

### D-10: Waktu Server (`now()`) sebagai Satu-Satunya Sumber Kebenaran
- **Keputusan**: Semua pemeriksaan jendela tugas (`dibuka_pada`, `ditutup_pada`), masa berlaku undangan, waktu snapshot, save intent, dan keterlambatan menggunakan `now()` dari PostgreSQL (`timestamptz`), bukan jam perangkat klien.
- **Alasan**: Jam komputer lab atau perangkat murid bisa tidak sinkron atau dimanipulasi.

### D-11: Pengumpulan Terlambat & Mode Baca-Saja Editor Setelah Tenggat
- **Keputusan**:
  - Setelah `ditutup_pada`, murid tetap dapat membuka editor dalam **mode baca-saja** untuk melihat proyek tersimpan dan menekan **Kumpulkan**, tanpa bisa menyunting atau menyimpan snapshot baru.
  - Server tidak menolak pengumpulan terlambat; status `terlambat` dan `perlu_tinjauan` (`terlambat && !izinkan_terlambat`) dicatat permanen saat kejadian dan tidak dihitung ulang.
- **Alasan**: Pekerjaan murid yang sudah selesai tidak boleh hilang diam-diam; keputusan akhir tetap di tangan guru.

### D-12: Mekanisme `save_intents` Persisten untuk Batas Tenggat
- **Keputusan**: Perubahan terakhir yang sedang diunggah hanya diterima setelah tenggat jika sudah didaftarkan ke tabel `save_intents` sebelum `ditutup_pada`, dengan verifikasi token satu kali pakai (`token_hash`), batas waktu toleransi singkat, serta kecocokan SHA-256 dan ukuran byte secara atomik.
- **Alasan**: Melindungi pekerjaan terakhir murid yang terhambat jaringan saat detik-detik tenggat tanpa membuka celah pengeditan baru setelah tugas ditutup.

### D-13: Jadwal Autosave, Deduplikasi, Rate Limit, dan Retensi
- **Keputusan**:
  - Debounce autosave: **30 detik** setelah perubahan terakhir.
  - Simpan paksa berkala: setiap **5 menit** selama sesi aktif.
  - Fallback tutup tab: `navigator.sendBeacon`.
  - Rate limit autosave server: minimal **20 detik** antar snapshot otomatis (simpan manual tidak diblokir).
  - Deduplikasi: berdasarkan `(assignment_id, student_id, isi_hash)`.
  - Retensi: **20 snapshot** biasa terakhir per `(assignment_id, student_id)`, dengan pengecualian mutlak untuk snapshot yang hash-nya dirujuk oleh `submissions`.
- **Alasan**: Menyeimbangkan keamanan proses pengerjaan murid dengan efisiensi penyimpanan dan beban server.

### D-14: Batas Operasional Awal v1
- **Keputusan**: Ukuran maksimal `.sb3` **50 MB**, panjang maksimal komentar **2000 karakter**, masa berlaku bawaan undangan **7 hari**, dan batas awal **60 murid per kelas**.
- **Alasan**: Memberi pagar pengaman awal untuk mencegah penyalahgunaan sumber daya pada infrastruktur tunggal.

### D-15: Fitur yang Sengaja Ditolak di v1
- **Keputusan**: Tidak membangun mode offline/service worker, Rust, GraphQL, dukungan ponsel, pemutar pratinjau proyek di halaman guru, sistem nilai/rapor, notifikasi email, multi-guru per kelas, peran admin/wali murid, integrasi LMS, distribusi proyek antar murid, atau bahasa selain Indonesia.
- **Alasan**: Menjaga ruang lingkup v1 tetap realistis untuk dikerjakan dan dirawat oleh satu orang.

### D-16: Gerbang 0 Wajib Lulus Sebelum Fitur Kelas
- **Keputusan**: Pembuktian bahwa berkas `.sb3` dari `editor/` lokal dapat diunggah dan berjalan utuh di akun Scratch sungguhan (Gerbang 0 di `TESTING.md`) harus lulus sebelum membangun fitur kelas, tugas, dan akun.
- **Alasan**: Memvalidasi risiko teknis terbesar proyek sedini mungkin.