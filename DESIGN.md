# DESIGN.md — Antarmuka Scratch Kelas v1

> Daftar layar, tata letak, dan aturan keadaan antarmuka. Cukup jelas untuk dibangun tanpa menebak, tanpa membuat sistem desain yang tidak diperlukan.

---

## 1. Prinsip

Tiga hal menentukan semua keputusan desain:

**Murid adalah anak-anak.** Gunakan tulisan yang menenangkan, tidak menyalahkan, dan tidak menakut-nakuti. Jangan menampilkan kata "ERROR" besar dan merah. Jika sesuatu gagal, jelaskan apa yang perlu dilakukan.

**Guru bekerja sendiri dan sibuk.** Halaman guru boleh padat dan efisien. Hindari ilustrasi dekoratif dan ruang kosong berlebihan. Letakkan tindakan yang paling sering digunakan agar mudah ditemukan.

**Satu warna aksen saja.** Gunakan abu-abu dan putih sebagai warna dasar, dengan satu warna aksen biru tua.

Saran tampilan:

- Huruf sistem: `system-ui, -apple-system, "Segoe UI", sans-serif`.
- Satu warna aksen biru tua.
- Sudut membulat sekitar 6px.
- Tanpa bayangan dekoratif.
- Animasi hanya untuk indikator proses, misalnya saat memuat atau menyimpan.
- Gunakan kontras dan ukuran teks yang mudah dibaca anak SD.

Jangan membangun sistem desain yang rumit. Komponen sederhana dan konsisten sudah cukup untuk v1.

---

## 2. Layar 1 — Masuk dan bergabung

### Masuk guru dan murid

**Alamat:** `/masuk`

Halaman `/masuk` melayani dua peran:

- **Guru:** masuk menggunakan **email** dan **kata sandi**.
- **Murid:** masuk menggunakan **username** dan **kata sandi**.

Sediakan pilihan tab atau pemilih sederhana agar murid tidak bingung dengan kolom email guru.

Tidak ada fitur lupa kata sandi di v1.

### Bergabung sebagai murid

Murid datang melalui tautan undangan:

`/join/<kode>`

Sebelum menampilkan formulir, tampilkan informasi kelas dan guru agar murid yakin bahwa ia membuka undangan yang benar.

Contoh:

> Kamu diundang ke kelas **Scratch Kelas 5A** oleh **Pak Budi**.
>
> Isi namamu, username, dan kata sandimu untuk mulai.

Formulir berisi:

- Nama lengkap / nama panggilan.
- Username (dipakai untuk masuk kembali di hari lain).
- Email (opsional).
- Kata sandi.

Jika undangan sudah kedaluwarsa atau dicabut, tampilkan pesan:

> Tautan undangan ini sudah tidak berlaku. Minta tautan baru ke Pak Budi.

Jangan menampilkan halaman teknis seperti "403 Forbidden". Berikan penjelasan yang mudah dipahami murid.

### Keadaan formulir

- **Memuat:** tombol berubah menjadi "Membuka…" dan tidak bisa ditekan berulang kali.
- **Gagal:** tampilkan pesan di bawah formulir atau kolom yang berkaitan.
- **Berhasil:** arahkan pengguna ke halaman berikutnya sesuai perannya (`/guru` untuk guru, `/tugas` untuk murid).

---

## 3. Layar 2 — Daftar tugas murid

**Alamat:** `/tugas`

Tujuan halaman ini adalah membantu murid mengetahui tugas yang perlu dikerjakan.

Tampilkan tugas dari kelas-kelas yang diikuti murid. Jika perlu, sertakan nama kelas agar murid tahu tugas berasal dari kelas mana.

Urutan daftar:

1. Tugas yang sedang dibuka.
2. Tugas yang sudah ditutup.

Setiap baris memuat:

- Judul tugas.
- Nama kelas.
- Status: **Dibuka**, **Ditutup**, atau **Sudah dikumpulkan**.
- Batas waktu dalam format yang mudah dibaca.
- Tombol tindakan yang sesuai.

Contoh saat dibuka:

> **Labirin**
>
> Kelas Scratch 5A
>
> Bisa dikerjakan sampai Senin, 10 November, jam 15.00.
>
> **Kerjakan**

### Aturan tautan editor

- **Sebelum `dibuka_pada`:** jangan tampilkan tautan editor (jangan hanya menyembunyikan lewat CSS). Tampilkan pesan:
  > Tugas ini dibuka Senin, 10 November, jam 07.00.
- **Selama jendela pengerjaan:** tampilkan tombol **Kerjakan** menuju editor.
- **Setelah `ditutup_pada`:** murid tetap dapat membuka editor dalam **mode baca-saja** (tombol **Lihat & Kumpulkan**) untuk melihat proyek tersimpan dan menekan tombol **Kumpulkan** bila belum mengumpulkan atau ingin mengumpulkan ulang. Editor tetap melarang penyuntingan dan penyimpanan snapshot baru.
- Server tetap wajib memeriksa waktu ketika murid meminta sesi editor.

Jika murid sudah pernah mengumpulkan, tombol **Lihat hasilku** tetap tersedia meskipun tugas sudah ditutup. Murid tetap dapat melihat hasil pengumpulan, komentar, dan mengunduh berkasnya.

Pengumpulan yang terlambat tetap ditampilkan. Status terlambat tidak boleh membuat pengumpulan menghilang.

### Keadaan kosong

> Belum ada tugas. Pak Budi belum memberi tugas.

### Keadaan memuat dan gagal

- **Memuat:** tampilkan tiga baris placeholder sederhana.
- **Gagal:** tampilkan "Tidak bisa memuat tugas. Periksa internetmu, lalu coba lagi."
- Sertakan tombol **Coba lagi**.

---

## 4. Layar 3 — Editor

Editor bukan halaman Next.js.

Editor adalah aplikasi `scratch-gui` yang berjalan terpisah di subdomain editor. Mesin Scratch menggunakan `scratch-gui` dan `scratch-vm` yang sudah ada.

Jangan membuat mesin Scratch sendiri dan jangan mengubah `scratch-vm` untuk kebutuhan antarmuka biasa.

### Bar di atas editor

Tambahkan satu baris tipis di atas area editor yang memuat:

- Nama tugas.
- Indikator status penyimpanan (atau keterangan **Hanya Baca — Tugas Sudah Ditutup** saat melewati tenggat).
- Tombol **Kumpulkan**.

Tombol **Kumpulkan** harus berada di pojok kiri atas, jauh dari kanvas dan balok agar tidak mudah tertekan secara tidak sengaja.

### Mode baca-saja setelah tenggat

Ketika server mengembalikan `boleh_edit: false` (atau waktu tutup tercapai saat editor terbuka):

- Editor segera masuk ke **mode baca-saja**.
- Murid tidak dapat mengedit balok, sprite, kostum, atau memicu simpan manual/autosave baru.
- Murid tetap dapat melihat proyek tersimpan terakhir dan menekan tombol **Kumpulkan** (selama `boleh_kumpul: true`).

### Status penyimpanan

| Keadaan | Tampilan |
|---|---|
| Bersih | `Tersimpan` |
| Ada perubahan yang belum tersimpan | `Menyimpan…` |
| Simpan gagal | `Belum tersimpan. Mencoba lagi.` |
| Koneksi terputus | `Koneksi terputus. Perubahan terakhir mungkin belum tersimpan.` |
| Tugas sudah ditutup | `Tugas sudah ditutup (hanya baca)` |

Jangan menggunakan pesan "Pekerjaanmu aman di sini" ketika koneksi terputus. v1 tidak menjanjikan penyimpanan offline atau sinkronisasi setelah koneksi kembali.

Indikator harus membedakan keadaan proyek yang sudah tersimpan dan yang masih memiliki perubahan.

### Penyimpanan dan pengumpulan

- Simpan otomatis dan simpan manual menghasilkan snapshot.
- Snapshot yang isinya sama tidak perlu disimpan berulang kali.
- Tombol **Kumpulkan** membuat pengumpulan baru.
- Murid boleh mengumpulkan lebih dari sekali.
- Pengumpulan baru tidak menghapus pengumpulan sebelumnya.
- Kegagalan menyimpan harus terlihat oleh murid. Jangan memberi kesan bahwa pekerjaan sudah tersimpan jika server belum mengonfirmasinya.

Editor harus mengikuti batas waktu dari server. Jangan mengandalkan jam perangkat murid untuk memutuskan apakah tugas masih terbuka.

---

## 5. Layar 4 — Kelas saya (guru)

**Alamat:** `/guru`

Ini halaman pendarat setelah guru masuk.

Guru memiliki satu akun yang dapat mengelola beberapa sekolah dan kelas.

Tampilkan daftar kelas dalam bentuk baris atau tabel sederhana.

Setiap baris memuat:

- Nama kelas.
- Nama sekolah sebagai label.
- Jumlah murid.
- Jumlah tugas.
- Informasi tugas yang sedang berjalan.

Contoh:

> Kelas 5A — SD Harapan — 24 murid — 3 tugas — "Labirin" sedang dibuka.

Sediakan satu tombol **Buat kelas** di atas daftar.

Formulir pembuatan kelas berisi:

- Nama kelas.
- Sekolah: pilih sekolah yang sudah ada atau masukkan sekolah baru.

Urutkan kelas berdasarkan kebutuhan kegiatan mengajar, bukan semata-mata tanggal dibuat. Kelas yang sedang aktif sebaiknya mudah ditemukan.

---

## 6. Layar 5 — Halaman kelas (guru)

Halaman ini menampilkan satu kelas dengan tiga bagian utama.

Urutan bagian:

### 1. Tugas

Daftar tugas dalam kelas.

Setiap baris memuat:

- Judul tugas.
- Waktu `dibuka_pada` dan `ditutup_pada`.
- Jumlah murid yang sudah mengumpulkan, misalnya "18 dari 24".
- Tombol **Lihat nilai**.

Sediakan tombol **Buat tugas**.

Guru dapat mengubah waktu buka dan tutup tugas. Mengubah waktu tidak boleh menghapus pengumpulan atau snapshot yang sudah ada.

### 2. Undangan

Tampilkan daftar undangan kelas.

Setiap undangan memuat:

- Informasi atau kode undangan yang aman ditampilkan.
- Masa berlaku.
- Jumlah pemakaian.
- Status aktif atau tidak aktif.

Tindakan:

- **Salin tautan:** menyalin tautan undangan (`/join/<kode>`) ke papan klip.
- **Cabut:** mencabut undangan yang masih aktif.

Undangan yang kedaluwarsa atau dicabut tetap dapat ditampilkan sebagai riwayat, tetapi tidak dapat digunakan untuk bergabung.

Konfirmasi tindakan pencabutan sebelum menjalankannya.

### 3. Murid

Tampilkan daftar murid yang menjadi anggota kelas.

Setiap baris memuat:

- Nama murid (dan `username` bila diperlukan untuk membantu murid yang lupa).
- Tanggal bergabung.

Tidak perlu menyediakan tombol hapus murid pada v1.

Riwayat pekerjaan murid harus tetap terlindungi. Jangan membuat tindakan antarmuka yang dapat menghapus riwayat secara tidak sengaja.

---

## 7. Layar 6 — Daftar pengumpulan (guru)

**Alamat:** `/guru/kelas/<class_id>/tugas/<assignment_id>`

Halaman ini menampilkan daftar murid untuk satu tugas.

Gunakan tabel. **Semua murid dalam kelas harus tampil**, termasuk murid yang belum mengumpulkan.

Kolom:

| Kolom | Isi |
|---|---|
| Nama murid | Nama murid |
| Waktu terakhir mengumpulkan | Waktu pengumpulan terbaru atau "—" |
| Jumlah pengumpulan | Contoh: "3 kali" |
| Terlambat? | Penanda kecil jika pengumpulan terlambat (termasuk penanda perlu tinjauan jika ada) |
| Komentar terakhir | Potongan komentar terbaru |
| Aksi | Tombol **Riwayat** |

### Aturan tampilan

- Murid yang belum mengumpulkan tetap tampil.
- Untuk murid yang belum mengumpulkan, waktu ditampilkan sebagai "—".
- Tampilkan jumlah seluruh pengumpulan, bukan hanya satu pengumpulan terakhir.
- Pengumpulan terlambat tetap dihitung dan ditampilkan.
- Daftar utama menggunakan pengumpulan terakhir setiap murid.
- Pengumpulan lama tetap dapat dibuka melalui halaman riwayat.

Urutan bawaan:

1. Murid yang belum mengumpulkan.
2. Murid yang sudah mengumpulkan, diurutkan berdasarkan nama.

Tujuan utama halaman ini adalah membantu guru menemukan murid yang belum mengumpulkan, bukan mengurutkan prestasi.

---

## 8. Layar 7 — Riwayat pengerjaan (guru)

**Alamat:** `/guru/kelas/<class_id>/tugas/<assignment_id>/murid/<student_id>`

Ini layar utama yang membedakan aplikasi ini dari daftar pengumpulan biasa.

Tujuannya adalah memperlihatkan proses pengerjaan murid melalui urutan snapshot.

Susunan halaman:

- Kolom kiri: daftar snapshot dan pengumpulan.
- Kolom kanan: area untuk melihat detail versi yang dipilih.
- Bagian bawah: komentar pada pengumpulan terakhir.

### Kolom kiri — Daftar snapshot

Tampilkan snapshot dalam urutan waktu, terbaru di atas.

Setiap butir memuat:

- Tanggal dan waktu.
- Jenis penyimpanan: `otomatis` atau `manual` (serta penanda jika versi tersebut adalah pengumpulan).
- Penanda snapshot pertama jika diperlukan.

Contoh:

> **10 Nov, 14.32** — Simpan manual
>
> **10 Nov, 14.15** — Simpan otomatis
>
> **10 Nov, 13.58** — Snapshot pertama

Jangan menghitung atau menampilkan perubahan jumlah balok dengan membaca `project.json` dari arsip `.sb3`.

Untuk v1, waktu dan jenis penyimpanan sudah cukup untuk menunjukkan urutan pengerjaan.

Snapshot yang dipilih harus memiliki penanda visual yang jelas.

### Kolom kanan — Melihat snapshot

Pemutar proyek dari sisi guru memerlukan kemampuan memuat berkas milik murid ke editor dalam mode tinjauan.

Namun, pemuatan proyek untuk tinjauan tidak boleh menggunakan jalur penyimpanan biasa milik murid.

Aturan mode tinjauan:

- Berkas hanya boleh dibaca.
- Tidak ada simpan otomatis yang menulis kembali ke snapshot atau pengumpulan murid.
- Tidak ada tombol **Kumpulkan**.
- Tidak ada tindakan yang mengubah berkas asli.
- Akses berkas harus melalui pemeriksaan kepemilikan guru.
- `object_key` tidak boleh dikirim ke browser.

Jika pemutar belum tersedia, gunakan tampilan sementara:

Tombol **Unduh snapshot ini**.

Tambahkan keterangan:

> Pemutar menyusul. Untuk sekarang, unduh berkasnya lalu buka di editor.

Jangan membuat pemutar sementara yang diam-diam mengubah atau menyimpan ulang berkas murid.

### Komentar

Di bawah kedua kolom, tampilkan komentar untuk pengumpulan terakhir murid pada tugas tersebut.

Tampilkan:

- Daftar komentar.
- Nama penulis.
- Waktu komentar.
- Isi komentar.
- Kotak untuk menulis komentar baru.

Komentar terikat pada pengumpulan, bukan pada snapshot tertentu.

Guru dan murid dapat melihat komentar sesuai aturan akses aplikasi.

---

## 9. Aturan yang berlaku di semua layar

### Waktu

Tampilkan waktu dalam zona waktu lokal pembaca.

Sumber waktu adalah nilai `timestamptz` dari server. Konversi ke waktu lokal dilakukan untuk tampilan.

Contoh format:

> Senin, 10 November, jam 15.00

Hindari format numerik ambigu seperti `10/11/2026 15:00`.

Keputusan apakah tugas terbuka, terlambat, atau sudah ditutup tetap menggunakan waktu server, bukan waktu perangkat pengguna.

### Nama dan identitas

- Gunakan nama murid atau nama guru yang mudah dibaca.
- Jangan menjadikan email sebagai nama utama.
- Jangan menampilkan ID database.
- Jangan menampilkan `object_key` penyimpanan berkas kepada pengguna.

### Keadaan kosong

Setiap halaman yang memuat daftar harus memiliki keadaan kosong yang menjelaskan mengapa belum ada data.

Gunakan kalimat sederhana dan sesuai peran pengguna.

### Keadaan gagal

- Jelaskan masalah dengan bahasa yang mudah dipahami.
- Berikan tindakan berikutnya jika ada.
- Jangan menampilkan pesan teknis atau stack trace kepada pengguna.
- Jangan menampilkan status berhasil jika server belum mengonfirmasi tindakan.

### Modal dan konfirmasi

Jangan gunakan modal untuk hal yang lebih tepat menjadi halaman biasa.

Konfirmasi diperlukan untuk tindakan yang sulit atau tidak dapat dibatalkan, misalnya mencabut undangan.

### Pemberitahuan

Tidak ada sistem notifikasi di dalam aplikasi pada v1.

Informasi yang perlu diketahui pengguna ditampilkan langsung pada halaman yang berkaitan.

---

## 10. Kebutuhan API yang berkaitan dengan antarmuka

Antarmuka menggunakan rute resmi di bawah `/api/v1` sesuai `API-CONTRACTS.md`:

### Daftar pengumpulan guru

`GET /api/v1/assignments/{assignment_id}/submissions`

Digunakan untuk mengisi Layar 6.

Respons menyediakan:

- Semua murid dalam kelas (termasuk yang belum mengumpulkan).
- Pengumpulan terakhir setiap murid.
- Jumlah pengumpulan.
- Status `terlambat` dan `perlu_tinjauan`.
- Komentar terakhir jika tersedia.

### Daftar snapshot dan versi murid

`GET /api/v1/submissions/{submission_id}/versions`

Digunakan untuk mengisi daftar riwayat di Layar 7.

Respons menyediakan:

- Jenis versi (`pengumpulan` atau `snapshot`), ID, waktu, ukuran berkas, dan URL unduhan resmi.
- Untuk snapshot, sertakan `jenis_simpan` (`otomatis` / `manual`) sesuai `DATABASE.md`.

Jangan mengirim `object_key` ke klien.

### Mengunduh snapshot dan submission

- `GET /api/v1/submissions/{submission_id}/content`
- `GET /api/v1/snapshots/{snapshot_id}/content`

Berkas disajikan setelah pemeriksaan kepemilikan guru. Jangan membiarkan klien menyusun alamat penyimpanan objek dari `object_key`.

### Memuat snapshot untuk tinjauan

Jika pemutar proyek guru dikerjakan di masa depan, diperlukan mekanisme untuk memberikan berkas snapshot dalam mode baca-saja.

Sebelum implementasi, tetapkan kontrak API untuk:

- Pemeriksaan rantai kepemilikan sampai `teachers.id`.
- Pemberian akses berkas hanya kepada guru yang berwenang.
- Penanda mode tinjauan pada editor.
- Penonaktifan seluruh jalur simpan dan kumpulkan dalam mode tinjauan.

Jangan menggunakan endpoint simpan milik murid untuk memuat atau memutar proyek guru.

---

## 11. Batas desain v1

Hal-hal berikut tidak perlu dibangun hanya demi mempercantik antarmuka:

- Pratinjau langsung proyek di halaman guru sebelum mode tinjauan siap.
- Perhitungan jumlah balok dengan mengurai arsip `.sb3`.
- Mode offline atau penyimpanan lokal yang menjanjikan pekerjaan tetap aman tanpa koneksi.
- Sistem notifikasi.
- Sistem nilai, rapor, atau peringkat.
- Fitur yang memerlukan perubahan pada `scratch-vm`.
- Pengelolaan banyak guru dalam satu kelas.

Prioritaskan alur inti yang benar:

1. Guru membuat kelas dan undangan.
2. Murid bergabung ke kelas melalui `/join/<kode>`.
3. Guru membuat tugas.
4. Murid mengerjakan proyek di editor.
5. Proyek tersimpan sebagai snapshot.
6. Murid mengumpulkan proyek (termasuk dalam mode baca-saja jika tugas sudah ditutup).
7. Guru melihat pengumpulan dan riwayat.
8. Guru mengunduh berkas `.sb3` yang asli.

Antarmuka harus mendukung alur tersebut tanpa menambahkan kompleksitas yang tidak diperlukan.