# TESTING.md — Rencana Pengujian Scratch Kelas v1

Panduan pengujian manual dan otomatis untuk memastikan aplikasi berjalan dengan benar, file `.sb3` tetap utuh, pekerjaan murid tidak hilang, dan data hanya dapat diakses oleh pengguna yang berhak.

Pengujian dilakukan secara bertahap. Jangan membangun seluruh platform sebelum gerbang kompatibilitas Scratch berhasil dilewati.

---

## 1. Tujuan dan aturan pengujian

Pengujian harus menjawab lima pertanyaan utama:

1. Apakah file `.sb3` dari editor lokal dapat dibuka dan dijalankan di Scratch?
2. Apakah penyimpanan, pengumpulan, dan riwayat menjaga pekerjaan murid tetap utuh?
3. Apakah editor langsung menjadi baca-saja ketika tenggat tercapai?
4. Apakah penyimpanan terakhir yang telah didaftarkan sebelum tenggat dapat diselesaikan dengan aman?
5. Apakah murid dan guru hanya dapat melihat serta mengubah data yang memang menjadi haknya?

Gunakan dokumen berikut sebagai acuan:

- `KONTEKS.md`
- `AGENTS.md`
- `DATABASE.md`
- `DESIGN.md`
- `REQUIREMENTS.md`
- `API-CONTRACTS.md`

Jika isi dokumen berbeda, jangan menebak perilaku yang benar. Catat perbedaannya dan perbarui dokumen terkait sebelum menyatakan pengujian lulus.

Gunakan akun dan proyek uji khusus. Jangan memakai nama lengkap, alamat email pribadi, atau proyek murid sungguhan.

### 1.1 Prinsip penting

- File `.sb3` tidak boleh berubah selama penyimpanan dan pengunduhan.
- Server tidak boleh mengurai isi `.sb3`.
- Jam perangkat murid tidak boleh menjadi dasar keputusan waktu.
- Editor harus menjadi baca-saja ketika tenggat tercapai.
- Penyimpanan terakhir hanya boleh diselesaikan jika sudah didaftarkan sebelum tenggat melalui save intent yang sah.
- Murid tetap boleh mengumpulkan setelah tenggat.
- Pengumpulan terlambat tetap disimpan dan diberi penanda.
- Autosave tidak boleh membuat submission.
- Submission sebelumnya tidak boleh tertimpa oleh pengumpulan berikutnya.
- `object_key` tidak boleh bocor ke browser.

---

## 2. Urutan pengujian dan gerbang proyek

### Gerbang 0 — Kompatibilitas Scratch

Jalankan sebelum membangun fitur kelas, tugas, atau akun murid.

Langkah:

1. Jalankan `scratch-gui` lokal sesuai petunjuk `AGENTS.md`.
2. Buat proyek sederhana yang mudah dikenali.
3. Gunakan satu sprite, satu kostum, dan beberapa blok.
4. Simpan proyek sebagai `.sb3`.
5. Buka kembali file tersebut di editor lokal.
6. Pastikan sprite, kostum, dan blok masih ada.
7. Unggah file ke akun Scratch uji.
8. Buka proyek di Scratch.
9. Jalankan proyek dan pastikan perilakunya benar.
10. Unduh salinan proyek dari Scratch.
11. Buka kembali salinan tersebut di editor lokal.

**Lulus jika:**
- Editor lokal dapat menyimpan dan membuka proyek.
- Scratch dapat menerima file hasil editor lokal.
- Proyek dapat dijalankan.
- Tidak ada sprite, kostum, blok, atau aset yang hilang.

**Gagal jika:**
- File tidak dapat dibuka.
- File ditolak Scratch.
- Proyek berubah atau rusak setelah diunggah.
- Ada bagian proyek yang hilang.

Jika gerbang ini gagal, hentikan pengembangan fitur kelas. Periksa alur ekspor dan impor editor terlebih dahulu.

Jangan memperbaiki masalah dengan mengubah isi `project.json` secara manual.

### Gerbang 1 — Integritas penyimpanan file

Buktikan bahwa aplikasi dapat menyimpan dan mengembalikan proyek tanpa mengubah byte file.

Langkah:

1. Siapkan file `.sb3` uji.
2. Hitung SHA-256 file sebelum upload.
3. Unggah file melalui aplikasi.
4. Pastikan server menyelesaikan penyimpanan.
5. Unduh kembali file melalui endpoint yang memeriksa izin.
6. Hitung SHA-256 file hasil unduhan.
7. Bandingkan kedua hash.
8. Buka file hasil unduhan di editor lokal.

**Lulus jika:**
- Hash sebelum dan sesudah penyimpanan sama.
- Ukuran file sama.
- File dapat dibuka kembali.
- Kegagalan upload tidak menghapus versi yang sebelumnya berhasil disimpan.

Server hanya menghitung hash dan ukuran file. Pengujian ini tidak boleh mengharuskan server membuka ZIP atau membaca `project.json`.

### Gerbang 2 — Alur kelas sampai riwayat

Jalankan skenario ujung-ke-ujung setelah fitur utama tersedia.

**Lulus jika:**
- Guru dapat membuat kelas dan tugas.
- Murid dapat bergabung melalui undangan.
- Murid dapat mengerjakan tugas.
- Autosave dan simpan manual bekerja.
- Murid dapat mengumpulkan pekerjaan.
- Guru dapat melihat daftar murid, submission, dan riwayat.
- Guru dapat mengunduh versi proyek.
- Pemeriksaan kepemilikan bekerja.

---

## 3. Jenis pengujian

### 3.1 Uji unit

Gunakan untuk menguji logika kecil tanpa menjalankan seluruh aplikasi.

Contoh:

- Perhitungan waktu buka dan tutup tugas.
- Penentuan apakah editor boleh diedit.
- Penentuan status pengumpulan terlambat.
- Validasi save intent.
- Pemeriksaan hash dan ukuran file terhadap save intent.
- Penolakan save intent yang sudah kedaluwarsa.
- Penolakan save intent yang sudah digunakan.
- Deduplikasi snapshot berdasarkan hash.
- Penghitungan urutan submission.
- Batas retensi snapshot.
- Validasi nama tugas dan panjang komentar.
- Pemeriksaan kepemilikan data.

Uji unit tidak menggantikan uji integrasi atau pengujian langsung dengan Scratch.

### 3.2 Uji integrasi

Uji hubungan antarbagian:

- API dengan PostgreSQL.
- API dengan object storage.
- API dengan autentikasi.
- API dengan pemeriksaan kepemilikan.
- Editor dengan endpoint session.
- Editor dengan endpoint snapshot.
- Editor dengan mekanisme save intent.
- Editor dengan endpoint pengumpulan.
- Endpoint unduhan dengan pemeriksaan izin.

Gunakan database dan object storage khusus pengujian, bukan data produksi.

### 3.3 Uji ujung-ke-ujung

Uji alur yang benar-benar digunakan guru dan murid.

Prioritaskan:
- Pekerjaan murid tidak hilang.
- Editor terkunci pada waktu yang benar.
- Pengumpulan terlambat tetap tersimpan.
- Riwayat tidak tertimpa.
- Pengguna tidak dapat membaca data pihak lain.

### 3.4 Uji manual

Gunakan untuk memeriksa:
- Perilaku Scratch sebenarnya.
- Tampilan di browser.
- Pesan status yang dibaca murid.
- Perilaku saat jaringan terputus.
- Perilaku ketika tab ditutup.
- Perilaku editor tepat pada waktu tenggat.

---

## 4. Persiapan data uji

Siapkan lingkungan pengujian yang terpisah dari produksi.

Data minimal:

- Satu akun guru uji.
- Dua akun murid uji.
- Dua kelas uji atau satu kelas dengan dua murid.
- Satu undangan aktif.
- Satu undangan yang sudah dicabut.
- Satu undangan kedaluwarsa.
- Satu tugas yang belum dibuka.
- Satu tugas yang sedang dibuka.
- Satu tugas yang sudah ditutup.
- Satu tugas dengan `izinkan_terlambat = true`.
- Satu tugas dengan `izinkan_terlambat = false`.
- Dua file `.sb3` yang berbeda.
- Satu proyek yang dapat digunakan untuk menguji perubahan berulang.
- Komentar uji tanpa informasi pribadi.

Untuk pengujian waktu, gunakan waktu tugas uji yang dapat diatur atau lingkungan pengujian dengan jam database yang terkendali.

Jangan mengubah jam komputer murid sebagai satu-satunya cara menguji tenggat. Keputusan waktu tetap berasal dari server.

---

## 5. Skenario ujung-ke-ujung utama

### 5.1 Guru membuat kelas dan mengundang murid

1. Login sebagai guru.
2. Buat sekolah jika diperlukan.
3. Buat kelas.
4. Buat undangan yang masih berlaku.
5. Salin tautan undangan.
6. Buka tautan sebagai murid pertama.
7. Selesaikan proses bergabung.
8. Pastikan murid masuk ke kelas yang benar.
9. Cabut undangan.
10. Coba gunakan undangan tersebut dengan murid kedua.
11. Pastikan murid kedua tidak dapat bergabung.
12. Pastikan murid pertama tetap menjadi anggota kelas.

**Lulus jika:**
- Undangan dapat digunakan selama masih berlaku.
- Undangan yang dicabut tidak dapat digunakan.
- Pencabutan tidak menghapus anggota yang sudah bergabung.
- Murid tidak dapat bergabung ke kelas yang salah.

### 5.2 Tugas hanya dapat dikerjakan pada waktu yang diizinkan

1. Buat tugas dengan waktu buka di masa depan.
2. Login sebagai murid.
3. Pastikan editor belum dapat diedit.
4. Pastikan API juga menolak operasi tulis sebelum waktu buka.
5. Ubah tugas uji agar berada dalam jendela pengerjaan.
6. Buka editor.
7. Pastikan `boleh_edit` bernilai `true`.
8. Buat proyek dan simpan.
9. Pastikan snapshot berhasil dibuat.
10. Ubah waktu tugas agar sudah ditutup.
11. Muat ulang status editor.
12. Pastikan `boleh_edit` bernilai `false`.
13. Pastikan proyek tersimpan tetap dapat dibuka.
14. Pastikan murid tidak dapat melakukan perubahan baru melalui API.

**Lulus jika:**
- Editor dapat diedit hanya dalam jendela waktu yang benar.
- API menegakkan aturan waktu, bukan hanya antarmuka.
- Setelah ditutup, editor tetap dapat menampilkan proyek terakhir dalam mode baca-saja.

### 5.3 Editor terkunci ketika tenggat tercapai

Pengujian ini wajib dilakukan karena berhubungan langsung dengan keputusan produk.

1. Buat tugas yang akan ditutup dalam waktu dekat.
2. Login sebagai murid.
3. Buka editor dan mulai mengerjakan.
4. Pastikan autosave berjalan.
5. Biarkan editor tetap terbuka sampai waktu tenggat tercapai.
6. Amati editor ketika waktu server mencapai `ditutup_pada`.
7. Pastikan editor langsung masuk mode baca-saja.
8. Coba menggeser blok.
9. Coba mengubah sprite atau kostum.
10. Coba melakukan simpan manual.
11. Coba mengirim snapshot biasa melalui API.
12. Pastikan perubahan baru tidak diterima.
13. Muat ulang editor.
14. Pastikan proyek terakhir yang berhasil disimpan tetap dapat dibuka.

**Lulus jika:**
- Editor berubah menjadi baca-saja ketika tenggat tercapai.
- Pengguna tidak dapat melakukan perubahan baru.
- API menolak penyimpanan biasa setelah tenggat.
- Proyek yang sudah tersimpan tetap tersedia.

Jangan hanya menguji tombol yang dinonaktifkan. Uji juga endpoint API secara langsung.

### 5.4 Save intent dan penyimpanan terakhir

Pengujian ini memverifikasi bahwa perubahan terakhir yang didaftarkan sebelum tenggat dapat diselesaikan, tetapi perubahan baru setelah tenggat tidak dapat disimpan.

#### Skenario A — Save intent dibuat sebelum tenggat dan upload selesai setelah tenggat

1. Buat tugas yang akan segera ditutup.
2. Login sebagai murid dan buka editor.
3. Buat perubahan proyek.
4. Pastikan editor menghasilkan byte `.sb3`.
5. Sebelum tenggat, kirim request pembuatan save intent.
6. Pastikan server memberikan save intent yang valid.
7. Tahan proses upload sampai waktu server melewati tenggat.
8. Kirim upload dengan save intent tersebut.
9. Pastikan hash dan ukuran file cocok dengan intent.
10. Pastikan server menerima upload selama intent masih berlaku.
11. Pastikan snapshot tersimpan.
12. Pastikan response menandai operasi sebagai penyimpanan akhir.
13. Pastikan proyek dapat diunduh kembali dengan hash yang sama.

**Lulus jika:** upload yang telah didaftarkan secara sah sebelum tenggat dapat diselesaikan dalam masa toleransi server.

#### Skenario B — Mencoba membuat save intent setelah tenggat

1. Tutup tugas.
2. Coba membuat save intent baru.
3. Pastikan server menolak request.
4. Pastikan tidak ada token baru yang diterbitkan.

**Lulus jika:** save intent tidak dapat dibuat setelah tenggat.

#### Skenario C — Hash berbeda dari intent

1. Buat save intent untuk file A sebelum tenggat.
2. Siapkan file B dengan isi berbeda.
3. Coba mengunggah file B menggunakan intent file A.
4. Pastikan server menolak upload.
5. Pastikan tidak ada snapshot yang dibuat dari file B melalui intent tersebut.

**Lulus jika:** hash yang tidak cocok selalu ditolak.

#### Skenario D — Intent digunakan dua kali

1. Buat save intent yang valid.
2. Gunakan intent untuk mengunggah file.
3. Pastikan upload pertama berhasil.
4. Kirim ulang request menggunakan intent yang sama.
5. Pastikan server menolak penggunaan kedua atau mengembalikan hasil idempoten tanpa membuat snapshot tambahan.

**Lulus jika:** satu intent tidak dapat membuat dua penyimpanan baru.

#### Skenario E — Intent kedaluwarsa

1. Buat save intent sebelum tenggat.
2. Biarkan masa toleransi berakhir.
3. Coba mengunggah file menggunakan intent tersebut.
4. Pastikan server menolak upload.
5. Pastikan tidak ada snapshot baru.

**Lulus jika:** intent yang kedaluwarsa tidak dapat digunakan.

#### Skenario F — Save intent gagal dibuat

1. Buat tugas yang segera ditutup.
2. Simulasikan kegagalan jaringan ketika editor meminta save intent.
3. Pastikan editor tidak menganggap penyimpanan akhir berhasil.
4. Ketika tenggat tercapai, pastikan editor menjadi baca-saja.
5. Pastikan editor tidak mencoba membuat intent baru setelah tenggat.
6. Pastikan status penyimpanan menunjukkan bahwa penyimpanan akhir belum berhasil.

**Lulus jika:** kegagalan save intent tidak menyebabkan editor mengirim perubahan baru setelah tenggat atau menampilkan status berhasil yang keliru.

### 5.5 Pengumpulan tepat waktu dan terlambat

#### Skenario A — Pengumpulan tepat waktu

1. Buka tugas yang masih aktif.
2. Buat proyek.
3. Simpan snapshot.
4. Tekan Kumpulkan.
5. Pastikan submission dibuat.
6. Pastikan `terlambat` bernilai `false`.
7. Login sebagai guru.
8. Pastikan submission muncul.

#### Skenario B — Pengumpulan terlambat dengan izin terlambat

1. Buat tugas dengan `izinkan_terlambat = true`.
2. Tutup tugas.
3. Login sebagai murid.
4. Buka proyek terakhir.
5. Pastikan editor baca-saja.
6. Tekan Kumpulkan.
7. Pastikan submission tetap dibuat.
8. Pastikan `terlambat` bernilai `true`.
9. Pastikan `perlu_tinjauan` bernilai `false`.

#### Skenario C — Pengumpulan terlambat tanpa izin terlambat

1. Buat tugas dengan `izinkan_terlambat = false`.
2. Tutup tugas.
3. Login sebagai murid.
4. Kumpulkan proyek yang sudah tersimpan.
5. Pastikan submission tetap dibuat.
6. Pastikan `terlambat` bernilai `true`.
7. Pastikan `perlu_tinjauan` bernilai `true`.
8. Login sebagai guru.
9. Pastikan penanda tinjauan terlihat.

**Lulus jika:** pengumpulan setelah tenggat tetap tersimpan pada kedua konfigurasi. Perbedaannya hanya pada kebutuhan tinjauan guru.

### 5.6 Simpan, pengumpulan berulang, dan riwayat

1. Buka tugas yang sedang aktif.
2. Buat proyek `.sb3` pertama.
3. Simpan.
4. Pastikan status penyimpanan berhasil.
5. Ubah proyek.
6. Simpan kembali.
7. Pastikan snapshot baru tercatat.
8. Kumpulkan proyek.
9. Ubah proyek lagi.
10. Simpan snapshot baru.
11. Kumpulkan kembali.
12. Login sebagai guru.
13. Buka daftar pengumpulan.
14. Pastikan pengumpulan terakhir terlihat.
15. Buka riwayat.
16. Pastikan pengumpulan sebelumnya tetap tersedia.
17. Unduh setiap versi.
18. Pastikan setiap versi dapat dibuka di editor lokal.

**Lulus jika:**
- Pengumpulan kedua tidak menimpa pengumpulan pertama.
- Riwayat dapat dibedakan berdasarkan waktu dan urutan.
- File setiap versi tetap dapat diunduh.

### 5.7 Deduplikasi dan retensi snapshot

1. Simpan proyek.
2. Simpan lagi tanpa mengubah isi proyek.
3. Pastikan tidak ada snapshot duplikat.
4. Ubah proyek.
5. Simpan kembali.
6. Pastikan snapshot baru dibuat.
7. Buat snapshot lebih banyak daripada batas retensi.
8. Jalankan proses retensi.
9. Pastikan jumlah snapshot biasa mengikuti batas yang ditentukan.
10. Pastikan snapshot yang dirujuk submission tetap tersedia.
11. Unduh submission lama.
12. Pastikan file submission tetap utuh.

**Lulus jika:**
- Isi yang sama tidak membuat snapshot baru.
- Isi berbeda membuat snapshot baru.
- Retensi tidak menghapus file yang masih dibutuhkan submission.

### 5.8 Komentar

1. Login sebagai guru.
2. Tambahkan komentar pada submission.
3. Login sebagai murid pemilik submission.
4. Pastikan komentar terlihat.
5. Tambahkan komentar sebagai murid.
6. Login kembali sebagai guru.
7. Pastikan komentar murid terlihat.
8. Coba membaca komentar dari akun murid lain.
9. Pastikan akses ditolak.
10. Coba komentar kosong.
11. Coba komentar melebihi batas panjang.

**Lulus jika:** komentar hanya dapat dilihat oleh pihak yang berhak dan validasi isi bekerja.

---

## 6. Pemeriksaan hak akses dan privasi

Gunakan akun terpisah untuk menguji akses.

- [ ] Murid kelas A tidak dapat membaca daftar kelas kelas B.
- [ ] Murid tidak dapat membaca tugas kelas lain.
- [ ] Murid A tidak dapat membaca proyek murid B.
- [ ] Murid tidak dapat membaca submission murid lain.
- [ ] Murid tidak dapat membaca snapshot murid lain.
- [ ] Murid tidak dapat mengubah atau menghapus submission milik murid lain.
- [ ] Murid tidak dapat menggunakan save intent milik murid lain.
- [ ] Murid tidak dapat menggunakan save intent untuk tugas lain.
- [ ] Guru hanya dapat mengakses kelas dan data dalam cakupan kepemilikannya.
- [ ] Request tanpa sesi ditolak.
- [ ] Request dengan sesi kedaluwarsa ditolak.
- [ ] File tidak dapat diakses dengan menebak `object_key`.
- [ ] URL unduhan bertanda tangan, jika digunakan, memiliki masa berlaku sesuai aturan.
- [ ] Response API tidak membocorkan `object_key`.
- [ ] Log tidak membocorkan kata sandi, token sesi, atau token save intent.
- [ ] Tombol yang disembunyikan di antarmuka tidak menggantikan pemeriksaan izin server.

Setiap kegagalan akses lintas pengguna harus dianggap sebagai masalah berprioritas tinggi.

---

## 7. Uji kegagalan dan pemulihan

### 7.1 Jaringan

- Putuskan jaringan ketika autosave berlangsung.
- Pastikan editor menunjukkan bahwa penyimpanan belum berhasil.
- Pulihkan jaringan.
- Pastikan editor mencoba kembali dengan aman atau memberi petunjuk pemulihan.
- Pastikan retry tidak membuat snapshot duplikat.
- Putuskan jaringan ketika upload berlangsung.
- Pastikan editor tidak menyatakan upload berhasil sebelum menerima konfirmasi server.
- Pastikan kegagalan upload tidak menghapus snapshot sebelumnya.

### 7.2 Save intent

- Putuskan jaringan ketika membuat save intent.
- Putuskan jaringan setelah intent dibuat tetapi sebelum upload.
- Putuskan jaringan ketika upload sedang berlangsung.
- Kirim ulang request dengan token yang sama.
- Pastikan penggunaan token mengikuti aturan satu kali.
- Pastikan token yang kedaluwarsa ditolak.
- Pastikan server tidak menerima upload baru tanpa intent setelah tenggat.

### 7.3 `sendBeacon`

- Tutup tab ketika ada perubahan yang belum tersimpan.
- Pastikan editor mengirim beacon sesuai mekanisme yang dirancang.
- Pastikan server memeriksa autentikasi dan kepemilikan.
- Pastikan beacon tidak melewati aturan tenggat.
- Pastikan editor tidak menganggap `sendBeacon()` bernilai `true` sebagai bukti file sudah tersimpan.
- Buka kembali editor dan periksa snapshot terakhir yang benar-benar tersimpan.

### 7.4 Object storage

- Simulasikan object storage tidak tersedia.
- Pastikan aplikasi tidak menyatakan file berhasil tersimpan.
- Simulasikan kegagalan ketika mengunduh.
- Pastikan pengguna menerima pesan yang dapat dipahami.
- Pastikan kegagalan tidak menghapus file yang sudah tersimpan sebelumnya.

### 7.5 Sesi dan undangan

- Buka tautan tugas tanpa login.
- Gunakan sesi yang kedaluwarsa.
- Gunakan undangan yang kedaluwarsa.
- Gunakan undangan yang dicabut.
- Pastikan pesan menjelaskan langkah berikutnya tanpa menampilkan rincian teknis internal.

### 7.6 Data dan upload

- Kirim request tanpa body.
- Coba mengunggah file dengan ukuran melebihi batas.
- Coba mengirim ukuran file yang tidak sesuai dengan save intent.
- Coba mengirim hash yang tidak sesuai.
- Pastikan kegagalan validasi tidak menghapus snapshot sebelumnya.
- Pastikan nama file dari klien tidak digunakan untuk membentuk object key yang tidak aman.

Jangan mengharuskan server mengurai ZIP atau membaca `project.json` untuk menentukan validitas file.

---

## 8. Tampilan dan kegunaan

Periksa secara manual pada browser dan ukuran layar yang digunakan di sekolah.

- Teks status mudah dipahami murid SD.
- Tombol Simpan dan Kumpulkan dapat dibedakan.
- Status penyimpanan terlihat jelas.
- Murid dapat mengetahui apakah perubahan sudah tersimpan.
- Editor menampilkan status baca-saja ketika tugas ditutup.
- Murid tidak dapat mengedit setelah tenggat.
- Murid tetap dapat melihat proyek setelah tenggat.
- Tombol Kumpulkan tetap tersedia setelah tenggat.
- Status terlambat dapat dikenali.
- Guru dapat melihat murid yang belum mengumpulkan.
- Riwayat tersusun berdasarkan waktu.
- Versi yang sedang dipilih terlihat jelas.
- Guru dapat mengunduh versi yang dipilih.
- Waktu ditampilkan konsisten dalam zona waktu setempat.
- Tampilan memuat, kosong, dan gagal memiliki pesan yang sesuai.
- Antarmuka dapat digunakan dengan papan ketik.
- Fokus elemen terlihat jelas.

Pengujian tampilan tidak menggantikan pengujian izin di server.

---

## 9. Pengujian otomatis

Gunakan Vitest untuk unit test dan Playwright untuk pengujian alur browser.

### 9.1 Unit test

Minimal mencakup:

- [ ] Tugas belum dibuka.
- [ ] Tugas sedang dibuka.
- [ ] Tugas tepat mencapai tenggat.
- [ ] Tugas sudah ditutup.
- [ ] Pengumpulan tepat waktu.
- [ ] Pengumpulan terlambat dengan izin terlambat.
- [ ] Pengumpulan terlambat tanpa izin terlambat.
- [ ] Deduplikasi berdasarkan hash.
- [ ] Hash save intent cocok.
- [ ] Hash save intent tidak cocok.
- [ ] Ukuran file save intent cocok.
- [ ] Ukuran file save intent tidak cocok.
- [ ] Save intent kedaluwarsa.
- [ ] Save intent sudah digunakan.
- [ ] Save intent milik pengguna lain.
- [ ] Batas retensi snapshot.
- [ ] Snapshot yang dirujuk submission dilindungi dari penghapusan.

### 9.2 Integration test

Minimal mencakup:

- [ ] Login dan autentikasi API.
- [ ] Pembuatan kelas dan tugas.
- [ ] Keanggotaan murid.
- [ ] Pembacaan proyek.
- [ ] Pembuatan snapshot.
- [ ] Deduplikasi snapshot.
- [ ] Pembuatan save intent.
- [ ] Penyelesaian upload setelah tenggat dengan intent valid.
- [ ] Penolakan upload setelah tenggat tanpa intent.
- [ ] Penolakan hash yang tidak cocok.
- [ ] Penolakan penggunaan intent kedua kali.
- [ ] Pengumpulan tepat waktu.
- [ ] Pengumpulan terlambat.
- [ ] Pengumpulan berulang.
- [ ] Unduhan file.
- [ ] Pemeriksaan kepemilikan lintas murid dan kelas.

### 9.3 End-to-end test

Minimal mencakup:

- [ ] Guru membuat kelas.
- [ ] Murid bergabung melalui undangan.
- [ ] Guru membuat tugas.
- [ ] Murid membuka editor.
- [ ] Murid mengerjakan proyek.
- [ ] Autosave berjalan.
- [ ] Simpan manual berjalan.
- [ ] Editor terkunci saat tenggat.
- [ ] Save intent yang sah dapat menyelesaikan upload akhir.
- [ ] Perubahan baru setelah tenggat ditolak.
- [ ] Murid tetap dapat melihat proyek.
- [ ] Murid dapat mengumpulkan setelah tenggat.
- [ ] Guru melihat submission dan riwayat.
- [ ] Guru mengunduh file.

Jangan hanya mengandalkan mock untuk menguji integritas file. Lakukan uji integrasi dengan object storage pengujian dan uji kompatibilitas Scratch secara manual.

---

## 10. Pemeriksaan sebelum rilis

Jalankan pemeriksaan berikut pada versi yang akan dipakai murid.

### Kompatibilitas dan penyimpanan

- [ ] Gerbang 0 lulus: `.sb3` editor lokal dapat diunggah ke Scratch dan proyek tetap berjalan.
- [ ] Gerbang 1 lulus: file yang disimpan dapat diunduh kembali dengan hash identik.
- [ ] File tidak diurai atau diubah oleh server.
- [ ] Batas ukuran file bekerja.
- [ ] Kegagalan upload tidak menghapus versi sebelumnya.

### Akun, kelas, dan tugas

- [ ] Guru dapat login.
- [ ] Guru dapat membuat sekolah dan kelas.
- [ ] Guru dapat membuat dan mencabut undangan.
- [ ] Murid dapat bergabung melalui undangan valid.
- [ ] Undangan yang dicabut atau kedaluwarsa tidak dapat digunakan.
- [ ] Guru dapat membuat dan mengubah tugas.

### Editor dan waktu

- [ ] Murid dapat membuka editor ketika tugas aktif.
- [ ] Editor tidak dapat diedit sebelum waktu buka.
- [ ] Editor menjadi baca-saja tepat ketika tenggat tercapai.
- [ ] Proyek tetap dapat dibaca setelah tenggat.
- [ ] Simpan biasa ditolak setelah tenggat.
- [ ] Save intent hanya dapat dibuat sebelum tenggat.
- [ ] Save intent yang sah dapat menyelesaikan upload akhir dalam masa toleransi.
- [ ] Save intent dengan hash atau ukuran yang tidak cocok ditolak.
- [ ] Save intent yang kedaluwarsa atau sudah digunakan ditolak.
- [ ] Tidak ada perubahan baru yang diterima setelah tenggat.

### Pengumpulan dan riwayat

- [ ] Autosave dan simpan manual bekerja.
- [ ] Autosave tidak membuat submission.
- [ ] Pengumpulan tepat waktu ditandai benar.
- [ ] Pengumpulan terlambat tetap tersimpan.
- [ ] Pengumpulan terlambat ditandai benar.
- [ ] Pengumpulan berulang mempertahankan versi sebelumnya.
- [ ] Guru dapat melihat semua murid, termasuk yang belum mengumpulkan.
- [ ] Guru dapat melihat riwayat dan mengunduh versi.
- [ ] Retensi tidak menghapus file yang masih dibutuhkan submission.

### Keamanan dan pemulihan

- [ ] Pemeriksaan hak akses lintas murid lulus.
- [ ] Pemeriksaan hak akses lintas kelas lulus.
- [ ] `object_key` tidak muncul di browser.
- [ ] Komentar hanya terlihat oleh pihak yang berhak.
- [ ] Pemulihan dari jaringan gagal sudah diuji.
- [ ] Pemulihan dari object storage gagal sudah diuji.
- [ ] Cadangan dan pemulihan data mengikuti prosedur deployment.
- [ ] Tidak ada masalah kritis atau berisiko kehilangan pekerjaan yang belum diselesaikan.

---

## 11. Batas fitur pengujian v1

Pengujian v1 hanya mencakup fitur yang memang disepakati untuk rilis awal.

Termasuk:
- Login guru dan murid.
- Sekolah, kelas, dan keanggotaan.
- Undangan kelas.
- Tugas dan jendela waktu.
- Editor Scratch terpisah.
- Autosave dan simpan manual.
- Save intent untuk penyimpanan terakhir.
- Editor baca-saja setelah tenggat.
- Pengumpulan berulang.
- Penanda terlambat.
- Riwayat snapshot dan submission.
- Unduhan file.
- Komentar.
- Pemeriksaan kepemilikan dan keamanan.

Tidak termasuk:
- Penilaian angka otomatis.
- Notifikasi kompleks.
- Mode offline penuh.
- Multi-guru.
- Integrasi LMS.
- Pemutar atau pratinjau proyek interaktif untuk guru.
- Pembuatan mesin Scratch sendiri.

Untuk v1, guru melihat riwayat dan mengunduh file `.sb3`. Pratinjau interaktif ditunda sampai ada kebutuhan dan rancangan tersendiri.

---

## 12. Pelaporan masalah

Untuk setiap masalah, catat:

- Judul masalah.
- Langkah untuk mengulanginya.
- Perilaku yang diharapkan.
- Perilaku yang terjadi.
- Apakah file atau data hilang, berubah, atau dapat dilihat pengguna yang salah.
- Browser dan lingkungan pengujian.
- Waktu kejadian jika berkaitan dengan tenggat.
- ID tugas dan akun uji yang digunakan.
- Tingkat dampak.

Prioritaskan masalah dengan urutan berikut:

1. Kehilangan atau kerusakan pekerjaan murid.
2. Akses data oleh pengguna yang tidak berhak.
3. Editor tidak terkunci pada waktu yang benar.
4. Penyimpanan akhir tidak bekerja sesuai aturan.
5. Pengumpulan atau penanda terlambat tidak bekerja.
6. Fungsi utama yang gagal.
7. Tampilan atau kenyamanan yang tidak menghalangi pengerjaan.

Jangan merilis aplikasi jika masih ada masalah kritis yang dapat menghilangkan pekerjaan murid atau membocorkan data.

---

## 13. Aturan akhir

Pengujian dianggap selesai hanya jika:

- File `.sb3` tetap byte-identik.
- Editor langsung menjadi baca-saja ketika tenggat tercapai.
- Save intent hanya dapat dibuat sebelum tenggat.
- Upload akhir hanya diterima jika intent valid.
- Intent tidak dapat dipakai ulang atau digunakan untuk file berbeda.
- Murid tetap dapat melihat proyek setelah tenggat.
- Murid tetap dapat mengumpulkan setelah tenggat.
- Pengumpulan terlambat disimpan dan ditandai.
- Riwayat submission tidak tertimpa.
- Guru hanya dapat mengakses data kelas miliknya.
- Murid hanya dapat mengakses data miliknya.
- Semua pengujian kritis telah lulus.

Jika aturan produk berubah, perbarui `TESTING.md`, `REQUIREMENTS.md`, dan `API-CONTRACTS.md` secara bersamaan agar tidak terjadi perbedaan perilaku antara implementasi dan dokumentasi.