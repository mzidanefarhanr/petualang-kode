# AGENTS.md — Kontrak Kerja untuk Agen AI

> Dokumen ini wajib dibaca sebelum mengerjakan kode atau mengubah dokumen proyek.
>
> Isinya adalah aturan kerja, konvensi, batas keras, dan prosedur pengembangan. Dokumen ini tidak menggantikan spesifikasi teknis. Detail implementasi tetap mengacu pada dokumen masing-masing.
>
> Prinsip utama: perubahan kecil, jelas, aman, dan dapat diuji lebih berharga daripada perubahan besar yang sulit dirawat.

---

## 1. Konteks Proyek

Proyek ini adalah platform pembelajaran Scratch untuk satu guru yang mengajar di beberapa sekolah.

Guru dapat:
- Membuat dan mengelola kelas.
- Membuat tautan undangan berbatas waktu.
- Mengatur tugas dengan waktu buka dan tutup.
- Melihat seluruh murid dalam kelas.
- Melihat pengumpulan dan riwayat pengerjaan setiap murid.
- Mengunduh proyek pada titik waktu tertentu.
- Memberikan komentar pada pengumpulan.

Murid dapat:
- Bergabung melalui tautan undangan.
- Mengakses tugas yang sedang dibuka.
- Mengerjakan proyek melalui editor Scratch.
- Menyimpan proyek secara otomatis maupun manual.
- Mengumpulkan proyek berkali-kali.
- Melihat komentar guru.
- Mengunduh berkas `.sb3` untuk diunggah ke akun Scratch miliknya sendiri.

**Fitur pembeda utama adalah riwayat pengerjaan (snapshot).**

Platform tidak hanya menyimpan hasil akhir, tetapi juga merekam proses pengerjaan murid melalui snapshot otomatis dan manual.

Tujuan utamanya adalah membantu guru mengetahui proses pengerjaan, bukan sekadar menerima hasil akhir.

---

## 2. Siapa yang Mengerjakan

Proyek dikerjakan oleh satu guru yang bekerja sendiri.

Tidak ada:
- Tim developer.
- Code reviewer.
- Administrator teknis.
- Developer pengganti.
- Tim operasional khusus.

Konsekuensinya:

1. Jangan membuat solusi yang membutuhkan perawatan rumit.
2. Jangan menambahkan abstraksi tanpa kebutuhan nyata.
3. Jangan membuat sistem generik untuk kebutuhan yang belum ada.
4. Jangan memperkenalkan layanan eksternal baru tanpa alasan kuat.
5. Utamakan kode yang mudah dipahami setelah enam bulan tidak disentuh.
6. Hindari perubahan besar yang tidak diperlukan untuk menyelesaikan kebutuhan v1.

Jika ada dua solusi yang sama-sama benar, pilih yang paling sederhana dan mudah diuji.

---

## 3. Stack Teknologi

Gunakan teknologi yang sudah ditetapkan.

| Bagian | Teknologi | Ketentuan |
|---|---|---|
| Aplikasi kelas | Next.js App Router | Halaman, autentikasi, API, dan pengelolaan kelas |
| Bahasa | TypeScript | Gunakan tipe yang jelas |
| Editor | `scratch-gui` | Aplikasi terpisah di subdomain |
| Mesin Scratch | `scratch-vm` | Gunakan implementasi yang sudah tersedia |
| Database | PostgreSQL 15+ | SQL merupakan sumber kebenaran |
| Penyimpanan berkas | S3-compatible object storage | Menyimpan `.sb3` apa adanya |
| Styling | Tailwind CSS | Tidak perlu sistem desain tambahan |
| Unit test | Vitest | Menguji logika |
| E2E test | Playwright | Menguji alur pengguna |

### 3.1 Aturan dependensi

Sebelum menambahkan package baru, jawab pertanyaan berikut:

- Masalah apa yang diselesaikan?
- Mengapa package yang sudah ada tidak cukup?
- Apakah package ini menambah beban pemeliharaan?
- Apakah fitur tersebut benar-benar diperlukan untuk v1?

Jangan menambahkan package hanya karena lebih nyaman.

### 3.2 Teknologi yang tidak digunakan

Jangan memperkenalkan hal-hal berikut:

- Rust.
- Offline-first.
- Service worker.
- GraphQL.
- Mesin Scratch buatan sendiri.
- Tabel sesi buatan sendiri.
- ORM sebagai sumber kebenaran skema.
- Sistem microservices.
- Layanan tambahan yang tidak dibutuhkan.

Jika suatu kebutuhan tampaknya mengharuskan teknologi baru, jelaskan alasannya dan minta persetujuan sebelum mengubah stack.

### 3.3 Database dan ORM

SQL adalah sumber kebenaran skema database.

Jika menggunakan ORM:
- Skema ORM harus mengikuti SQL.
- Jangan mengubah database hanya karena ORM menghasilkan skema berbeda.
- Perubahan struktur database harus melalui migrasi baru.
- Jangan mengubah migrasi yang sudah pernah dijalankan.

Acuan utama: `DATABASE.md`.

---

## 4. Struktur Workspace

Repository menggunakan satu root `package.json` dan npm workspaces.

Aplikasi yang tersedia:

- `kelas/` — aplikasi Next.js.
- `editor/` — aplikasi editor Scratch yang dimodifikasi.

Konfigurasi workspace:

```json
{
  "workspaces": ["kelas", "editor"]
}
```

Ketentuan:

1. Jangan memindahkan aplikasi ke repository terpisah tanpa persetujuan.
2. Jangan mencampurkan kode editor ke dalam aplikasi Next.js.
3. Jangan membuat komunikasi langsung antara kedua aplikasi melalui akses database.
4. Editor berkomunikasi dengan aplikasi kelas melalui API yang ditentukan.
5. Jangan mengasumsikan nama script, package, atau perintah yang belum diperiksa di `package.json`.

Sebelum menjalankan perintah proyek, periksa script yang benar-benar tersedia.

---

## 5. Batas Arsitektur

Sistem terdiri dari dua aplikasi utama.

### 5.1 Aplikasi kelas

Bertanggung jawab atas:
- Autentikasi guru dan murid.
- Manajemen kelas.
- Manajemen undangan.
- Manajemen tugas.
- Keanggotaan kelas.
- Pengumpulan.
- Snapshot.
- Komentar.
- Pemeriksaan hak akses.
- Penyajian dan pengunduhan berkas.

### 5.2 Aplikasi editor

Bertanggung jawab atas:
- Menjalankan `scratch-gui`.
- Membuka dan memuat proyek.
- Menyimpan proyek.
- Menampilkan status penyimpanan.
- Menjalankan autosave.
- Mengirim permintaan pengumpulan.

Editor tidak boleh:
- Mengakses database secara langsung.
- Menentukan sendiri hak akses pengguna.
- Menentukan sendiri apakah tugas sedang dibuka.
- Menggunakan waktu komputer murid sebagai dasar keputusan.
- Mengetahui atau menyimpan `object_key` penyimpanan internal.

### 5.3 Komunikasi

Seluruh komunikasi antara editor dan aplikasi kelas harus melalui API resmi.

Acuan: dokumen spesifikasi API.

Jangan membuat endpoint tambahan tanpa memperbarui dokumen spesifikasi API terlebih dahulu.

---

## 6. Alur Bisnis yang Harus Dipertahankan

Urutan utama sistem:

1. Guru membuat kelas.
2. Guru membuat undangan.
3. Murid bergabung melalui undangan.
4. Guru membuat tugas dengan `dibuka_pada` dan `ditutup_pada`.
5. Murid membuka editor jika memenuhi ketentuan akses dan waktu.
6. Editor memuat proyek terakhir milik murid.
7. Autosave dan simpan manual membuat snapshot.
8. Murid menekan tombol Kumpulkan.
9. Sistem membuat submission baru.
10. Guru melihat seluruh murid, termasuk yang belum mengumpulkan.
11. Guru membuka riwayat snapshot dan mengunduh berkas pada titik waktu tertentu.
12. Murid mengunduh `.sb3` untuk diunggah ke akun Scratch miliknya.

Satu murid boleh mengumpulkan berkali-kali.

Pengumpulan baru tidak boleh menimpa pengumpulan sebelumnya.

---

## 7. Batas Keras — Tidak Bisa Dinegosiasikan

Aturan berikut wajib dipatuhi dalam setiap perubahan kode.

### 7.1 Integritas berkas `.sb3`

**Jangan pernah mengubah isi berkas `.sb3`.**

Berkas harus disimpan dan dikirim kembali sebagai byte yang sama persis.

Dilarang:
- Membuka ZIP untuk memodifikasi isinya.
- Mengubah `project.json`.
- Menambahkan metadata ke dalam arsip.
- Menyusun ulang isi ZIP.
- Mengubah struktur arsip.
- Mengompresi ulang arsip.
- Mengubah isi berkas sebelum dikirim ke akun Scratch.

Alasannya: berkas harus tetap kompatibel dengan akun Scratch asli milik murid.

### 7.2 Database tidak menyimpan isi `.sb3`

Database hanya menyimpan metadata dan referensi penyimpanan.

Contohnya:
- `object_key`
- `isi_hash`
- `ukuran_bytes`

Isi biner `.sb3` hanya berada di object storage.

### 7.3 Waktu berasal dari server

Seluruh keputusan waktu menggunakan waktu server atau database (`now()`).

Jangan menggunakan:
- Jam komputer murid.
- Jam komputer guru.
- Timestamp dari browser.
- Nilai waktu dari payload klien.

Berlaku untuk:
- Pemeriksaan jendela tugas.
- Masa berlaku undangan.
- Pencabutan undangan.
- Penentuan keterlambatan.
- Waktu pembuatan snapshot.
- Waktu pengumpulan.
- Pemeriksaan retensi.

Semua keputusan yang berkaitan dengan waktu harus ditentukan di server.

### 7.4 Perlindungan `object_key`

`object_key` adalah informasi internal server.

Jangan pernah mengirimkannya kepada klien melalui:
- JSON API.
- HTML.
- JavaScript.
- URL publik.
- Respons editor.
- Data halaman guru.

Pengunduhan harus melewati endpoint yang memeriksa hak akses.

### 7.5 Pemeriksaan kepemilikan

Jangan mempercayai ID yang dikirim klien.

Contohnya:
- `class_id`
- `assignment_id`
- `submission_id`
- `student_id`
- `snapshot_id`

Setiap permintaan harus memeriksa rantai kepemilikan dan keanggotaan sesuai peran pengguna.

Untuk akses guru, pastikan data berujung pada `teachers.id` milik sesi yang sedang aktif.

Untuk akses murid, pastikan murid merupakan anggota kelas yang terkait dengan tugas atau pengumpulan tersebut.

Jangan menganggap UUID sebagai pengganti pemeriksaan izin.

### 7.6 Pengumpulan terlambat

Jangan menolak pengumpulan hanya karena melewati waktu penutupan.

Sistem harus:
1. Menerima pengumpulan sesuai aturan API.
2. Menentukan status terlambat berdasarkan waktu server.
3. Menyimpan nilai `terlambat` saat kejadian.
4. Membiarkan guru memutuskan tindakan selanjutnya.

Jangan menghitung ulang status terlambat ketika halaman dibuka.

### 7.7 Migrasi database

Berkas migrasi yang sudah dijalankan tidak boleh diubah.

Jika ada perubahan skema:
- Buat migrasi baru.
- Gunakan nomor urut berikutnya.
- Pastikan migrasi aman terhadap data yang sudah ada.
- Uji migrasi sebelum deployment.

### 7.8 Sesi

Jangan membuat tabel sesi sendiri.

Gunakan cookie bertanda tangan atau library autentikasi yang sesuai dengan arsitektur proyek.

### 7.9 Mesin Scratch

Jangan menulis ulang `scratch-vm`.

Jangan mengubah perilaku internal mesin Scratch tanpa kebutuhan yang jelas dan persetujuan.

### 7.10 Pembacaan isi `.sb3`

Jangan membaca atau mengurai isi `.sb3` ketika menampilkan halaman.

Metadata yang diperlukan harus disiapkan pada saat snapshot dibuat, sesuai kontrak data yang telah disepakati.

Jangan menambahkan proses pembacaan arsip tersembunyi ketika guru membuka daftar riwayat.

---

## 8. Aturan Snapshot dan Submission

Kedua konsep ini tidak boleh disamakan.

### 8.1 Snapshot

Snapshot adalah rekaman otomatis atau manual dari proses pengerjaan.

Ketentuan:
- Autosave menghasilkan snapshot.
- Simpan manual menghasilkan snapshot.
- Snapshot dideduplikasi berdasarkan hash isi.
- Penyimpanan tanpa perubahan tidak menambah snapshot baru.
- Snapshot dapat dihapus oleh sistem retensi sesuai aturan.
- Snapshot yang pernah digunakan dalam pengumpulan harus tetap aman dari penghapusan yang dapat merusak submission.

### 8.2 Submission

Submission adalah tindakan sadar murid menekan tombol Kumpulkan.

Ketentuan:
- Setiap pengumpulan menghasilkan baris baru.
- Pengumpulan lama tidak ditimpa.
- Data objek disalin dari snapshot yang dipilih atau snapshot terakhir sesuai kontrak API.
- Submission tidak bergantung pada keberadaan baris snapshot melalui foreign key.
- Retensi snapshot tidak boleh menghapus berkas submission.

### 8.3 Retensi

Batas retensi mengikuti `REQUIREMENTS.md` dan `DATABASE.md` setelah keduanya diselaraskan.

Jangan membuat mekanisme penghapusan yang berisiko menghapus pekerjaan yang pernah dikumpulkan.

---

## 9. Aturan Keamanan

Keamanan harus diterapkan di server, bukan hanya di antarmuka.

Wajib:
- Memeriksa autentikasi pada endpoint yang memerlukan sesi.
- Memeriksa kepemilikan sumber daya.
- Memeriksa keanggotaan kelas.
- Memvalidasi input.
- Membatasi ukuran unggahan.
- Mencegah akses berkas tanpa izin.
- Melindungi cookie sesi.
- Tidak membocorkan token atau informasi internal.
- Menggunakan query database yang aman dari SQL injection.
- Membatasi percobaan yang berisiko disalahgunakan.

Jangan mengandalkan:
- Tombol yang disembunyikan.
- ID yang sulit ditebak.
- Validasi JavaScript saja.
- Status halaman yang dikirim klien.

Semua keputusan akses wajib diperiksa kembali oleh server.

---

## 10. Aturan Antarmuka

### 10.1 Untuk murid

Murid adalah anak-anak SD.

Gunakan:
- Bahasa Indonesia sederhana.
- Pesan yang menenangkan.
- Instruksi yang jelas.
- Informasi yang mudah dipahami.

Hindari:
- Pesan teknis yang tidak perlu.
- Istilah HTTP.
- Pesan galat yang menakutkan.
- Menyalahkan murid ketika terjadi masalah.

### 10.2 Untuk guru

Antarmuka guru harus:
- Ringkas.
- Padat.
- Mudah dipindai.
- Meminimalkan jumlah klik.
- Menampilkan informasi penting secara langsung.

Jangan menambahkan fitur atau elemen visual yang tidak membantu pekerjaan guru.

Acuan tampilan: `DESIGN.md`.

---

## 11. Prosedur Kerja Agen AI

Setiap pekerjaan harus mengikuti prosedur berikut.

### Langkah 1 — Baca konteks

Sebelum mengubah kode:
- Baca `KONTEKS.md`.
- Baca `AGENTS.md`.
- Baca dokumen teknis yang berkaitan dengan pekerjaan.

Jangan mengerjakan fitur hanya berdasarkan dugaan atau percakapan tanpa memeriksa spesifikasinya.

### Langkah 2 — Identifikasi ruang lingkup

Tentukan:
- Masalah yang akan diselesaikan.
- File yang perlu diubah.
- Dokumen yang menjadi acuan.
- Risiko terhadap fitur yang sudah ada.
- Pengujian yang diperlukan.

Jangan mengubah file lain jika tidak diperlukan.

### Langkah 3 — Periksa implementasi yang sudah ada

Sebelum menulis kode:
- Periksa struktur proyek.
- Periksa implementasi terkait.
- Periksa fungsi yang sudah tersedia.
- Periksa migrasi yang sudah dijalankan.
- Periksa pengujian yang sudah tersedia.

Jangan membuat implementasi duplikat hanya karena belum menemukan implementasi lama.

### Langkah 4 — Buat perubahan sekecil mungkin

Utamakan:
- Satu masalah dalam satu perubahan.
- Fungsi yang sederhana.
- Nama variabel yang jelas.
- Penanganan galat yang konsisten.
- Perubahan yang mudah dibatalkan.

Jangan melakukan refactor besar yang tidak berkaitan dengan pekerjaan.

### Langkah 5 — Jalankan pengujian

Jalankan pengujian yang sesuai dengan perubahan.

Minimal:
- Pemeriksaan TypeScript.
- Unit test terkait.
- Integration test jika menyentuh batas antarbagian.
- E2E test jika mengubah alur pengguna.

Jangan menyatakan pekerjaan berhasil jika pengujian belum dijalankan.

Jika tidak bisa menjalankan pengujian, jelaskan alasannya.

### Langkah 6 — Laporkan hasil

Setiap pekerjaan harus diakhiri dengan laporan:

1. Masalah yang diperbaiki.
2. File yang diubah.
3. Perubahan yang dilakukan.
4. Pengujian yang dijalankan.
5. Hasil pengujian.
6. Hal yang belum selesai.
7. Risiko atau keputusan yang membutuhkan persetujuan.

Jangan menyembunyikan kegagalan pengujian.

---

## 12. Penanganan Konflik Dokumen

Dokumen proyek merupakan sumber spesifikasi.

Jika dua dokumen berbeda pendapat:
1. Jangan memilih salah satu berdasarkan asumsi.
2. Identifikasi bagian yang bertentangan.
3. Jelaskan dampaknya terhadap implementasi.
4. Tunjukkan bagian dokumen yang perlu diselaraskan.
5. Hentikan perubahan yang bergantung pada keputusan tersebut.
6. Minta keputusan guru sebelum melanjutkan.

Jika kode berbeda dengan dokumen, jangan langsung mengubah dokumen agar sesuai dengan kode.

Periksa terlebih dahulu apakah implementasi memang salah atau dokumen sudah usang.

Jika ditemukan informasi yang tidak konsisten, jangan diam-diam memperbaikinya tanpa mencatat keputusan.

---

## 13. Batas Ruang Lingkup v1

Jangan menambahkan fitur berikut tanpa persetujuan:

- Mode offline.
- Aplikasi ponsel.
- Sistem nilai atau rapor.
- Notifikasi email.
- Banyak guru dalam satu kelas.
- Peran administrator.
- Akun wali murid.
- Integrasi LMS.
- Distribusi proyek antar murid.
- Pratinjau langsung proyek di halaman guru.
- Bahasa selain Indonesia.
- Mesin Scratch buatan sendiri.

Fitur tersebut berada di luar ruang lingkup v1.

Acuan: `REQUIREMENTS.md`.

---

## 14. Prioritas Pengembangan

Urutan pengembangan yang harus dipertahankan:

1. Gerbang kompatibilitas `.sb3` dengan Scratch sungguhan.
2. Middleware autentikasi dan pemeriksaan rantai izin.
3. Endpoint `GET /api/v1/editor/session`.
4. Penyimpanan dan pemuatan snapshot.
5. Fitur Kumpulkan dan submission.
6. Endpoint guru: kelas, tugas, daftar nilai, dan riwayat.
7. Autosave klien dan `sendBeacon`.
8. Retensi dan pembersihan berkala.

Jangan melompati gerbang kompatibilitas.

Jangan membangun fitur tambahan sebelum alur inti dapat berjalan dengan benar.

---

## 15. Kriteria Keberhasilan

Pekerjaan dinyatakan selesai jika:

- Sesuai kebutuhan v1.
- Tidak melanggar batas keras.
- Tidak merusak data yang sudah ada.
- Memiliki pengujian yang sesuai.
- Tidak memperkenalkan dependensi yang tidak diperlukan.
- Dokumentasi terkait sudah diperbarui.
- Hasilnya dapat dipahami dan dirawat oleh satu orang.

**Prinsip penutup:**

Bangun platform yang benar-benar dapat digunakan untuk mengajar, bukan platform yang sekadar terlihat canggih.

Keutuhan proyek murid, keamanan data, dan kemudahan pemeliharaan selalu lebih penting daripada banyaknya fitur.