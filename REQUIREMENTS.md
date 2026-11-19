# REQUIREMENTS.md — Scratch Kelas v1

> Dokumen ini menetapkan apa yang harus dilakukan v1 dan, sama pentingnya, apa yang sengaja tidak dikerjakan. Setiap batas ruang lingkup memiliki alasan agar keputusan tidak perlu diperdebatkan ulang setiap kali muncul ide fitur baru.
>
> Diperbarui: 18 November 2026

---

## 1. Tujuan

Platform untuk mengajar Scratch di beberapa sekolah.

Guru dapat:

- Mengelola beberapa sekolah dari satu akun.
- Membuat kelas dan mengundang murid melalui tautan berbatas waktu.
- Membuat tugas dengan waktu buka dan tutup.
- Melihat pengumpulan murid.
- Melihat riwayat pengerjaan murid melalui snapshot.
- Memberikan komentar pada pengumpulan.

Murid dapat:

- Bergabung ke kelas melalui undangan.
- Mengerjakan tugas menggunakan editor berbasis Scratch.
- Menyimpan pekerjaan secara berkala.
- Mengumpulkan pekerjaan lebih dari sekali.
- Melihat komentar guru.
- Mengunduh berkas `.sb3` untuk diunggah ke akun Scratch mereka sendiri.

Diferensiasi utama aplikasi ini adalah **riwayat pengerjaan**. Guru tidak hanya melihat hasil akhir, tetapi juga urutan snapshot yang menunjukkan perkembangan pekerjaan murid.

Satu guru. Beberapa sekolah. Tidak ada tim pengembang.

Karena proyek dikerjakan sendiri, solusi harus sederhana, mudah dirawat, dan tidak menambahkan kompleksitas tanpa kebutuhan yang jelas.

---

## 2. Pengguna dan peran

| Peran | Siapa | Yang bisa dilakukan |
|---|---|---|
| **Guru** | Satu guru dengan satu akun untuk beberapa sekolah | Membuat sekolah, kelas, undangan, dan tugas; melihat pengumpulan dan riwayat; memberikan komentar |
| **Murid** | Anak-anak SD di sekolah yang diajar | Bergabung lewat undangan, mengerjakan tugas, menyimpan snapshot, mengumpulkan berkali-kali, melihat komentar, mengunduh `.sb3` |

Tidak ada peran admin, wali murid, kepala sekolah, atau guru lain dalam v1.

Satu murid dapat mengikuti beberapa kelas menggunakan satu akun.

Satu guru dapat mengelola beberapa sekolah menggunakan satu akun.

---

## 3. Ruang lingkup v1

### 3.1 Sekolah dan kelas

- Guru dapat membuat beberapa sekolah.
- Guru dapat membuat beberapa kelas.
- Setiap kelas dapat dikaitkan dengan satu sekolah.
- Nama sekolah berfungsi sebagai pengelompokan dan label, bukan batas kepemilikan data.
- Semua kelas tetap dimiliki oleh akun guru yang membuatnya.
- Guru dapat melihat daftar kelas dan murid di setiap kelas.
- Satu murid dapat menjadi anggota beberapa kelas.

### 3.2 Undangan

- Guru dapat membuat tautan undangan untuk sebuah kelas.
- Undangan memiliki masa berlaku.
- Undangan dapat memiliki batas jumlah pemakaian.
- Guru dapat mencabut undangan sebelum masa berlakunya habis.
- Murid baru hanya dapat bergabung menggunakan undangan yang masih berlaku.
- Pencabutan undangan tidak mengeluarkan murid yang sudah menjadi anggota kelas.
- Undangan yang sudah kedaluwarsa atau dicabut tidak dapat digunakan lagi.

### 3.3 Akun dan masuk

**Guru:**

- Masuk menggunakan email dan kata sandi.
- Satu akun guru dapat mengelola beberapa sekolah dan kelas.

**Murid:**

- Bergabung melalui tautan undangan.
- Mengisi nama dan kata sandi ketika pertama kali bergabung.
- Email bersifat opsional.
- Setelah bergabung, murid dapat masuk kembali menggunakan mekanisme autentikasi yang disediakan aplikasi.

Tidak ada sistem akun untuk admin atau wali murid pada v1.

### 3.4 Tugas

- Guru dapat membuat tugas di dalam kelas.
- Setiap tugas memiliki judul dan jendela waktu pengerjaan.
- Waktu buka disimpan sebagai `dibuka_pada`.
- Waktu tutup disimpan sebagai `ditutup_pada`.
- Tugas dapat dibuka kembali dengan mengubah waktu tutup atau waktu buka.
- Mengubah waktu tugas tidak boleh menghapus pengumpulan atau snapshot lama.
- Editor hanya dapat diakses ketika tugas berada dalam jendela waktu pengerjaan.
- Pemeriksaan waktu dilakukan oleh server, bukan berdasarkan jam perangkat murid.

### 3.5 Pengerjaan di editor

- Editor menggunakan `scratch-gui` yang berjalan sebagai aplikasi terpisah di subdomain.
- Jangan membangun mesin Scratch sendiri.
- Jangan memodifikasi `scratch-vm` untuk kebutuhan penyimpanan biasa.
- Proyek disimpan sebagai berkas `.sb3` apa adanya.
- Arsip `.sb3` dipindahkan dan disimpan utuh.
- Jangan mengubah, mengurai untuk dimodifikasi, atau menambahkan metadata ke `project.json`.
- Metadata aplikasi disimpan di database, bukan di dalam arsip `.sb3`.
- Editor menyediakan simpan otomatis dan simpan manual.
- Editor menampilkan status penyimpanan agar murid mengetahui apakah pekerjaan sudah tersimpan.

#### Aturan penyimpanan

Mengikuti konteks proyek saat ini:

- Simpan otomatis menggunakan jeda sekitar **30 detik** ketika editor aktif dan ada perubahan.
- Lakukan penyimpanan paksa berkala setiap **5 menit** selama sesi pengerjaan aktif.
- Simpan manual tetap tersedia.
- Snapshot dengan isi identik tidak perlu dibuat berulang kali.
- Kegagalan penyimpanan harus ditampilkan dengan jelas.
- Jangan menyatakan pekerjaan sudah tersimpan sebelum server mengonfirmasi keberhasilan.

Angka jeda penyimpanan ini perlu dikunci di `DECISIONS.md` dan diterapkan konsisten di editor serta API.

Mode offline dan sinkronisasi setelah koneksi kembali tidak termasuk v1.

### 3.6 Pengumpulan

- Murid dapat mengumpulkan pekerjaan lebih dari sekali.
- Setiap pengumpulan menghasilkan satu catatan tersendiri.
- Pengumpulan baru tidak menghapus pengumpulan lama.
- Daftar pengumpulan guru menampilkan pengumpulan terakhir setiap murid.
- Riwayat pengumpulan lama tetap dapat dibuka.
- Murid dapat mengunduh berkas `.sb3` hasil pengumpulannya.
- Guru dapat mengunduh berkas `.sb3` milik murid yang berada dalam kelasnya.
- Berkas yang diunduh harus sama dengan berkas yang disimpan, tanpa perubahan isi.

#### Pengumpulan terlambat

- Pengumpulan yang masuk setelah waktu tutup tetap disimpan.
- Pengumpulan tersebut diberi penanda `terlambat`.
- Status terlambat dicatat saat pengumpulan terjadi dan tidak dihitung ulang di kemudian hari.
- Jangan menolak atau menghilangkan pengumpulan hanya karena terlambat.
- Guru dapat melihat penanda terlambat dan memutuskan tindak lanjutnya.

Aturan akses editor dan aturan penyimpanan pengumpulan adalah dua hal berbeda. Akses editor tetap mengikuti jendela waktu yang ditetapkan. Jika pengumpulan terlambat diterima oleh server, pengumpulan itu harus disimpan dan ditandai terlambat.

### 3.7 Riwayat pengerjaan

- Setiap simpan otomatis menghasilkan snapshot jika isi proyek berubah.
- Setiap simpan manual menghasilkan snapshot jika isi proyek berubah.
- Snapshot dideduplikasi berdasarkan hash isi.
- Penyimpanan tanpa perubahan tidak menambah snapshot baru.
- Snapshot memiliki waktu dan jenis penyimpanan.
- Guru dapat melihat snapshot dalam urutan waktu.
- Guru dapat mengunduh snapshot tertentu.
- Retensi awal adalah 20 snapshot per kombinasi tugas dan murid.
- Penghapusan snapshot lama harus memperhatikan apakah berkas tersebut masih digunakan oleh pengumpulan.

Untuk v1, riwayat menampilkan waktu dan jenis penyimpanan. Tidak perlu menghitung perubahan jumlah balok dengan membaca isi `.sb3`.

**Pemutar proyek interaktif dari halaman guru tidak menjadi syarat v1.** Fitur ini dapat dipertimbangkan setelah alur penyimpanan, pengumpulan, dan unduhan terbukti stabil.

### 3.8 Komentar

- Guru dapat memberikan komentar pada pengumpulan murid.
- Murid dapat memberikan komentar pada pengumpulan miliknya.
- Komentar guru terlihat oleh murid yang bersangkutan.
- Komentar murid terlihat oleh guru yang berwenang.
- Komentar terikat pada pengumpulan, bukan pada snapshot tertentu.
- Komentar memiliki penulis dan waktu pembuatan.

### 3.9 Halaman guru

Guru dapat:

- Melihat daftar sekolah dan kelas.
- Melihat anggota kelas.
- Membuat dan mengelola undangan.
- Membuat dan mengubah waktu tugas.
- Melihat daftar pengumpulan.
- Melihat jumlah pengumpulan setiap murid.
- Melihat status terlambat.
- Membuka riwayat snapshot.
- Mengunduh pengumpulan dan snapshot.
- Memberikan komentar.

### 3.10 Halaman murid

Murid dapat:

- Melihat kelas yang diikuti.
- Melihat daftar tugas.
- Mengetahui status dan batas waktu tugas.
- Membuka editor ketika tugas dapat dikerjakan.
- Menyimpan proyek.
- Mengumpulkan proyek berkali-kali.
- Melihat pengumpulan miliknya.
- Melihat komentar.
- Mengunduh berkas `.sb3`.

---

## 4. Yang tidak dilakukan v1

Ini adalah batas ruang lingkup yang harus dijaga. Jangan mengerjakan fitur berikut sebelum kebutuhan utama v1 selesai.

| Tidak ada | Alasan | Tinjau ulang |
|---|---|---|
| **Mode luring / offline-first** | Membutuhkan penyimpanan lokal, sinkronisasi, dan penanganan konflik. Terlalu besar untuk kebutuhan awal. | Jika murid benar-benar perlu mengerjakan tugas dari rumah tanpa koneksi stabil |
| **VM Scratch tulisan sendiri** | `scratch-vm` sudah tersedia. Memelihara mesin sendiri menambah pekerjaan yang tidak diperlukan. | Tidak direncanakan |
| **Rust** | Kebutuhan utama hanya menyimpan dan menyajikan berkas. | Tidak direncanakan |
| **Mengubah `project.json`** | Dapat merusak kompatibilitas `.sb3` dengan Scratch. Metadata aplikasi disimpan di database. | Tidak direncanakan |
| **Dukungan ponsel** | Scratch membutuhkan layar lebar dan tetikus untuk pengalaman yang layak. | Jika kebutuhan perangkat berubah |
| **Pemutar proyek langsung di halaman guru** | Membutuhkan integrasi editor dalam mode tinjauan dan jalur akses berkas yang aman. Bukan prioritas alur inti v1. | Jika mengunduh snapshot untuk meninjau pekerjaan terasa terlalu lambat |
| **Nilai angka dan rapor** | Penilaian v1 menggunakan komentar dan riwayat, bukan sistem angka. | Jika sekolah membutuhkan rapor |
| **Notifikasi email** | Menambah layanan dan titik kegagalan baru. Informasi dapat dilihat di halaman aplikasi. | Jika murid sering melewatkan tugas atau komentar |
| **Banyak guru dalam satu kelas** | v1 hanya ditujukan untuk satu guru. | Jika ada guru lain yang ikut mengajar |
| **Bahasa selain Indonesia** | Belum ada kebutuhan untuk bahasa lain. | Jika ada sekolah yang memerlukannya |
| **Distribusi proyek antar murid** | Menambah persoalan izin dan kepemilikan berkas. | Tidak direncanakan |
| **LMS dan integrasi pihak ketiga** | Tidak dibutuhkan untuk alur utama. | Jika ada kebutuhan nyata |
| **Aplikasi desktop atau native** | Aplikasi web sudah mencukupi untuk v1. | Jika kebutuhan penggunaan berubah |

---

## 5. Batas teknis dan operasional

Angka di bawah adalah batas awal untuk implementasi. Angka yang belum diverifikasi harus dianggap sebagai konfigurasi awal, bukan jaminan kompatibilitas dengan layanan Scratch.

| Batas | Nilai awal | Keterangan |
|---|---:|---|
| Ukuran satu `.sb3` | 50 MB | Usulan batas aplikasi. Harus diuji dengan alur unggah dan unduh sebenarnya. Bukan klaim batas resmi Scratch. |
| Snapshot per (tugas, murid) | 20 | Retensi awal untuk mengendalikan penggunaan penyimpanan. |
| Masa berlaku undangan bawaan | 7 hari | Dapat diubah ketika undangan dibuat jika diperlukan. |
| Jeda simpan otomatis | 30 detik | Saat editor aktif dan ada perubahan. |
| Penyimpanan paksa berkala | 5 menit | Selama sesi pengerjaan aktif. |
| Ukuran satu komentar | 2000 karakter | Batas input komentar. |
| Murid per kelas | 60 | Batas awal untuk satu kelas. |

### Aturan penerapan batas

- Batas ukuran berkas harus diperiksa di server.
- Jangan hanya mengandalkan validasi ukuran di browser.
- Batas jumlah murid harus diperiksa ketika murid bergabung.
- Batas pemakaian undangan harus diperiksa secara aman di server.
- Retensi snapshot tidak boleh menghapus berkas yang masih dirujuk oleh pengumpulan.
- Jika batas perlu diubah, ubah konfigurasi dan dokumentasinya secara konsisten.

### Aturan waktu

- Gunakan waktu server atau database untuk semua keputusan waktu.
- Jangan mempercayai jam perangkat murid atau guru.
- Simpan waktu dalam tipe yang sesuai, misalnya `timestamptz`.
- Status terlambat dicatat saat pengumpulan terjadi.
- Perubahan waktu tugas tidak mengubah status terlambat yang sudah tercatat.

### Aturan berkas

- Isi `.sb3` tidak disimpan di database.
- Database hanya menyimpan metadata dan referensi penyimpanan.
- `object_key` tidak boleh dikirim ke klien.
- Unduhan berkas harus melewati pemeriksaan kepemilikan.
- Jangan mengubah isi arsip `.sb3`.

---

## 6. Kriteria selesai v1

v1 dianggap selesai hanya jika seluruh kriteria berikut berhasil diuji.

1. Guru dapat membuat sekolah dan kelas.
2. Guru dapat membuat undangan dan mengirim tautannya kepada murid.
3. Murid dapat bergabung menggunakan undangan yang masih berlaku.
4. Guru dapat membuat tugas dengan waktu buka dan tutup.
5. Murid dapat membuka editor ketika tugas sedang dibuka.
6. Murid dapat membuat proyek dan menyimpannya.
7. Simpan otomatis dan simpan manual menghasilkan snapshot sesuai aturan.
8. Snapshot yang tidak berubah tidak dibuat berulang kali.
9. Guru dapat melihat daftar pengumpulan, termasuk murid yang belum mengumpulkan.
10. Guru dapat melihat pengumpulan terakhir dan riwayat pengumpulan sebelumnya.
11. Guru dapat mengunduh berkas `.sb3`.
12. Murid dapat mengunduh berkas `.sb3` miliknya.
13. **Berkas `.sb3` yang diunduh dapat diunggah ke akun Scratch sungguhan dan proyek berjalan utuh.** Ini adalah uji penentu kompatibilitas.
14. Murid dapat mengumpulkan versi kedua dan guru melihat kedua pengumpulan dalam riwayat.
15. Pengumpulan terlambat tetap tersimpan dan diberi penanda terlambat.
16. Guru dapat mengubah waktu tugas tanpa menghapus riwayat lama.
17. Guru dapat mencabut undangan sehingga murid baru tidak bisa bergabung, tetapi murid lama tetap dapat masuk.
18. Guru dan murid dapat melihat serta menulis komentar sesuai hak akses.
19. Pengguna tidak dapat mengakses kelas, tugas, pengumpulan, snapshot, atau berkas milik guru lain.
20. Penghapusan atau retensi snapshot tidak merusak berkas yang masih digunakan oleh pengumpulan.

Jangan menganggap v1 selesai hanya karena halaman dapat dibuka. Alur berkas `.sb3` harus terbukti bekerja dengan akun Scratch sungguhan.

---

## 7. Asumsi

Asumsi berikut digunakan untuk merancang v1:

- Murid memiliki akun Scratch masing-masing atau dapat membuatnya.
- Laboratorium sekolah memiliki koneksi internet yang cukup untuk memuat editor.
- Murid menggunakan komputer atau laptop dengan layar yang cukup lebar.
- Guru mengelola aplikasi, deployment, dan dukungan murid sendiri.
- Tidak ada tenggat proyek dari pihak luar.
- Pengumpulan `.sb3` dilakukan melalui aplikasi ini, lalu murid mengunggahnya sendiri ke akun Scratch.
- Aplikasi tidak mengelola akun Scratch milik murid.

Jika asumsi penting berubah, tinjau ulang ruang lingkup sebelum menambahkan fitur.

---

## 8. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| `.sb3` hasil editor lokal tidak kompatibel dengan Scratch | Tujuan utama aplikasi gagal | Uji unggah ke akun Scratch sungguhan sebelum mengembangkan fitur kelas secara luas |
| Perubahan `scratch-gui` mengubah mekanisme penyimpanan | Simpan dan muat proyek rusak | Batasi perubahan pada titik integrasi penyimpanan dan uji setelah pembaruan |
| Pekerjaan murid hilang | Kepercayaan murid dan guru hilang | Snapshot, simpan otomatis, simpan manual, dan penanganan kegagalan yang terlihat |
| Pengumpulan terlambat tidak tersimpan | Riwayat pekerjaan tidak lengkap | Simpan pengumpulan dan tandai terlambat, jangan menolak diam-diam |
| Snapshot terhapus padahal masih digunakan pengumpulan | Berkas pengumpulan tidak dapat diunduh | Lindungi snapshot yang dirujuk pengumpulan dari proses retensi |
| Guru dapat mengakses data kelas guru lain | Kebocoran data | Periksa rantai kepemilikan sampai `teachers.id` pada setiap endpoint |
| `object_key` bocor ke browser | Penyimpanan dapat disalahgunakan | Gunakan endpoint unduhan yang memeriksa izin; jangan kirim `object_key` |
| Waktu perangkat pengguna tidak akurat | Tugas salah dianggap terbuka atau terlambat | Gunakan waktu server/database |
| Fitur melebar karena ide tambahan | Proyek tidak pernah selesai | Patuhi bagian 4 dan tunda fitur yang bukan kebutuhan inti |
| Kegagalan koneksi saat menyimpan | Perubahan terakhir mungkin belum tersimpan | Tampilkan status penyimpanan dan jangan memberi klaim berhasil tanpa konfirmasi server |

---

## 9. Prioritas pengerjaan

Urutan berikut mengutamakan pembuktian risiko terbesar sebelum membangun fitur lain.

1. **Uji kompatibilitas `.sb3`.** Buktikan proyek dari editor dapat disimpan, diunduh, diunggah ke akun Scratch sungguhan, dan berjalan.
2. Siapkan database dan migrasi awal.
3. Implementasikan autentikasi guru dan murid.
4. Implementasikan pemeriksaan kepemilikan dan hak akses.
5. Implementasikan sekolah, kelas, dan undangan.
6. Implementasikan tugas dan pemeriksaan jendela waktu.
7. Implementasikan sesi editor.
8. Implementasikan simpan otomatis, simpan manual, dan snapshot.
9. Implementasikan pengumpulan berulang dan penanda terlambat.
10. Implementasikan daftar pengumpulan dan riwayat.
11. Implementasikan unduhan berkas.
12. Implementasikan komentar.
13. Uji seluruh alur dengan Playwright.

Jangan membangun fitur lanjutan sebelum uji kompatibilitas `.sb3` berhasil.

---

## 10. Prinsip keputusan ruang lingkup

Jika muncul ide fitur baru, tanyakan:

1. Apakah fitur ini diperlukan agar alur inti v1 bisa digunakan?
2. Apakah fitur ini melindungi pekerjaan atau data murid?
3. Apakah fitur ini bisa ditunda tanpa menghalangi guru mengajar?
4. Apakah biaya pemeliharaannya sebanding dengan manfaatnya?

Jika fitur tidak diperlukan untuk alur inti dan tidak berkaitan dengan keamanan atau integritas data, masukkan ke daftar setelah v1.

**Tujuan v1 bukan menjadi platform pembelajaran yang lengkap. Tujuannya adalah membuat satu guru dapat mengelola kelas Scratch, menerima pekerjaan murid, dan melihat riwayat pengerjaannya dengan andal.**