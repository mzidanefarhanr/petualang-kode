# KONTEKS.md — Ringkasan Proyek Scratch Kelas

> Dokumen ini adalah ringkasan satu halaman untuk memberi konteks cepat kepada siapa pun (termasuk agen AI) yang baru masuk ke proyek ini. Untuk detail mengikat, lihat dokumen acuan di bagian akhir.

---

## Apa yang dibangun

Platform belajar Scratch untuk satu guru yang mengajar di beberapa sekolah. Guru membuat kelas, membagikan tautan undangan berbatas waktu, memberi tugas dengan jendela buka–tutup, dan meninjau hasil kerja murid. Murid bergabung lewat undangan, mengerjakan proyek di editor berbasis `scratch-gui`, mengumpulkan berkas `.sb3`, lalu mengunggahnya sendiri ke akun Scratch mereka.

Diferensiasi utama: **riwayat pengerjaan**. Setiap simpan otomatis dan simpan manual menghasilkan snapshot, sehingga guru bisa melihat proses, bukan hanya hasil akhir. Ini yang menjawab pertanyaan "siapa benar-benar mengerjakan".

---

## Siapa yang mengerjakan

Satu guru, bekerja sendirian. Tidak ada tim, tidak ada peninjau kode, tidak ada yang menggantikan saat libur. Konsekuensinya: perubahan kecil dan jelas lebih berharga daripada perubahan besar dan pintar.

---

## Pengguna dan peran

| Peran | Siapa | Yang bisa dilakukan |
|---|---|---|
| Guru | Anda. Satu akun, banyak sekolah. | Membuat kelas, undangan, tugas; melihat semua pengumpulan dan riwayat; memberi komentar. |
| Murid | Anak-anak SD di sekolah Anda. | Bergabung lewat undangan, mengerjakan tugas di dalam jendela waktunya, mengumpulkan berkali-kali, melihat komentar, mengunduh `.sb3`. |

Tidak ada admin, wali murid, atau kepala sekolah di v1.

---

## Stack

| Bagian | Pilihan |
|---|---|
| Aplikasi kelas | Next.js (App Router), TypeScript |
| Editor | `scratch-gui` yang dimodifikasi, aplikasi terpisah di subdomain |
| Database | PostgreSQL 15+ |
| Penyimpanan berkas | objek S3-kompatibel, `.sb3` apa adanya |
| Gaya | Tailwind CSS |
| Uji | Vitest (unit), Playwright (alur) |

**Sengaja tidak dipakai:** Rust, offline-first/service worker, GraphQL, ORM yang mengklaim skema sendiri sebagai sumber kebenaran, tabel sesi, mesin Scratch tulisan sendiri.

---

## Alur inti

1. Guru membuat kelas dan tautan undangan (berlaku terbatas, bisa dicabut).
2. Murid membuka tautan, mengisi nama/email opsional/kata sandi, masuk ke kelas.
3. Guru membuat tugas dengan jendela `dibuka_pada`–`ditutup_pada`.
4. Murid membuka editor hanya di dalam jendela waktu, mengerjakan proyek.
5. Simpan otomatis (debounce 30 detik, paksa tiap 5 menit, `sendBeacon` saat tutup tab) dan simpan manual membuat **snapshot** (deduplikasi berdasarkan hash isi).
6. Murid menekan **Kumpulkan** → baris **submission** baru, menyalin referensi objek dari snapshot terakhir. Boleh berkali-kali.
7. Guru melihat daftar nilai (semua murid, termasuk yang belum mengumpulkan), membuka riwayat snapshot per murid, mengunduh `.sb3` pada titik waktu mana pun, dan memberi komentar.
8. Murid mengunduh `.sb3` terakhirnya untuk diunggah ke akun Scratch sendiri.

---

## Model data ringkas
teachers ─┬─< schools
└─< classes ─┬─< class_members >─ students
├─< invites
└─< assignments ─┬─< submissions ─< comments
└─< snapshots


- `snapshots` = rekaman otomatis, boleh dihapus retensi (20 terakhir per tugas–murid, kecuali yang pernah dikumpulkan).
- `submissions` = tindakan sadar murid, menyalin `object_key`/`isi_hash`/`ukuran_bytes` dari snapshot. Tidak ada FK ke `snapshots`.
- `terlambat` disimpan saat kejadian, tidak dihitung ulang saat dibaca.
- `object_key` tidak pernah sampai ke klien; berkas disajikan lewat endpoint yang memeriksa izin.

Detail lengkap di `DATABASE.md`.

---

## Batas keras (tidak bisa dinegosiasikan)

1. **Jangan pernah menyentuh isi `.sb3`.** Simpan apa adanya, kirim apa adanya. Jangan urai lalu susun ulang, jangan sunting `project.json`. Arsip yang diubah bisa ditolak akun Scratch murid — dan mengunggah ke akun Scratch mereka adalah tujuan utama proyek.
2. **Isi `.sb3` tidak pernah masuk database.** Hanya `object_key` dan `isi_hash`.
3. **Waktu selalu dari server** (`now()`), tidak pernah dari klien untuk keputusan apa pun.
4. **`object_key` tidak pernah sampai ke klien.**
5. **Jangan memercayai `class_id`/`assignment_id`/`submission_id` dari klien.** Selalu telusuri rantai kepemilikan sampai `teachers.id`.
6. **Selalu simpan pengumpulan**, tandai `terlambat`, biarkan guru memutuskan. Jangan menolak simpan diam-diam.
7. **`terlambat` disimpan saat kejadian**, tidak dihitung ulang.
8. **Berkas migrasi tidak pernah diubah setelah dijalankan.**
9. **Jangan membuat tabel sesi.** Sesi di cookie bertanda tangan atau library auth.
10. **Jangan menulis mesin Scratch sendiri.** `scratch-vm` sudah benar.
11. **Jangan membaca isi `.sb3` saat menampilkan halaman.** Metadata seperti `jumlah_balok` diisi sekali saat snapshot dibuat.

---

## Yang sengaja tidak ada di v1

Mode offline, VM Scratch sendiri, Rust, mengubah `project.json`, ponsel, pratinjau langsung proyek di halaman guru, nilai/angka/rapor, notifikasi email, banyak guru per kelas, bahasa selain Indonesia, distribusi proyek antar murid, integrasi LMS.

Masing-masing punya alasan dan tanggal tinjau ulang di `REQUIREMENTS.md` bagian 4.

---

## Kriteria selesai v1

v1 selesai bila **semua** ini benar:

1. Guru membuat kelas, undangan, dan mengirim satu tautannya ke satu murid.
2. Murid bergabung, membuka editor, membuat proyek, dan menekan simpan.
3. Guru melihat pengumpulannya dan mengunduh `.sb3`-nya.
4. **`.sb3` itu diunggah ke akun Scratch sungguhan dan proyeknya berjalan utuh.** Ini uji penentu.
5. Murid mengumpulkan ulang versi kedua, guru melihat dua baris di riwayat.
6. Guru menggeser `ditutup_pada` ke masa depan, murid bisa mengerjakan lagi.
7. Guru menutup undangan, murid baru tidak bisa bergabung, tetapi murid lama tetap bisa masuk.

---

## Dokumen acuan

| Dokumen | Isi |
|---|---|
| `AGENTS.md` | Kontrak kerja agen: perintah, konvensi, batas keras, alur kerja |
| `ARCHITECTURE.md` | Pembagian aplikasi dan batas komunikasi |
| `DATABASE.md` | Skema database — sumber kebenaran SQL |
| `API-CONTRACTS.md` | Rute, muatan, kode status, urutan pemeriksaan izin |
| `DESIGN.md` | Layar, tata letak, aturan keadaan |
| `REQUIREMENTS.md` | Apa yang v1 lakukan dan tidak, beserta alasannya |
| `DECISIONS.md` | Keputusan yang sudah dikunci |
| `TESTING.md` | Rencana pengujian dan gerbang kompatibilitas |

Kalau kode dan dokumen berbeda, **dokumen yang benar** — kecuali dokumen itu jelas sudah usang. Dalam hal itu, hentikan dan tanyakan.

---

## Urutan pengerjaan yang disarankan

1. **Gerbang 0 `TESTING.md`**: buktikan `.sb3` dari editor lokal bisa diunggah ke Scratch dan berjalan. Jangan menulis fitur kelas sebelum ini lulus.
2. **Middleware rantai izin** + bentuk galat seragam.
3. **`GET /editor/session`** — uji jendela waktu di sini.
4. **Simpan/muat snapshot** — inti editor.
5. **Tombol Kumpulkan** — submission.
6. **Endpoint guru** — kelas, tugas, daftar nilai, riwayat.
7. **Autosave klien** + `sendBeacon`.
8. **Retensi** dan pembersihan berkala.

Langkah 1–4 sudah membuat sistem yang bisa dipakai mengajar. Sisanya menambah kenyamanan.