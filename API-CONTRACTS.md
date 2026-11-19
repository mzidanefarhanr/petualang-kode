# API-CONTRACTS.md
# Spesifikasi API — Aplikasi Kelas dan Editor Scratch

Versi 1. Dokumen ini menjadi acuan implementasi API untuk aplikasi kelas dan editor Scratch.

Semua endpoint berada di bawah `/api/v1`.

Dokumen ini menetapkan:
- Struktur endpoint.
- Format request dan response.
- Autentikasi dan pemeriksaan izin.
- Aturan penyimpanan snapshot dan pengumpulan.
- Perilaku editor ketika tugas dibuka dan ditutup.
- Penyimpanan terakhir ketika tenggat tercapai.
- Penanganan file `.sb3`.
- Kriteria pengujian API.

---

## 1. Arsitektur layanan

Aplikasi terdiri dari dua aplikasi yang berada di bawah domain induk yang sama.

| Layanan | Contoh host | Tanggung jawab |
|---|---|---|
| Aplikasi kelas | `app.domainanda.com` | Login, kelas, undangan, tugas, pengumpulan, riwayat, komentar |
| Editor Scratch | `editor.domainanda.com` | Scratch GUI, membuka proyek, mengedit, autosave, mengumpulkan |
| Object storage | Internal | Menyimpan file `.sb3` |
| Database | PostgreSQL | Menyimpan data pengguna, kelas, tugas, snapshot, dan pengumpulan |

Editor menggunakan `scratch-gui` dan `scratch-vm` yang dimodifikasi seperlunya untuk integrasi dengan aplikasi.

Editor berkomunikasi dengan aplikasi kelas melalui API. Editor tidak boleh:
- Mengakses database secara langsung.
- Mengakses object storage secara langsung.
- Mengimpor kode internal aplikasi kelas.
- Mengambil keputusan izin berdasarkan jam perangkat murid.

Aplikasi kelas dan editor menggunakan sesi autentikasi yang sama.

### 1.1 Prinsip utama

1. File `.sb3` disimpan sebagai byte asli.
2. Server tidak membuka, mengurai, atau menyusun ulang isi `.sb3`.
3. Semua keputusan waktu dilakukan oleh server berdasarkan waktu database.
4. `object_key` hanya boleh digunakan di sisi server.
5. Semua akses data harus melalui pemeriksaan kepemilikan.
6. Autosave menghasilkan snapshot, bukan pengumpulan.
7. Tombol Kumpulkan menghasilkan catatan submission.
8. Murid boleh mengumpulkan lebih dari satu kali.
9. Setelah tenggat, editor langsung menjadi baca-saja.
10. Perubahan terakhir yang sudah didaftarkan sebelum tenggat tetap boleh diselesaikan proses unggahnya dalam masa toleransi yang ditentukan server.

---

## 2. Konvensi umum

### 2.1 Autentikasi

Kedua aplikasi menggunakan cookie sesi yang sama.

Contoh:

```http
Set-Cookie: sesi=<token>; HttpOnly; Secure; SameSite=Lax; Domain=.domainanda.com; Path=/
```

Ketentuan:
- `HttpOnly`: JavaScript tidak dapat membaca cookie.
- `Secure`: cookie hanya dikirim melalui HTTPS.
- `SameSite=Lax`: digunakan karena kedua aplikasi berada dalam satu domain induk.
- `Domain=.domainanda.com`: cookie dapat digunakan oleh subdomain aplikasi dan editor.
- Sesi disimpan dan dapat dicabut oleh server.
- Tidak perlu membuat tabel sesi khusus jika mekanisme autentikasi yang dipakai sudah menyediakan penyimpanan sesi.

Setiap request dari editor harus menyertakan kredensial:

```js
fetch(url, {
  credentials: "include"
});
```

### 2.2 CORS

Karena aplikasi kelas dan editor menggunakan origin berbeda, API harus mengatur CORS secara eksplisit.

Contoh:

```http
Access-Control-Allow-Origin: https://editor.domainanda.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Idempotency-Key, X-CSRF-Token
Access-Control-Max-Age: 86400
Vary: Origin
```

Ketentuan:
- Jangan menggunakan `Access-Control-Allow-Origin: *` bersama kredensial.
- Hanya izinkan origin aplikasi yang telah ditentukan.
- Tangani request `OPTIONS` secara terpusat.
- Terapkan perlindungan CSRF untuk endpoint yang mengubah data.
- Jangan menganggap CORS sebagai pengganti autentikasi atau pemeriksaan izin.

### 2.3 Format response error

Semua endpoint menggunakan format error yang sama.

```json
{
  "error": {
    "kode": "TUGAS_DITUTUP",
    "pesan": "Tugas sudah ditutup.",
    "detail": {
      "ditutup_pada": "2026-11-18T09:00:00Z"
    }
  }
}
```

`kode` digunakan oleh aplikasi untuk menentukan perilaku.

`pesan` dapat ditampilkan kepada pengguna.

Jangan menampilkan kode internal sebagai pesan utama kepada murid.

### 2.4 HTTP status

| Status | Arti |
|---|---|
| 200 | Berhasil |
| 201 | Berhasil membuat data |
| 204 | Berhasil tanpa response body |
| 400 | Request tidak valid |
| 401 | Belum login atau sesi kedaluwarsa |
| 403 | Login valid tetapi tindakan tidak diizinkan |
| 404 | Data tidak ditemukan atau bukan milik pengguna |
| 409 | Konflik data atau operasi sudah dilakukan |
| 410 | Undangan atau token sudah kedaluwarsa/dicabut |
| 413 | File melebihi batas ukuran |
| 422 | Data request tidak dapat diproses |
| 429 | Terlalu banyak request |
| 500 | Kesalahan internal server |

Untuk mencegah kebocoran informasi, gunakan `404` jika sumber daya ada tetapi bukan milik pemanggil.

### 2.5 Aturan waktu

Semua keputusan waktu harus dilakukan di server menggunakan waktu database.

Ketentuan:
- Gunakan `timestamptz` di PostgreSQL.
- Gunakan `now()` atau waktu database yang setara.
- Timestamp dari browser tidak boleh menjadi dasar keputusan.
- Semua waktu dalam response API menggunakan ISO 8601 dengan zona waktu.

Contoh:

```text
2026-11-18T09:00:00Z
```

Batas waktu tugas:
- Sebelum `dibuka_pada`: murid belum boleh mengedit atau mengumpulkan.
- Mulai `dibuka_pada`: murid boleh mengedit.
- Ketika waktu mencapai `ditutup_pada`: editor menjadi baca-saja.
- Setelah ditutup: murid tetap boleh melihat dan mengunduh proyek tersimpan.
- Setelah ditutup: murid tetap boleh mengumpulkan pekerjaan yang sudah tersimpan, sesuai aturan pengumpulan terlambat.

Gunakan aturan batas yang konsisten:
- Tugas dianggap terbuka jika `now() >= dibuka_pada`.
- Editor dianggap ditutup jika `now() >= ditutup_pada`.

### 2.6 Format dan ukuran file

File proyek menggunakan format `.sb3`.

Ketentuan:
- Upload menggunakan byte biner mentah (`application/octet-stream`) atau `multipart/form-data`.
- Jangan mengirim file `.sb3` sebagai base64 dalam JSON.
- Batas ukuran awal: 50 MB.
- Server menyimpan byte file apa adanya.
- Server tidak membuka ZIP, membaca `project.json`, mengekstrak aset, atau menyusun ulang arsip.
- Server tidak mengubah isi file untuk menambahkan metadata.

Server boleh menghitung:
- SHA-256.
- Ukuran byte.
- Waktu penerimaan.
- Identitas pemilik dan tugas.

Server tidak boleh menyimpulkan bahwa isi proyek valid hanya dari nama file atau MIME type.

Validitas dan kompatibilitas proyek Scratch diuji melalui pengujian integrasi: file yang disimpan harus dapat diunduh kembali dan dibuka atau diunggah ke Scratch.

---

## 3. Penyimpanan object storage

### 3.1 Struktur object key

Contoh struktur:

```text
submissions/{assignment_id}/{student_id}/{submission_id}.sb3

snapshots/{assignment_id}/{student_id}/{snapshot_id}.sb3
```

Ketentuan:
- Setiap objek memiliki key sendiri.
- Objek yang sudah dibuat tidak ditimpa.
- Jangan menggunakan nama file dari murid sebagai object key.
- Simpan `object_key` hanya di database.
- Jangan mengirim `object_key` ke browser.
- Jangan membuat URL publik permanen.

### 3.2 Akses file

File hanya dapat diakses melalui endpoint yang melakukan pemeriksaan izin.

Jika menggunakan signed URL:
- URL dibuat setelah pemeriksaan izin berhasil.
- Masa berlaku maksimal 5 menit.
- URL tidak disimpan sebagai data permanen.
- URL tidak menggantikan pemeriksaan izin pada saat URL dibuat.

### 3.3 Hash

Setiap file yang diterima dihitung SHA-256-nya.

Hash digunakan untuk:
- Mendeteksi isi file yang sama.
- Menghindari snapshot duplikat.
- Memeriksa integritas file.
- Menguji bahwa file yang diunduh sama dengan file yang diunggah.

Hash bukan pengganti pemeriksaan kepemilikan.

---

## 4. Endpoint editor

Semua endpoint pada bagian ini memerlukan sesi murid yang valid.

### 4.1 `GET /api/v1/editor/session`

Dipanggil ketika editor pertama kali dibuka.

Query:

```text
?assignment_id=<uuid>
```

Tujuan:
- Memeriksa apakah murid berhak mengakses tugas.
- Menentukan apakah editor boleh diedit.
- Menentukan apakah tugas sudah ditutup.
- Mengambil informasi proyek terakhir.
- Memberikan informasi batas waktu kepada editor.

Response ketika tugas masih terbuka:

```json
{
  "student": {
    "id": "uuid",
    "nama": "Rani"
  },
  "assignment": {
    "id": "uuid",
    "judul": "Lab 3 - Klon dan Siaran",
    "dibuka_pada": "2026-11-18T01:00:00Z",
    "ditutup_pada": "2026-11-18T09:00:00Z",
    "izinkan_terlambat": true,
    "boleh_edit": true,
    "boleh_kumpul": true,
    "status": "dibuka"
  },
  "proyek_terakhir": {
    "snapshot_id": "uuid",
    "diambil_pada": "2026-11-18T03:12:00Z",
    "ukuran_bytes": 184320
  }
}
```

Response ketika tugas belum dibuka:

```json
{
  "assignment": {
    "id": "uuid",
    "boleh_edit": false,
    "boleh_kumpul": false,
    "status": "belum_dibuka",
    "alasan": "TUGAS_BELUM_DIBUKA",
    "dibuka_pada": "2026-11-18T01:00:00Z"
  }
}
```

Response ketika tugas sudah ditutup:

```json
{
  "assignment": {
    "id": "uuid",
    "boleh_edit": false,
    "boleh_kumpul": true,
    "status": "ditutup",
    "alasan": "TUGAS_DITUTUP",
    "ditutup_pada": "2026-11-18T09:00:00Z",
    "pesan": "Tugas sudah ditutup. Proyek dapat dilihat dan dikumpulkan, tetapi tidak dapat diedit lagi."
  },
  "proyek_terakhir": {
    "snapshot_id": "uuid",
    "diambil_pada": "2026-11-18T08:59:50Z",
    "ukuran_bytes": 184320
  }
}
```

Ketentuan:
- `boleh_edit` selalu `false` ketika tugas sudah ditutup.
- `boleh_kumpul` tetap `true` setelah tenggat, selama murid berhak mengakses tugas.
- Editor harus segera mengubah antarmuka menjadi baca-saja jika menerima `boleh_edit: false`.
- Editor tidak boleh mengandalkan response ini selamanya. Server tetap memeriksa waktu pada setiap operasi tulis.
- Murid yang bukan anggota kelas mendapatkan `404`.

### 4.2 `GET /api/v1/editor/projects/{assignment_id}`

Mengambil proyek terakhir milik murid untuk tugas tersebut.

Response:
- `200`: file `.sb3` sebagai biner.
- `204`: belum ada proyek tersimpan.

Header contoh:

```http
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="proyek-scratch.sb3"
ETag: "sha256-dari-isi"
X-Snapshot-Id: <uuid>
X-Diambil-Pada: 2026-11-18T03:12:00Z
```

Pemeriksaan:
- Sesi valid.
- Murid merupakan anggota kelas tugas.
- Proyek benar-benar milik murid tersebut.

Jangan memeriksa apakah tugas masih terbuka untuk operasi membaca. Murid tetap boleh membuka proyeknya setelah tenggat.

### 4.3 `POST /api/v1/editor/projects/{assignment_id}/snapshots`

Endpoint utama untuk menyimpan snapshot.

Digunakan oleh:
- Autosave.
- Simpan manual.
- Penyimpanan perubahan terakhir yang sudah didaftarkan sebelum tenggat.

Request:
- Biner `.sb3` mentah.
- Atau `multipart/form-data` dengan kolom `file`.

Header opsional:

```http
Idempotency-Key: <uuid>
```

Idempotency key dibuat satu kali untuk satu operasi simpan. Jika request diulang karena jaringan, gunakan key yang sama.

Response `201`:

```json
{
  "snapshot_id": "uuid",
  "diambil_pada": "2026-11-18T03:15:22Z",
  "isi_hash": "9f2c...",
  "ukuran_bytes": 184320,
  "baru": true,
  "terlambat": false
}
```

Jika isi file sama dengan snapshot terakhir yang sudah tersimpan:

```json
{
  "baru": false,
  "snapshot_id": "uuid-yang-sama",
  "isi_hash": "9f2c..."
}
```

Ketentuan:
- Hitung hash dari byte yang diterima.
- Dedup berdasarkan `(assignment_id, student_id, isi_hash)`.
- Isi yang sama tidak menghasilkan snapshot baru.
- Snapshot baru menggunakan object key baru.
- Simpan metadata di database.
- Jangan membuat submission dari endpoint ini.

#### Aturan penyimpanan ketika tenggat

Ketika `now() >= ditutup_pada`:
- Simpan biasa ditolak.
- Editor tidak boleh mengirim perubahan baru.
- Server hanya boleh menerima unggahan akhir yang memiliki save intent valid dan dibuat sebelum tenggat.
- Byte yang diterima harus cocok dengan hash dan ukuran yang telah didaftarkan dalam save intent.
- Save intent hanya dapat digunakan satu kali.
- Save intent harus terikat pada murid, tugas, dan sesi editor yang membuatnya.
- Save intent memiliki masa berlaku singkat yang ditentukan server.
- Setelah save intent berhasil digunakan atau kedaluwarsa, save intent tidak dapat digunakan lagi.

Response untuk save biasa setelah tenggat:

```json
{
  "error": {
    "kode": "TUGAS_DITUTUP",
    "pesan": "Tugas sudah ditutup. Editor sekarang hanya dapat dibaca."
  }
}
```

Response untuk unggahan akhir yang sah:

```json
{
  "snapshot_id": "uuid",
  "diambil_pada": "2026-11-18T09:00:08Z",
  "isi_hash": "9f2c...",
  "ukuran_bytes": 184320,
  "baru": true,
  "terlambat": false,
  "penyimpanan_akhir": true
}
```

`terlambat` pada snapshot tidak boleh disamakan dengan status submission. Snapshot yang merupakan penyelesaian unggahan akhir dari save intent sebelum tenggat tetap dianggap bagian dari pekerjaan sebelum editor terkunci.

Jika save intent tidak valid, sudah digunakan, kedaluwarsa, atau hash tidak cocok, server menolak request.

### 4.4 `POST /api/v1/editor/projects/{assignment_id}/save-intents`

Endpoint untuk mendaftarkan satu perubahan terakhir sebelum tenggat.

Endpoint ini diperlukan agar server dapat membedakan:
- Unggahan terakhir yang memang sudah dipersiapkan sebelum tenggat.
- Unggahan baru yang baru dimulai setelah editor terkunci.

Request JSON:

```json
{
  "isi_hash": "9f2c...",
  "ukuran_bytes": 184320
}
```

Server memeriksa:
1. Sesi murid valid.
2. Murid merupakan anggota kelas tugas.
3. Tugas masih terbuka.
4. Waktu database masih sebelum `ditutup_pada`.
5. Ukuran file tidak melebihi batas.
6. Hash memiliki format yang benar.

Response `201`:

```json
{
  "save_intent_id": "uuid",
  "upload_token": "token-acak",
  "berlaku_sampai": "2026-11-18T09:00:30Z",
  "maks_penggunaan": 1
}
```

Ketentuan:
- Save intent hanya dapat dibuat sebelum tenggat.
- Save intent terikat pada `assignment_id`, `student_id`, hash, ukuran file, dan sesi editor.
- Token tidak boleh digunakan untuk mengunggah file dengan hash atau ukuran berbeda.
- Token hanya dapat digunakan satu kali.
- Masa berlaku singkat, misalnya 30 detik setelah tenggat, dan harus ditentukan oleh server.
- Token tidak boleh diterbitkan ulang setelah tenggat.
- Jangan memperpanjang masa berlaku hanya karena klien mengulang request.
- Simpan token dalam bentuk hash jika disimpan di database.
- Hapus atau tandai kedaluwarsa save intent yang sudah tidak dapat digunakan.

Server harus memvalidasi token dan data intent secara atomik ketika unggahan dilakukan.

**Catatan implementasi:** save intent merupakan catatan sementara untuk mengotorisasi satu unggahan akhir. Implementasinya boleh menggunakan tabel sementara di PostgreSQL atau mekanisme server-side lain yang persisten dan aman. Jangan mengandalkan memori proses server saja karena aplikasi dapat berjalan pada lebih dari satu instance atau mengalami restart.

### 4.5 Alur penyimpanan terakhir saat tenggat

Urutan yang harus dilakukan editor:

1. Selama tugas terbuka, editor melakukan autosave sesuai jadwal.
2. Menjelang tenggat, editor mengambil kondisi proyek terakhir yang masih dapat diedit.
3. Editor menghasilkan byte `.sb3` dan menghitung hash serta ukuran file.
4. Sebelum tenggat, editor mengirim request pembuatan save intent.
5. Jika save intent berhasil, editor mengunggah byte yang hash dan ukurannya sesuai dengan intent.
6. Jika unggahan selesai sebelum tenggat, snapshot tersimpan seperti biasa.
7. Jika unggahan selesai sedikit setelah tenggat, server tetap menerima selama token valid dan byte cocok.
8. Ketika tenggat tercapai, editor langsung menjadi baca-saja.
9. Tidak boleh ada perubahan baru setelah editor menjadi baca-saja.
10. Setelah masa toleransi habis, save intent yang belum digunakan tidak berlaku lagi.

Jika pembuatan save intent gagal sebelum tenggat:
- Editor tidak boleh menganggap penyimpanan akhir berhasil.
- Editor menampilkan status penyimpanan gagal.
- Editor tetap menjadi baca-saja ketika tenggat tercapai.
- Editor tidak boleh mengirim perubahan baru setelah tenggat untuk menggantikan perubahan yang gagal didaftarkan.

Jangan menyatakan proyek berhasil tersimpan sebelum server memberikan response sukses.

### 4.6 `POST /api/v1/editor/projects/{assignment_id}/snapshots/beacon`

Endpoint fallback untuk `navigator.sendBeacon`.

Digunakan ketika tab ditutup atau browser akan meninggalkan halaman.

Ketentuan:
- Menerima biner `.sb3` mentah.
- Tidak membutuhkan header `Idempotency-Key`.
- Menggunakan pemeriksaan izin yang sama.
- Tidak boleh menjadi jalan pintas untuk melewati tenggat.
- Setelah tenggat, hanya boleh digunakan jika request menyertakan save intent yang valid melalui mekanisme payload yang telah ditentukan.
- Server tetap memeriksa hash dan ukuran terhadap save intent.
- `sendBeacon` tidak dapat membaca response dari server, sehingga editor tidak boleh menganggap penyimpanan berhasil hanya karena `sendBeacon()` mengembalikan `true`.

Jika browser menutup halaman sebelum server menyelesaikan penyimpanan, keberhasilan hanya dapat dipastikan dengan memeriksa snapshot pada request berikutnya.

### 4.7 `GET /api/v1/editor/projects/{assignment_id}/snapshots`

Mengambil daftar snapshot milik murid untuk tugas tersebut.

Response:

```json
{
  "snapshots": [
    {
      "id": "uuid",
      "diambil_pada": "2026-11-18T03:15:22Z",
      "ukuran_bytes": 184320,
      "isi_hash": "9f2c...",
      "terlambat": false
    }
  ]
}
```

Jangan mengirim `object_key`.

### 4.8 `GET /api/v1/editor/snapshots/{snapshot_id}/content`

Mengunduh snapshot tertentu.

Response:
- `200`: biner `.sb3`.

Pemeriksaan:
- Snapshot harus milik murid yang memanggil.
- Jika dipanggil guru, snapshot harus berada dalam kelas yang dimiliki guru tersebut.
- Jangan mengirim `object_key`.

---

## 5. Endpoint pengumpulan

### 5.1 `POST /api/v1/assignments/{assignment_id}/submissions`

Endpoint tombol **Kumpulkan**.

Pengumpulan berbeda dari autosave:
- Snapshot adalah riwayat penyimpanan otomatis atau manual.
- Submission adalah catatan bahwa murid mengumpulkan pekerjaan.
- Satu murid boleh membuat beberapa submission untuk tugas yang sama.

Request menggunakan snapshot yang sudah tersimpan:

```json
{
  "snapshot_id": "uuid",
  "catatan_siswa": "Saya belum selesai bagian suara."
}
```

Server memeriksa:
1. Sesi murid valid.
2. Murid anggota kelas tugas.
3. Snapshot milik murid tersebut.
4. Snapshot berasal dari tugas yang sama.
5. Snapshot belum pernah dikumpulkan untuk tugas tersebut.
6. Aturan waktu pengumpulan.

Server membuat baris `submissions` yang menunjuk ke objek file yang sama dengan snapshot.

Tidak perlu mengunggah ulang byte jika menggunakan `snapshot_id`.

Alternatif:
- Editor boleh mengirim biner `.sb3` secara langsung.
- Server menyimpan file sebagai objek baru.
- Server membuat snapshot dan submission sesuai transaksi yang aman.
- Hash dan ukuran dihitung oleh server.

Response `201`:

```json
{
  "submission_id": "uuid",
  "dikumpulkan_pada": "2026-11-18T09:10:00Z",
  "terlambat": true,
  "perlu_tinjauan": false,
  "urutan_ke": 2
}
```

### 5.2 Aturan pengumpulan setelah tenggat

Pengumpulan setelah tenggat tetap diterima dan tidak boleh membuat pekerjaan murid hilang.

Jika `now() >= ditutup_pada`:
- `terlambat` harus bernilai `true`.
- Submission tetap disimpan.
- `izinkan_terlambat = true`: submission diterima sebagai pengumpulan terlambat biasa.
- `izinkan_terlambat = false`: submission tetap diterima, tetapi `perlu_tinjauan = true` agar guru dapat memeriksanya.

Jangan menolak submission hanya karena tugas sudah ditutup.

`izinkan_terlambat` menentukan apakah pengumpulan terlambat memerlukan tinjauan, bukan apakah pekerjaan murid boleh disimpan.

Jika tugas belum dibuka, pengumpulan ditolak dengan `403 TUGAS_BELUM_DIBUKA`.

### 5.3 Pengumpulan berulang

Murid boleh mengumpulkan lebih dari satu kali.

Ketentuan:
- Setiap pengumpulan menghasilkan baris submission baru.
- `urutan_ke` dihitung secara konsisten untuk murid dan tugas tersebut.
- Submission sebelumnya tidak ditimpa.
- Riwayat submission tetap dapat dilihat guru.
- Pengumpulan dari snapshot yang sama untuk tugas yang sama hanya boleh dilakukan satu kali.

Gunakan transaksi database atau mekanisme penguncian yang tepat untuk mencegah dua request bersamaan menghasilkan pengumpulan ganda.

### 5.4 Idempotency

Header:

```http
Idempotency-Key: <uuid>
```

Jika key yang sama dikirim ulang oleh murid untuk operasi yang sama:
- Jangan membuat submission baru.
- Kembalikan hasil operasi sebelumnya.
- Jangan menganggap request yang berbeda sebagai operasi yang sama hanya karena murid dan tugasnya sama.

### 5.5 Error pengumpulan

| Kode | Status | Kondisi |
|---|---:|---|
| `TUGAS_BELUM_DIBUKA` | 403 | Pengumpulan sebelum waktu buka |
| `BUKAN_ANGGOTA` | 404 | Murid bukan anggota kelas |
| `BUKAN_MILIK_ANDA` | 404 | Snapshot bukan milik murid |
| `SNAPSHOT_SUDAH_DIKUMPULKAN` | 409 | Snapshot sudah pernah dikumpulkan |
| `ARSIP_TERLALU_BESAR` | 413 | File melewati batas ukuran |
| `TERLALU_SERING` | 429 | Request terlalu sering |

---

## 6. Endpoint guru

Semua endpoint pada bagian ini memerlukan sesi guru.

Semua pemeriksaan kepemilikan harus berakhir pada:

```text
classes.teacher_id = sesi_guru.id
```

### 6.1 `GET /api/v1/classes`

Mengambil daftar kelas milik guru.

Contoh response:

```json
{
  "classes": [
    {
      "id": "uuid",
      "nama": "Kelas 6A",
      "school": "SDN 01",
      "jumlah_murid": 28,
      "tugas_aktif": 1,
      "diarsipkan_pada": null
    }
  ]
}
```

### 6.2 `POST /api/v1/classes`

Membuat kelas.

Request:

```json
{
  "nama": "Kelas 6A",
  "school_id": "uuid"
}
```

`school_id` boleh `null` jika kelas tidak dikaitkan dengan sekolah.

Server harus memastikan sekolah tersebut milik guru yang sedang login.

Response `201` berisi data kelas.

### 6.3 `POST /api/v1/classes/{class_id}/invites`

Membuat undangan untuk bergabung ke kelas.

Request:

```json
{
  "berlaku_sampai": "2026-11-25T16:59:59Z",
  "maks_pemakaian": 30
}
```

`maks_pemakaian` boleh `null` untuk tanpa batas.

Response `201`:

```json
{
  "id": "uuid",
  "kode": "K7QM-3XPD",
  "tautan": "https://app.domainanda.com/join/K7QM-3XPD",
  "berlaku_dari": "2026-11-18T04:00:00Z",
  "berlaku_sampai": "2026-11-25T16:59:59Z",
  "maks_pemakaian": 30,
  "dipakai": 0
}
```

Kode undangan hanya dikembalikan saat pembuatan. Simpan kode secara aman dan jangan menampilkannya dalam log.

### 6.4 `DELETE /api/v1/invites/{invite_id}`

Mencabut undangan.

Response `204`.

Ketentuan:
- Isi `dicabut_pada`.
- Jangan menghapus murid yang sudah bergabung.
- Murid yang sudah menjadi anggota tetap menjadi anggota kelas.

### 6.5 `POST /api/v1/classes/{class_id}/assignments`

Membuat tugas.

Request:

```json
{
  "judul": "Lab 3 - Klon dan Siaran",
  "instruksi": "Buat satu sprite yang mengkloning dirinya lima kali.",
  "dibuka_pada": "2026-11-18T01:00:00Z",
  "ditutup_pada": "2026-11-18T09:00:00Z",
  "izinkan_terlambat": true
}
```

Response `201`.

Server memeriksa bahwa kelas merupakan milik guru.

### 6.6 `PATCH /api/v1/assignments/{assignment_id}`

Mengubah data tugas.

Contoh:

```json
{
  "ditutup_pada": "2026-11-19T09:00:00Z"
}
```

Perubahan tanggal penutupan memengaruhi keputusan waktu berikutnya.

Namun, perubahan tanggal tidak boleh mengubah fakta `terlambat` pada submission yang sudah tersimpan.

Jika guru membuka kembali tugas dengan tanggal baru:
- Editor dapat diedit kembali jika waktu server masih berada dalam jendela baru.
- Pemeriksaan izin tetap dilakukan pada setiap request.
- Riwayat submission lama tidak diubah.

### 6.7 `GET /api/v1/assignments/{assignment_id}/submissions`

Mengambil daftar murid dan status pengumpulan.

Contoh response:

```json
{
  "assignment": {
    "id": "uuid",
    "judul": "Lab 3",
    "ditutup_pada": "2026-11-18T09:00:00Z"
  },
  "murid": [
    {
      "student_id": "uuid",
      "nama": "Rani",
      "jumlah_kumpul": 2,
      "terakhir_dikumpulkan_pada": "2026-11-18T03:20:00Z",
      "submission_id": "uuid",
      "terlambat": false,
      "perlu_tinjauan": false,
      "jumlah_snapshot": 14,
      "snapshot_terakhir_pada": "2026-11-18T03:15:22Z",
      "belum_kumpul": false
    },
    {
      "student_id": "uuid",
      "nama": "Budi",
      "jumlah_kumpul": 0,
      "belum_kumpul": true
    }
  ]
}
```

Semua murid yang menjadi anggota kelas harus tetap muncul, termasuk yang belum mengumpulkan.

### 6.8 `GET /api/v1/submissions/{submission_id}/versions`

Mengambil riwayat snapshot dan pengumpulan untuk pekerjaan murid.

Contoh response:

```json
{
  "submission": {
    "id": "uuid",
    "dikumpulkan_pada": "2026-11-18T03:20:00Z",
    "terlambat": false
  },
  "versi": [
    {
      "jenis": "pengumpulan",
      "id": "uuid",
      "waktu": "2026-11-18T03:20:00Z",
      "ukuran_bytes": 184320,
      "url_unduh": "/api/v1/submissions/uuid/content"
    },
    {
      "jenis": "snapshot",
      "id": "uuid",
      "waktu": "2026-11-18T03:15:22Z",
      "ukuran_bytes": 184320,
      "url_unduh": "/api/v1/snapshots/uuid/content"
    }
  ]
}
```

Urutkan berdasarkan waktu terbaru terlebih dahulu.

Submission harus tetap dapat diunduh walaupun snapshot sumbernya sudah tidak termasuk dalam retensi snapshot biasa.

### 6.9 `GET /api/v1/submissions/{submission_id}/content`

Mengunduh file submission.

Pemeriksaan:
- Submission harus berada dalam kelas milik guru.
- File harus tersedia di object storage.
- Jangan mengirim `object_key`.

Response `200`: biner `.sb3`.

### 6.10 `GET /api/v1/snapshots/{snapshot_id}/content`

Mengunduh snapshot tertentu.

Pemeriksaan:
- Snapshot harus berada di kelas milik guru.
- Jangan mengirim `object_key`.

Response `200`: biner `.sb3`.

### 6.11 `POST /api/v1/submissions/{submission_id}/comments`

Membuat komentar pada submission.

Request:

```json
{
  "isi": "Klonnya sudah benar. Coba tambahkan siaran pesan agar klon berhenti."
}
```

Response `201`.

Server memeriksa:
- Submission berada di kelas milik guru.
- Panjang komentar tidak melebihi batas aplikasi.
- Isi komentar tidak kosong.

### 6.12 `GET /api/v1/submissions/{submission_id}/comments`

Mengambil komentar.

Response:

```json
{
  "komentar": [
    {
      "id": "uuid",
      "penulis": {
        "jenis": "guru",
        "nama": "Pak Andi"
      },
      "isi": "Klonnya sudah benar.",
      "dibuat_pada": "2026-11-18T04:05:00Z"
    }
  ]
}
```

Murid hanya boleh membaca komentar pada submission miliknya sendiri.

---

## 7. Pemeriksaan izin

Semua endpoint harus melakukan pemeriksaan izin di server.

Urutan pemeriksaan:

1. Sesi valid?
   - Tidak: `401`.

2. Peran sesuai?
   - Endpoint guru dipanggil murid atau sebaliknya: `403`.

3. Rantai kepemilikan valid?
   - Murid: `students.id` → `class_members` → `assignments.class_id`.
   - Guru: sumber daya → kelas → `classes.teacher_id = sesi_guru.id`.
   - Tidak valid: `404`.

4. Pemeriksaan waktu.
   - Hanya dilakukan sesuai jenis operasi.
   - Operasi baca tidak boleh ditolak hanya karena tugas ditutup.
   - Operasi tulis harus memeriksa status tugas dan aturan save intent.

5. Baru lakukan operasi database dan object storage.

Jangan mempercayai `class_id`, `assignment_id`, `student_id`, atau `object_key` yang dikirim klien tanpa memverifikasi hubungan datanya.

Buat fungsi pemeriksaan izin bersama, misalnya:

```ts
requireAccess({
  role,
  assignmentId,
  submissionId,
  snapshotId
});
```

Fungsi mengembalikan sesi dan sumber daya yang sudah diverifikasi, atau menghasilkan error HTTP.

Jangan menyalin pemeriksaan izin secara berbeda-beda di setiap endpoint.

---

## 8. Autosave, save intent, dan retensi

### 8.1 Jadwal autosave

Editor melakukan tiga jenis penyimpanan:

1. Debounce 30 detik setelah perubahan terakhir.
2. Simpan paksa setiap 5 menit selama ada perubahan yang belum tersimpan.
3. Simpan akhir melalui mekanisme save intent ketika mendekati tenggat.

Simpan manual tetap tersedia selama editor masih boleh diedit.

Jangan menyimpan setiap perubahan blok secara langsung karena akan menghasilkan terlalu banyak request.

### 8.2 Dedup snapshot

Server menghitung SHA-256 dari byte yang diterima.

Jika kombinasi berikut sudah ada:

```text
(assignment_id, student_id, isi_hash)
```

Server tidak membuat snapshot baru.

Jika belum ada, server membuat snapshot baru.

Operasi dedup harus aman terhadap request bersamaan. Gunakan unique constraint database dan penanganan konflik yang benar.

### 8.3 Pembatasan laju

Batas awal:
- Minimal 20 detik antara snapshot otomatis biasa untuk murid dan tugas yang sama.
- Simpan manual tidak boleh diblokir hanya karena batas autosave.
- Save intent memiliki pembatasan tersendiri.
- Request berulang dengan `Idempotency-Key` yang sama tidak dihitung sebagai operasi baru.

Jika melewati batas, kembalikan:

```http
429 Too Many Requests
Retry-After: 20
```

Jangan menerapkan batas ini dengan cara yang menghalangi penyelesaian save intent yang sah.

### 8.4 Retensi snapshot

Simpan maksimal 20 snapshot biasa terakhir untuk setiap kombinasi:

```text
(assignment_id, student_id)
```

Snapshot yang telah dirujuk oleh submission tidak boleh dihapus selama submission masih membutuhkan file tersebut.

Penghapusan snapshot harus mempertimbangkan:
- Referensi submission.
- Riwayat yang perlu dipertahankan.
- Keberadaan objek di storage.

Jangan menghapus objek storage sebelum transaksi database dan pemeriksaan referensi selesai.

### 8.5 Save intent dan konsistensi data

Save intent harus memiliki data yang cukup untuk memastikan unggahan akhir benar-benar sama dengan perubahan yang didaftarkan sebelum tenggat.

Minimal informasi yang diperlukan:
- ID save intent.
- ID tugas.
- ID murid.
- ID sesi editor atau pengenal sesi yang setara.
- Hash SHA-256.
- Ukuran file.
- Waktu dibuat berdasarkan database.
- Waktu kedaluwarsa berdasarkan database.
- Status penggunaan.
- Hash token atau token yang disimpan dengan aman.

Pembuatan intent harus ditolak jika waktu database sudah mencapai tenggat.

Penggunaan intent dan pembuatan snapshot harus dilakukan secara aman terhadap request bersamaan. Satu intent tidak boleh menghasilkan dua snapshot dari dua unggahan berbeda.

---

## 9. Daftar kode error

| Kode | Status | Kondisi |
|---|---:|---|
| `BELUM_MASUK` | 401 | Sesi tidak ada atau kedaluwarsa |
| `PERAN_TIDAK_SESUAI` | 403 | Peran pengguna tidak sesuai |
| `TUGAS_BELUM_DIBUKA` | 403 | Tugas belum dimulai |
| `TUGAS_DITUTUP` | 403 | Editor mencoba menyimpan perubahan baru setelah tenggat |
| `BUKAN_ANGGOTA` | 404 | Murid bukan anggota kelas |
| `BUKAN_MILIK_ANDA` | 404 | Sumber daya bukan milik pemanggil |
| `SAVE_INTENT_TIDAK_VALID` | 403 | Token atau intent tidak valid |
| `SAVE_INTENT_KEDALUWARSA` | 410 | Masa berlaku intent habis |
| `SAVE_INTENT_SUDAH_DIPAKAI` | 409 | Intent sudah digunakan |
| `HASH_TIDAK_SESUAI` | 422 | Byte yang diunggah tidak sesuai hash intent |
| `UNDANGAN_KEDALUWARSA` | 410 | Undangan melewati masa berlaku |
| `UNDANGAN_DICABUT` | 410 | Undangan dicabut |
| `UNDANGAN_PENUH` | 410 | Batas penggunaan undangan tercapai |
| `UNDANGAN_TIDAK_VALID` | 404 | Kode undangan tidak ditemukan |
| `ARSIP_TERLALU_BESAR` | 413 | File melebihi batas ukuran |
| `SNAPSHOT_SUDAH_DIKUMPULKAN` | 409 | Snapshot sudah dikumpulkan |
| `TERLALU_SERING` | 429 | Request melebihi batas |

Jangan membuat error `ARSIP_TIDAK_VALID` berdasarkan pemeriksaan isi ZIP atau `project.json`, karena server tidak mengurai file `.sb3`.

Server dapat menolak request yang:
- Tidak memiliki body.
- Melebihi batas ukuran.
- Tidak sesuai dengan hash save intent.
- Gagal disimpan secara utuh.

---

## 10. Keamanan dan konsistensi

### 10.1 File

- Jangan pernah mengirim `object_key` ke klien.
- Jangan membuat bucket publik.
- Jangan mempercayai nama file dari klien.
- Jangan mengurai `.sb3`.
- Jangan mengubah byte file.
- Hitung hash di server.
- Batasi ukuran upload.
- Pastikan unduhan memeriksa izin.

### 10.2 Database

- Gunakan transaksi untuk operasi yang mengubah beberapa tabel.
- Gunakan foreign key untuk menjaga hubungan data.
- Gunakan unique constraint untuk dedup.
- Gunakan penguncian atau mekanisme transaksi yang tepat untuk mencegah submission ganda.
- Jangan menghapus riwayat submission hanya karena snapshot biasa melewati retensi.

### 10.3 Kepemilikan

Setiap query harus dibatasi oleh kepemilikan pengguna yang sedang login.

Jangan hanya memeriksa bahwa ID sumber daya valid.

Contoh: murid yang mengganti `assignment_id` di URL tidak boleh dapat membaca atau menulis tugas kelas lain.

### 10.4 Waktu

- Jangan mempercayai waktu browser.
- Jangan mempercayai timestamp yang dikirim murid.
- Periksa waktu database pada setiap operasi tulis.
- Editor hanya menggunakan status dari server untuk mengatur antarmuka.
- Server tetap menjadi sumber kebenaran.

---

## 11. Kriteria pengujian API

### 11.1 Autentikasi dan izin

- [ ] Request tanpa sesi menghasilkan `401`.
- [ ] Murid tidak dapat memanggil endpoint khusus guru.
- [ ] Guru tidak dapat membaca kelas guru lain.
- [ ] Murid tidak dapat membaca proyek murid lain.
- [ ] Mengganti ID pada URL tidak dapat melewati pemeriksaan kepemilikan.
- [ ] `object_key` tidak pernah muncul dalam response API.

### 11.2 Waktu tugas

- [ ] Sebelum waktu buka, editor tidak dapat diedit.
- [ ] Saat tugas dibuka, editor dapat diedit.
- [ ] Tepat ketika tenggat tercapai, editor menjadi baca-saja.
- [ ] Setelah tenggat, proyek tersimpan tetap dapat dibuka.
- [ ] Setelah tenggat, murid tetap dapat mengumpulkan.
- [ ] Pengumpulan setelah tenggat memiliki `terlambat: true`.
- [ ] Jika `izinkan_terlambat` bernilai `false`, submission tetap tersimpan dan `perlu_tinjauan: true`.

### 11.3 Save intent

- [ ] Save intent hanya dapat dibuat sebelum tenggat.
- [ ] Save intent terikat pada murid dan tugas yang benar.
- [ ] Save intent tidak dapat digunakan oleh murid lain.
- [ ] Save intent tidak dapat digunakan untuk file dengan hash berbeda.
- [ ] Save intent tidak dapat digunakan untuk ukuran file berbeda.
- [ ] Save intent hanya dapat digunakan satu kali.
- [ ] Save intent yang kedaluwarsa ditolak.
- [ ] Unggahan yang didaftarkan sebelum tenggat dapat diselesaikan dalam masa toleransi.
- [ ] Unggahan baru tanpa save intent setelah tenggat ditolak.
- [ ] Dua request bersamaan tidak dapat menggunakan satu intent dua kali.

### 11.4 Snapshot

- [ ] Menyimpan isi yang sama dua kali menghasilkan satu snapshot.
- [ ] Menyimpan isi berbeda menghasilkan snapshot berbeda.
- [ ] `Idempotency-Key` yang sama tidak membuat operasi ganda.
- [ ] Snapshot tersimpan dapat diunduh kembali.
- [ ] Hash file yang diunduh sama dengan hash file yang diunggah.
- [ ] Snapshot yang dirujuk submission tidak dihapus oleh retensi.

### 11.5 Submission

- [ ] Murid dapat mengumpulkan snapshot miliknya.
- [ ] Murid tidak dapat mengumpulkan snapshot milik murid lain.
- [ ] Snapshot yang sama tidak dapat dikumpulkan dua kali.
- [ ] Murid dapat mengumpulkan ulang menggunakan snapshot baru.
- [ ] Submission lama tetap tersimpan.
- [ ] Submission tetap dapat diunduh walaupun snapshot biasa telah melewati retensi.
- [ ] Pengumpulan terlambat tetap tersimpan dan ditandai.

### 11.6 File `.sb3`

- [ ] File hasil upload dapat diunduh kembali dengan byte yang sama.
- [ ] Hash SHA-256 file sebelum dan sesudah penyimpanan sama.
- [ ] File hasil editor dapat dibuka di Scratch.
- [ ] File hasil editor dapat diunggah ke akun Scratch.
- [ ] Upload 51 MB menghasilkan `413`.
- [ ] Server tidak mengurai ZIP atau membaca `project.json`.
- [ ] Server tidak mengubah isi file.

---

## 12. Urutan implementasi

Kerjakan secara bertahap agar mudah diuji.

1. Autentikasi dan middleware pemeriksaan izin.
2. Format response error.
3. Endpoint `GET /editor/session`.
4. Endpoint membaca dan mengunduh proyek.
5. Endpoint snapshot dan dedup.
6. Endpoint save intent dan penyimpanan akhir saat tenggat.
7. Endpoint pengumpulan.
8. Endpoint kelas, murid, undangan, dan tugas.
9. Endpoint daftar submission dan riwayat.
10. Endpoint komentar.
11. Autosave di editor.
12. Retensi snapshot dan pembersihan object storage.
13. Pengujian integrasi dari editor sampai file dapat dibuka kembali di Scratch.

Jangan mulai mengerjakan seluruh endpoint sekaligus. Pastikan setiap tahap memiliki pengujian sebelum melanjutkan.

---

## 13. Hal yang tidak boleh dilakukan

1. Jangan mengurai atau menyusun ulang file `.sb3`.
2. Jangan menyimpan isi `.sb3` di database.
3. Jangan mengirim `object_key` ke browser.
4. Jangan membuat URL publik permanen untuk file.
5. Jangan mempercayai jam perangkat murid.
6. Jangan mengizinkan perubahan baru setelah editor terkunci.
7. Jangan menolak penyelesaian unggahan akhir yang sudah didaftarkan secara sah sebelum tenggat.
8. Jangan menolak submission terlambat sehingga pekerjaan murid hilang.
9. Jangan membuat submission dari autosave.
10. Jangan menghapus file yang masih dirujuk submission.
11. Jangan melewati pemeriksaan kepemilikan demi mempersingkat kode.
12. Jangan membuat sistem autentikasi atau mesin Scratch sendiri jika komponen yang ada sudah mencukupi.

---

## 14. Catatan keputusan implementasi

Dokumen ini menetapkan perilaku produk. Detail teknis seperti nama tabel sementara save intent, mekanisme token, dan strategi penguncian dapat disesuaikan saat implementasi, tetapi hasil akhirnya harus memenuhi seluruh aturan berikut:

- Editor langsung menjadi baca-saja saat tenggat.
- Perubahan terakhir yang telah didaftarkan sebelum tenggat dapat diselesaikan proses unggahnya dalam masa toleransi.
- Tidak ada perubahan baru yang diterima setelah tenggat tanpa save intent yang sah.
- Murid tetap dapat melihat dan mengunduh proyek setelah tenggat.
- Murid tetap dapat mengumpulkan setelah tenggat.
- Pengumpulan terlambat selalu disimpan dan ditandai.
- File `.sb3` tetap byte-identik dari upload sampai download.
- Semua keputusan izin dan waktu dilakukan di server.

Jika ada perubahan terhadap keputusan ini, perbarui dokumen API, REQUIREMENTS, dan TESTING agar tetap konsisten.