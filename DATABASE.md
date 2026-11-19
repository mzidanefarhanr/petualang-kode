# DATABASE.md — Skema Database Scratch Kelas v1

> Dokumen ini merupakan sumber kebenaran untuk skema database aplikasi kelas.
>
> Database menyimpan identitas pengguna, sekolah, kelas, keanggotaan, undangan, tugas, pengumpulan, snapshot, save intent, dan komentar.
>
> Isi berkas proyek Scratch `.sb3` tidak pernah disimpan atau dimodifikasi oleh database. Berkas disimpan di object storage dan hanya dikenali melalui metadata seperti `object_key`, `isi_hash`, dan `ukuran_bytes`.
>
> Target database: PostgreSQL 15 atau lebih baru.

---

## 1. Cara Menggunakan Dokumen Ini

1. SQL dalam dokumen ini adalah sumber kebenaran skema database.
2. Jika menggunakan ORM seperti Prisma atau Drizzle, skema ORM wajib mengikuti SQL.
3. Jangan mengubah migrasi yang sudah pernah dijalankan.
4. Setiap perubahan struktur harus dibuat sebagai migrasi baru.
5. Sebelum mengubah tabel, baca alasan desain dan dampaknya terhadap relasi tabel lain.
6. Sebelum mengubah API, baca dokumen ini bersama spesifikasi API.
7. Jika ada perbedaan antara database, API, dan dokumen kebutuhan, jangan mengambil keputusan berdasarkan asumsi. Catat konflik dan selesaikan sebelum implementasi.

Database dirancang untuk satu guru yang mengelola beberapa sekolah dan banyak kelas.

Tidak ada sistem multi-tenant antar guru pada v1.

---

## 2. Konvensi Database

### 2.1 Waktu

Semua kolom waktu menggunakan `timestamptz`.

Contoh:

```sql
dibuat_pada timestamptz not null default now()
```

Ketentuan:

- Waktu dibuat oleh database menggunakan `now()`.
- Jangan menggunakan timestamp dari browser untuk keputusan bisnis.
- API mengirim waktu dalam ISO 8601 UTC dengan akhiran `Z`.
- Klien mengubah tampilan waktu sesuai zona waktu pembaca.
- Jangan menyimpan waktu lokal tanpa zona waktu.

Berlaku untuk:
- Waktu pembuatan akun.
- Waktu bergabung.
- Masa berlaku undangan.
- Waktu pembukaan dan penutupan tugas.
- Waktu snapshot.
- Waktu kedaluwarsa save intent.
- Waktu pengumpulan.
- Waktu komentar.
- Waktu pengarsipan dan pencabutan.

### 2.2 Pengenal

Gunakan UUID untuk seluruh primary key.

Contoh:

```sql
id uuid primary key default gen_random_uuid()
```

PostgreSQL 15 mendukung `gen_random_uuid()`.

UUID digunakan agar ID yang muncul pada URL tidak mengungkap urutan jumlah data.

UUID bukan pengganti pemeriksaan hak akses.

### 2.3 Penamaan

Gunakan aturan berikut:

| Elemen | Aturan | Contoh |
|---|---|---|
| Nama tabel | Bahasa Inggris, plural, lowercase | `students` |
| Primary key | `id` | `id` |
| Foreign key | Nama entitas + `_id` | `teacher_id` |
| Kolom ranah kelas | Bahasa Indonesia | `ditutup_pada` |
| Kolom teknis | Bahasa Inggris | `object_key` |
| Kolom waktu | Akhiran `_pada` atau nama yang sudah ditetapkan | `dibuat_pada` |

Jangan mengganti konvensi penamaan tanpa memperbarui seluruh dokumen dan implementasi terkait.

### 2.4 Penghapusan

Tidak ada kolom `is_deleted` global.

Gunakan penghapusan lunak dengan kolom waktu yang memiliki arti spesifik.

Contoh:
- `classes.diarsipkan_pada`
- `invites.dicabut_pada`

Penghapusan keras hanya dilakukan jika memang diperlukan dan hubungan `ON DELETE` sudah dipilih secara sadar.

Jangan menganggap seluruh tabel aman dihapus dengan cascade.

### 2.5 Foreign Key

Setiap foreign key harus:
- Didefinisikan secara eksplisit.
- Memiliki aturan `ON DELETE` yang disengaja.
- Menjaga integritas hubungan antar tabel.
- Tidak hanya mengandalkan pemeriksaan di frontend.

Jika suatu hubungan membutuhkan lebih dari satu kolom untuk menjamin kepemilikan, gunakan composite foreign key jika memungkinkan.

---

## 3. Peta Relasi

```text
teachers
  ├── schools
  └── classes
        ├── invites
        ├── class_members ─── students
        └── assignments
              ├── submissions
              │     └── comments
              ├── snapshots
              └── save_intents
```

Penjelasan:

- Satu guru dapat memiliki banyak sekolah.
- Satu guru dapat membuat banyak kelas.
- Satu kelas dapat memiliki banyak murid.
- Satu murid dapat mengikuti banyak kelas.
- Satu kelas dapat memiliki banyak tugas.
- Satu tugas dapat memiliki banyak submission dari murid yang sama.
- Satu tugas dan murid dapat memiliki banyak snapshot.
- Satu tugas dan murid dapat memiliki save intent sementara menjelang tenggat.
- Satu submission dapat memiliki banyak komentar.

### 3.1 Sekolah

`schools` terhubung langsung ke `teachers`.

Sekolah adalah label tempat guru mengajar, bukan pemisah kepemilikan data.

Satu guru dapat mengajar di beberapa sekolah.

### 3.2 Identitas murid

`students` bersifat global untuk seluruh kelas yang dikelola guru.

Satu murid tidak perlu memiliki akun berbeda ketika mengikuti beberapa kelas.

Murid dikenali saat masuk menggunakan `username` yang unik (tidak peka huruf besar/kecil) dan kata sandi, sedangkan `email` bersifat opsional.

Hubungan murid dengan kelas disimpan dalam `class_members`.

### 3.3 Perbedaan submission dan snapshot

Kedua tabel ini tidak memiliki foreign key langsung satu sama lain.

**Snapshots:**
- Rekaman proses pengerjaan.
- Dibuat melalui autosave (`otomatis`) dan simpan manual (`manual`).
- Dideduplikasi berdasarkan hash isi.
- Dapat dihapus sesuai kebijakan retensi.
- Tidak otomatis menjadi pengumpulan.

**Submissions:**
- Rekaman tindakan sadar murid menekan tombol Kumpulkan.
- Setiap pengumpulan menghasilkan baris baru.
- Pengumpulan sebelumnya tetap dipertahankan.
- Tidak boleh hilang akibat retensi snapshot.

Submission menyalin referensi objek, hash, dan ukuran berkas dari snapshot yang dipilih.

Karena itu, penghapusan baris snapshot tidak boleh menghilangkan objek yang masih digunakan oleh submission.

---

## 4. Migrasi Database

Gunakan tiga migrasi awal.

```text
db/migrations/
├── 001_akun.sql
├── 002_kelas.sql
└── 003_tugas_dan_pekerjaan.sql
```

Urutan eksekusi wajib:

1. `001_akun.sql`
2. `002_kelas.sql`
3. `003_tugas_dan_pekerjaan.sql`

Jangan menjalankan migrasi secara acak.

### 4.1 Pelacakan migrasi

Jika tidak menggunakan migration tool, gunakan tabel berikut:

```sql
create table schema_migrations (
  versi text primary key,
  diterapkan_pada timestamptz not null default now()
);
```

Setiap migrasi yang berhasil harus dicatat.

### 4.2 Aturan migrasi

- Migrasi yang sudah dijalankan tidak boleh diedit.
- Perbaikan dilakukan melalui migrasi baru.
- Jangan menghapus tabel untuk mengatasi kesalahan kecil.
- Jangan mengubah data produksi secara manual tanpa prosedur yang dapat diulang.
- Uji migrasi pada database kosong.
- Uji migrasi pada salinan database yang sudah memiliki data sebelum deployment.

---

# 5. Struktur Tabel

## 5.1 Migrasi 001 — Akun

Berkas: `001_akun.sql`

### Tabel teachers

Menyimpan akun guru.

```sql
create table teachers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  nama          text not null,
  dibuat_pada   timestamptz not null default now()
);

create unique index teachers_email_lower_unique
  on teachers (lower(email));
```

Alasan desain:

- Satu akun guru mengelola beberapa sekolah.
- Guru masuk menggunakan email dan kata sandi.
- `password_hash` wajib tersedia karena guru tidak menggunakan mekanisme undangan untuk masuk.
- Kata sandi mentah tidak pernah disimpan.
- Email dinormalisasi di aplikasi sebelum disimpan.
- Indeks `lower(email)` mencegah email yang berbeda kapitalisasi dianggap sebagai akun berbeda.

Gunakan algoritma hashing kata sandi yang sesuai untuk password, bukan hash biasa seperti SHA-256.

### Tabel schools

Menyimpan sekolah yang berada dalam pengelolaan guru.

```sql
create table schools (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  nama       text not null,
  catatan    text,

  unique (id, teacher_id)
);
```

Alasan desain:

- Sekolah merupakan label milik guru.
- Satu guru dapat memiliki banyak sekolah.
- Sekolah tidak menjadi pemisah data antar pengguna.
- Composite unique digunakan agar kelas dapat memastikan sekolah dan guru memiliki hubungan yang benar.

### Tabel students

Menyimpan identitas murid.

```sql
create table students (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  nama          text not null,
  email         text,
  password_hash text,
  dibuat_pada   timestamptz not null default now(),

  check (length(trim(username)) >= 3)
);

create unique index students_username_lower_unique
  on students (lower(username));

create unique index students_email_lower_unique
  on students (lower(email))
  where email is not null;
```

Alasan desain:

- Murid masuk kembali menggunakan `username` dan kata sandi karena `email` bersifat opsional bagi anak SD.
- Indeks `lower(username)` mencegah `username` yang berbeda kapitalisasi dianggap sebagai akun berbeda.
- Murid dapat bergabung ke banyak kelas dengan satu akun.
- `password_hash` boleh kosong sebelum murid pertama kali menyelesaikan proses pendaftaran.
- Setelah murid membuat kata sandi, kolom tersebut diisi.
- Email dinormalisasi sebelum disimpan.
- Banyak nilai `NULL` pada `email` diperbolehkan.

Identitas murid tidak boleh dibuat ulang hanya karena murid mengikuti kelas lain.

---

## 5.2 Migrasi 002 — Kelas dan Undangan

Berkas: `002_kelas.sql`

### Tabel classes

```sql
create table classes (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid not null references teachers(id) on delete cascade,
  school_id        uuid,
  nama             text not null,
  diarsipkan_pada  timestamptz,
  dibuat_pada      timestamptz not null default now(),

  unique (id, teacher_id),

  foreign key (school_id, teacher_id)
    references schools(id, teacher_id)
    on delete set null (school_id)
);

create index classes_teacher_idx
  on classes (teacher_id);
```

Alasan desain:

- Satu guru dapat memiliki banyak kelas.
- Sekolah boleh tidak dipilih.
- Jika sekolah dihapus, kelas tetap ada.
- Jika sekolah dihapus, `school_id` menjadi NULL.
- `teacher_id` tidak ikut menjadi NULL.
- Composite foreign key memastikan kelas tidak dapat menunjuk sekolah milik guru lain.

Arsip kelas menggunakan `diarsipkan_pada`.

Jangan menghapus kelas hanya untuk menyembunyikannya dari daftar aktif.

### Tabel class_members

```sql
create table class_members (
  class_id       uuid not null references classes(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  bergabung_pada timestamptz not null default now(),

  primary key (class_id, student_id)
);

create index class_members_student_idx
  on class_members (student_id);
```

Alasan desain:

- Hubungan murid dan kelas bersifat banyak-ke-banyak.
- Primary key gabungan mencegah murid bergabung dua kali ke kelas yang sama.
- Murid dapat mengikuti beberapa kelas.
- Penghapusan kelas menghapus keanggotaannya.
- Penghapusan akun murid menghapus keanggotaannya.

### Tabel invites

```sql
create table invites (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id) on delete cascade,
  kode           text not null unique,
  berlaku_dari   timestamptz not null default now(),
  berlaku_sampai timestamptz not null,
  maks_pemakaian int,
  dipakai        int not null default 0,
  dicabut_pada   timestamptz,
  dibuat_pada    timestamptz not null default now(),

  check (berlaku_sampai > berlaku_dari),
  check (maks_pemakaian is null or maks_pemakaian > 0),
  check (dipakai >= 0)
);

create index invites_class_idx
  on invites (class_id);
```

Alasan desain:

- Undangan memiliki masa berlaku sendiri.
- Undangan dapat dicabut tanpa menghapus anggota kelas yang sudah bergabung.
- `maks_pemakaian` NULL berarti tidak ada batas pemakaian.
- `dipakai` mencatat jumlah penggunaan yang berhasil.
- `kode` unik agar satu undangan tidak bertabrakan dengan undangan lain.

### Aturan penggunaan undangan

Undangan dapat digunakan jika:

```sql
now() >= berlaku_dari
and now() < berlaku_sampai
and dicabut_pada is null
and (
  maks_pemakaian is null
  or dipakai < maks_pemakaian
)
```

Pemeriksaan dan penambahan `dipakai` harus dilakukan secara atomik dalam transaksi.

Jangan melakukan pola berikut:

1. Membaca jumlah pemakaian.
2. Memeriksa batas.
3. Menambah jumlah pemakaian melalui query terpisah tanpa penguncian.

Dua permintaan bersamaan dapat melewati batas pemakaian.

Gunakan row lock atau operasi atomik agar satu pemakaian tidak dihitung dua kali.

Undangan hanya diperiksa saat murid bergabung.

Setelah murid menjadi anggota kelas, pencabutan undangan tidak menghapus atau membatalkan keanggotaannya.

### Aturan pengarsipan kelas

Mengarsipkan kelas tidak menghapus:
- Murid.
- Keanggotaan.
- Tugas.
- Submission.
- Snapshot.
- Komentar.

Pengarsipan hanya mengubah status kelas agar tidak tampil sebagai kelas aktif.

Jika kelas dibuka kembali, riwayat lama tetap tersedia.

---

## 5.3 Migrasi 003 — Tugas dan Pekerjaan

Berkas: `003_tugas_dan_pekerjaan.sql`

### Tabel assignments

```sql
create table assignments (
  id                uuid primary key default gen_random_uuid(),
  class_id          uuid not null references classes(id) on delete cascade,
  judul             text not null,
  instruksi         text,
  dibuka_pada       timestamptz not null,
  ditutup_pada      timestamptz not null,
  izinkan_terlambat boolean not null default true,
  dibuat_pada       timestamptz not null default now(),

  check (ditutup_pada > dibuka_pada),

  unique (id, class_id)
);

create index assignments_class_window_idx
  on assignments (class_id, ditutup_pada);
```

Alasan desain:

- Setiap tugas berada dalam satu kelas.
- Tugas memiliki waktu pembukaan dan penutupan.
- Waktu disimpan sebagai `timestamptz`.
- Tugas dapat dibuka kembali dengan mengubah tanggalnya.
- Riwayat pekerjaan lama tidak berubah ketika tanggal tugas diubah.

`izinkan_terlambat` merupakan pengaturan tugas, bukan alasan untuk membuang pekerjaan murid.

Pengumpulan yang diterima tetap harus disimpan dan ditandai terlambat berdasarkan aturan API.

### Tabel submissions

```sql
create table submissions (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null,
  class_id         uuid not null,
  student_id       uuid not null,
  dikumpulkan_pada timestamptz not null default now(),
  terlambat        boolean not null default false,
  perlu_tinjauan   boolean not null default false,
  object_key       text not null unique,
  isi_hash         text not null,
  ukuran_bytes     bigint not null,
  catatan_siswa    text,

  unique (id, student_id),

  foreign key (assignment_id, class_id)
    references assignments(id, class_id)
    on delete cascade,

  foreign key (class_id, student_id)
    references class_members(class_id, student_id)
    on delete no action,

  check (length(object_key) > 0),
  check (isi_hash ~ '^[0-9a-f]{64}$'),
  check (ukuran_bytes > 0)
);

create index submissions_assignment_student_time_idx
  on submissions (
    assignment_id,
    student_id,
    dikumpulkan_pada desc
  );
```

Alasan desain:

**Banyak pengumpulan per murid**

Tidak ada unique constraint pada `(assignment_id, student_id)`.

Murid boleh mengumpulkan lebih dari sekali.

Setiap pengumpulan merupakan baris baru.

**Hubungan dengan kelas**

`class_id` disimpan sebagai kolom teknis tambahan.

Nilainya ditentukan server berdasarkan `assignment_id`, bukan dipercaya dari klien.

Composite foreign key memastikan:
- Tugas benar-benar berada di kelas tersebut.
- Murid benar-benar anggota kelas tersebut.

**Waktu pengumpulan & status tinjauan**

`dikumpulkan_pada` diisi database.

`terlambat` dan `perlu_tinjauan` merupakan fakta pada saat pengumpulan dibuat (`perlu_tinjauan = terlambat and not izinkan_terlambat`).

Jangan menghitung ulang status terlambat atau perlu tinjauan ketika halaman dibuka.

**Berkas**

Database menyimpan:
- `object_key`
- `isi_hash`
- `ukuran_bytes`

Database tidak menyimpan isi `.sb3`.

`object_key` harus unik dan tidak boleh digunakan untuk menimpa objek lama.

Hash SHA-256 dihitung dari byte asli berkas.

Ukuran berkas diperiksa oleh server sebelum penyimpanan.

**Submission sebagai titik beku**

Submission menyalin referensi objek dari snapshot yang dipilih.

Jangan menyimpan foreign key ke tabel snapshots.

Jangan membuat submission bergantung pada keberadaan baris snapshot.

Jika snapshot dihapus oleh retensi, berkas submission tetap harus tersedia.

### Tabel snapshots

```sql
create table snapshots (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  class_id      uuid not null,
  student_id    uuid not null,
  diambil_pada  timestamptz not null default now(),
  jenis_simpan  text not null default 'otomatis',
  object_key    text not null unique,
  isi_hash      text not null,
  ukuran_bytes  bigint not null,
  jumlah_balok  int,

  foreign key (assignment_id, class_id)
    references assignments(id, class_id)
    on delete cascade,

  foreign key (class_id, student_id)
    references class_members(class_id, student_id)
    on delete no action,

  check (jenis_simpan in ('otomatis', 'manual')),
  check (length(object_key) > 0),
  check (isi_hash ~ '^[0-9a-f]{64}$'),
  check (ukuran_bytes > 0),
  check (jumlah_balok is null or jumlah_balok >= 0)
);

create unique index snapshots_assignment_student_hash_unique
  on snapshots (assignment_id, student_id, isi_hash);

create index snapshots_assignment_student_time_idx
  on snapshots (
    assignment_id,
    student_id,
    diambil_pada desc
  );
```

Alasan desain:

Snapshot merupakan rekaman proses pengerjaan.

`jenis_simpan` membedakan apakah snapshot dibuat dari autosave (`otomatis`) atau tombol simpan oleh murid (`manual`) agar guru dapat melihat jejak pengerjaan sesuai `DESIGN.md`.

Deduplikasi menggunakan kombinasi:

`assignment_id + student_id + isi_hash`

Jika isi berkas tidak berubah, tidak perlu membuat snapshot baru.

Jika isi berubah, buat snapshot baru.

`class_id` ditentukan server berdasarkan tugas yang sedang dikerjakan.

Composite foreign key menjaga agar snapshot tidak dapat dibuat untuk murid yang bukan anggota kelas.

### Kolom jumlah_balok

`jumlah_balok` bersifat nullable.

Untuk v1:
- Tidak wajib diisi.
- Tidak boleh menjadi syarat penyimpanan.
- Tidak boleh diambil dengan membaca arsip `.sb3` yang sudah tersimpan.
- Tidak boleh mengubah `project.json`.
- Jika belum ada mekanisme pengambilan metadata yang disetujui, biarkan NULL.

Antarmuka harus menampilkan tanda "—" jika nilainya NULL.

Penggunaan kolom ini harus diselaraskan dengan `DESIGN.md` dan batas integritas `.sb3`.

### Tabel save_intents

Menyimpan otorisasi sementara untuk unggahan akhir yang didaftarkan sebelum tenggat agar dapat diselesaikan dalam masa toleransi singkat.

```sql
create table save_intents (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null,
  class_id       uuid not null,
  student_id     uuid not null,
  token_hash     text not null unique,
  isi_hash       text not null,
  ukuran_bytes   bigint not null,
  dibuat_pada    timestamptz not null default now(),
  berlaku_sampai timestamptz not null,
  dipakai_pada   timestamptz,

  foreign key (assignment_id, class_id)
    references assignments(id, class_id)
    on delete cascade,

  foreign key (class_id, student_id)
    references class_members(class_id, student_id)
    on delete cascade,

  check (berlaku_sampai > dibuat_pada),
  check (isi_hash ~ '^[0-9a-f]{64}$'),
  check (ukuran_bytes > 0)
);

create index save_intents_lookup_idx
  on save_intents (assignment_id, student_id, berlaku_sampai);
```

Alasan desain:

- Token mentah hanya dikembalikan ke editor saat pembuatan; database hanya menyimpan `token_hash` (SHA-256 dari token).
- Satu save intent hanya dapat dipakai satu kali (`dipakai_pada is null` diperiksa dan diisi secara atomik dalam transaksi saat unggahan akhir diterima).
- Terikat langsung pada `assignment_id`, `student_id`, `isi_hash`, dan `ukuran_bytes` agar tidak bisa dipakai untuk berkas berbeda atau oleh murid lain.
- Baris yang sudah kedaluwarsa atau terpakai dapat dibersihkan secara berkala.

### Tabel comments

```sql
create table comments (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid not null references submissions(id) on delete cascade,
  penulis_teacher_id uuid references teachers(id) on delete cascade,
  penulis_student_id uuid,
  isi                text not null,
  dibuat_pada        timestamptz not null default now(),

  foreign key (submission_id, penulis_student_id)
    references submissions(id, student_id)
    on delete cascade,

  check (length(trim(isi)) > 0),

  check (
    (penulis_teacher_id is not null)::int
    +
    (penulis_student_id is not null)::int = 1
  )
);

create index comments_submission_time_idx
  on comments (submission_id, dibuat_pada);
```

Alasan desain:

- Komentar selalu menempel pada submission tertentu.
- Satu komentar harus memiliki tepat satu penulis.
- Penulis adalah guru atau murid.
- Murid hanya dapat berkomentar pada submission miliknya sendiri.
- Guru hanya dapat berkomentar pada submission dalam cakupan kepemilikannya.

Foreign key pada penulis murid memastikan bahwa murid tersebut merupakan pemilik submission.

Kepemilikan guru tetap harus diperiksa oleh aplikasi melalui hubungan:

`teachers → classes → assignments → submissions`

Panjang komentar dibatasi oleh aplikasi sesuai `REQUIREMENTS.md`.

Komentar kosong ditolak oleh database.

---

# 6. View Pengumpulan Terakhir

Daftar penilaian guru harus menampilkan pengumpulan terakhir dari setiap murid pada setiap tugas.

Gunakan view berikut:

```sql
create view submission_terakhir as
select distinct on (assignment_id, student_id)
  id,
  assignment_id,
  class_id,
  student_id,
  dikumpulkan_pada,
  terlambat,
  perlu_tinjauan,
  object_key,
  isi_hash,
  ukuran_bytes,
  catatan_siswa
from submissions
order by
  assignment_id,
  student_id,
  dikumpulkan_pada desc,
  id desc;
```

Alasan desain:

- Guru melihat satu pengumpulan terakhir per murid.
- Pengumpulan sebelumnya tetap tersimpan.
- Riwayat lama tidak dihapus.
- Kolom ditulis secara eksplisit, bukan `SELECT *`.
- `id` menjadi pemecah seri ketika dua waktu pengumpulan sama.

View ini hanya menentukan pengumpulan terakhir.

Daftar murid tetap harus berasal dari `class_members` agar guru dapat melihat murid yang belum mengumpulkan.

Jangan membuat daftar nilai hanya berdasarkan tabel submissions karena murid yang belum mengumpulkan akan hilang dari daftar.

---

# 7. Kebijakan Retensi Snapshot

Batas awal retensi adalah 20 snapshot per kombinasi tugas dan murid.

Snapshot yang pernah digunakan untuk submission tidak boleh dihapus.

Retensi dijalankan sebagai pekerjaan berkala di luar jalur permintaan pengguna.

Contoh query untuk menentukan snapshot yang dapat dihapus:

```sql
with snapshot_usang as (
  select id
  from (
    select
      s.id,
      s.assignment_id,
      s.student_id,
      s.isi_hash,
      row_number() over (
        partition by s.assignment_id, s.student_id
        order by s.diambil_pada desc, s.id desc
      ) as urutan
    from snapshots s
  ) x
  where x.urutan > 20
    and not exists (
      select 1
      from submissions sub
      where sub.assignment_id = x.assignment_id
        and sub.student_id = x.student_id
        and sub.isi_hash = x.isi_hash
    )
)
delete from snapshots s
using snapshot_usang u
where s.id = u.id;
```

Ketentuan:

1. Snapshot yang pernah dikumpulkan tidak boleh dihapus.
2. Submission tidak boleh terpengaruh oleh retensi.
3. Retensi tidak boleh berjalan ketika proses submission sedang menggunakan snapshot yang sama.
4. Penghapusan baris database dan penghapusan objek storage harus dikelola secara terpisah.
5. Jangan menghapus objek storage sebelum dipastikan tidak lagi digunakan.
6. Jika penghapusan objek storage gagal, proses pembersihan harus dapat dicoba kembali.

Pekerjaan retensi harus aman dijalankan lebih dari sekali.

Jika ada keraguan tentang penghapusan, pertahankan objeknya terlebih dahulu.

---

# 8. Aturan Penyimpanan Objek

Struktur kunci objek:

```text
submissions/
  {assignment_id}/
    {student_id}/
      {submission_id}.sb3

snapshots/
  {assignment_id}/
    {student_id}/
      {snapshot_id}.sb3
```

Aturan:

- Setiap objek menggunakan kunci baru.
- Objek tidak boleh ditimpa.
- `object_key` tidak boleh dikirim ke klien.
- Database hanya menyimpan referensi objek.
- Object storage tidak boleh bersifat publik.
- Pengunduhan dilakukan melalui endpoint yang memeriksa izin.
- URL bertanda tangan hanya boleh dibuat setelah pemeriksaan izin dan memiliki masa berlaku singkat sesuai kontrak API.

### Urutan penyimpanan

Untuk membuat snapshot atau submission:

1. Terima berkas dari klien.
2. Periksa autentikasi.
3. Periksa kepemilikan dan keanggotaan.
4. Periksa jendela waktu sesuai operasi.
5. Periksa batas ukuran.
6. Hitung SHA-256 dari byte asli.
7. Periksa deduplikasi jika operasi adalah snapshot.
8. Unggah objek ke object storage menggunakan kunci baru.
9. Simpan metadata ke database.
10. Jika penulisan database gagal, catat objek yatim untuk pembersihan.
11. Kembalikan hasil kepada klien setelah operasi yang diperlukan berhasil.

Jangan membuat baris database yang menunjuk objek yang belum berhasil disimpan.

Untuk submission yang menggunakan objek snapshot, referensi objek disalin ke submission sesuai kontrak API. Jangan menghapus objek tersebut selama masih digunakan submission.

---

# 9. Aturan yang Wajib Dijaga Aplikasi

Tidak semua aturan dapat ditegakkan oleh constraint SQL.

Aturan berikut wajib diterapkan di server.

## 9.1 Autentikasi

- Guru harus memiliki sesi yang valid.
- Murid harus memiliki sesi yang valid.
- Kata sandi tidak pernah dikirim kembali ke klien.
- `password_hash` tidak boleh muncul dalam respons API.
- Tidak ada tabel sesi buatan sendiri.

## 9.2 Kepemilikan guru

Setiap permintaan guru harus memeriksa bahwa sumber daya benar-benar berada dalam cakupan guru yang sedang masuk.

Rantai pemeriksaan:

```text
teachers.id
    ↓
classes.teacher_id
    ↓
assignments.class_id
    ↓
submissions.assignment_id
    ↓
comments.submission_id
```

Jangan mempercayai `class_id`, `assignment_id`, atau `submission_id` dari klien tanpa memeriksa seluruh hubungan.

## 9.3 Kepemilikan murid

Setiap permintaan murid harus memeriksa:
- Identitas murid dari sesi.
- Keanggotaan kelas.
- Hubungan tugas dengan kelas.
- Kepemilikan submission.
- Kepemilikan snapshot.

Murid tidak boleh mengakses proyek milik murid lain dengan mengganti UUID.

## 9.4 Waktu

Semua keputusan waktu menggunakan waktu server.

Termasuk:
- Undangan kedaluwarsa.
- Undangan dicabut.
- Jendela pengerjaan.
- Keterlambatan pengumpulan.
- Waktu snapshot.
- Masa berlaku save intent.
- Waktu submission.
- Retensi.

Jangan mempercayai timestamp dari browser.

## 9.5 Pengumpulan terlambat

Status terlambat dihitung saat submission dibuat.

Nilainya disimpan pada `submissions.terlambat` dan `submissions.perlu_tinjauan`.

Perubahan tanggal penutupan tugas tidak boleh mengubah status pengumpulan lama.

Pengumpulan yang terlambat tetapi diterima harus tetap disimpan.

## 9.6 Deduplikasi snapshot

Pemeriksaan deduplikasi harus dilakukan secara aman terhadap permintaan bersamaan.

Gunakan unique index sebagai perlindungan terakhir.

Jika terjadi konflik unique, aplikasi harus mengambil snapshot yang sudah ada dan mengembalikan hasil yang konsisten.

Jangan membuat snapshot ganda hanya karena dua autosave terjadi hampir bersamaan.

## 9.7 Submission berulang

Setiap submission harus merupakan tindakan sadar murid.

Jika API menetapkan bahwa satu snapshot hanya boleh dikumpulkan sekali, pemeriksaan dilakukan oleh server.

Jangan menambahkan unique constraint `(assignment_id, student_id)` karena murid boleh mengumpulkan berkali-kali.

Pemeriksaan submission ganda berdasarkan hash harus dilakukan sesuai kontrak API.

Jika diperlukan perlindungan terhadap permintaan bersamaan, gunakan transaksi dan mekanisme penguncian yang sesuai.

## 9.8 Komentar

Sebelum menyimpan komentar:
- Pastikan submission tersedia.
- Pastikan penulis adalah guru atau pemilik submission.
- Pastikan guru memiliki akses ke kelas terkait.
- Pastikan isi komentar tidak kosong.
- Pastikan panjang komentar tidak melewati batas.

---

# 10. Yang Sengaja Tidak Ada di Database

Fitur berikut tidak termasuk v1.

### Tabel sesi

Tidak dibuat karena sesi ditangani oleh library autentikasi (Auth.js strategi JWT).

### Isi berkas `.sb3`

Tidak disimpan dalam database.

### Tabel nilai

Belum diperlukan.

Pengumpulan terakhir ditentukan melalui `submission_terakhir`.

### Tabel notifikasi

Tidak diperlukan untuk v1.

### Tabel audit log terpisah

Tidak dibuat tanpa kebutuhan nyata.

### Tabel administrator

Tidak ada peran administrator dalam v1.

### Tabel wali murid

Tidak ada akun wali murid dalam v1.

### Metadata hasil parsing `.sb3`

Tidak boleh dibuat dengan membaca arsip tersimpan pada saat halaman dibuka.

Kolom `jumlah_balok` tetap nullable sampai mekanisme pengisian yang sesuai disepakati.

### Foreign key submission ke snapshot

Tidak dibuat karena submission harus tetap hidup walaupun baris snapshot dihapus oleh retensi.

---

# 11. Keamanan dan Backup

Database menyimpan data penting, tetapi bukan isi berkas proyek.

Karena itu backup harus mencakup dua bagian:

1. PostgreSQL.
2. Object storage.

Backup database tanpa object storage tidak cukup untuk memulihkan seluruh pekerjaan murid.

Backup object storage tanpa database juga tidak cukup untuk mengetahui kepemilikan dan hubungan setiap berkas.

Jadwal backup, retensi backup, dan prosedur pemulihan harus ditetapkan sebelum aplikasi digunakan secara rutin.

Jangan mencatat informasi berikut dalam log:
- Password.
- Password hash.
- Token sesi.
- Token save intent.
- Kode undangan.
- URL bertanda tangan.
- Informasi akses privat object storage.

---

# 12. Daftar Pemeriksaan Sebelum Database Dianggap Selesai

## Struktur dan migrasi

- [ ] Ketiga migrasi berhasil dijalankan secara berurutan.
- [ ] Migrasi dapat dijalankan pada database kosong.
- [ ] Migrasi yang sudah dijalankan tidak perlu diedit.
- [ ] Semua foreign key memiliki aturan penghapusan eksplisit.
- [ ] Semua kolom waktu menggunakan `timestamptz`.

## Akun

- [ ] Guru memiliki email dan password hash.
- [ ] Email guru tidak dapat didaftarkan dua kali dengan perbedaan kapitalisasi.
- [ ] Murid memiliki `username` unik (tidak peka huruf besar/kecil) dan boleh memiliki email NULL.
- [ ] Email murid tidak dapat digunakan oleh dua akun berbeda.
- [ ] Murid dapat bergabung ke beberapa kelas dengan satu identitas.

## Sekolah dan kelas

- [ ] Guru dapat memiliki banyak sekolah.
- [ ] Kelas hanya dapat menggunakan sekolah milik guru yang sama.
- [ ] Menghapus sekolah tidak menghapus kelas.
- [ ] Mengarsipkan kelas tidak menghapus pekerjaan murid.
- [ ] Murid tidak dapat menjadi anggota kelas yang sama dua kali.

## Undangan

- [ ] Undangan memiliki waktu mulai dan berakhir.
- [ ] Undangan dapat dicabut.
- [ ] Batas pemakaian dapat NULL.
- [ ] Jumlah pemakaian tidak boleh negatif.
- [ ] Penggunaan undangan bersamaan tidak melewati batas pemakaian.
- [ ] Pencabutan undangan tidak menghapus anggota lama.

## Tugas dan pekerjaan

- [ ] Tugas menolak waktu penutupan yang lebih awal daripada waktu pembukaan.
- [ ] Submission hanya dapat dibuat untuk murid anggota kelas terkait.
- [ ] Snapshot hanya dapat dibuat untuk murid anggota kelas terkait.
- [ ] Murid dapat mengumpulkan lebih dari sekali.
- [ ] Submission lama tidak ditimpa.
- [ ] Status `terlambat` dan `perlu_tinjauan` disimpan saat kejadian.
- [ ] Hash menggunakan SHA-256 dari byte asli.
- [ ] Object key tidak digunakan ulang.
- [ ] Ukuran berkas diperiksa.
- [ ] Isi `.sb3` tidak disimpan di database.
- [ ] Save intent menyimpan `token_hash` dan hanya dapat dipakai satu kali secara atomik.

## Snapshot dan retensi

- [ ] Snapshot dengan hash sama dalam tugas dan murid yang sama tidak menghasilkan duplikasi.
- [ ] Hash sama pada murid berbeda tetap diperbolehkan.
- [ ] Snapshot baru dibuat jika isi proyek berubah, dengan `jenis_simpan` (`otomatis`/`manual`).
- [ ] Retensi mempertahankan snapshot yang pernah dikumpulkan.
- [ ] Penghapusan snapshot tidak menghapus submission.
- [ ] Penghapusan objek storage tidak merusak submission.

## Komentar

- [ ] Komentar harus memiliki tepat satu penulis.
- [ ] Komentar murid hanya dapat dibuat pada submission miliknya.
- [ ] Komentar guru diperiksa berdasarkan kepemilikan kelas.
- [ ] Komentar kosong ditolak.

## View

- [ ] `submission_terakhir` menampilkan satu pengumpulan terakhir per murid dan tugas.
- [ ] Pengumpulan lama tetap tersedia.
- [ ] Murid yang belum mengumpulkan tetap muncul dalam daftar kelas guru.

---

## 13. Kriteria Selesai

Database dianggap siap digunakan jika:

1. Seluruh migrasi berjalan bersih.
2. Seluruh relasi tabel sesuai model data.
3. Constraint mencegah data yang tidak valid.
4. Pemeriksaan kepemilikan tersedia di lapisan aplikasi.
5. Snapshot dan submission bekerja secara terpisah.
6. Retensi tidak menghilangkan pekerjaan yang sudah dikumpulkan.
7. Penyimpanan `.sb3` tidak mengubah isi arsip.
8. Seluruh pemeriksaan pada daftar di atas telah diuji.

**Prinsip utama: database harus menjaga hubungan dan integritas data, sedangkan aplikasi harus menjaga aturan bisnis dan hak akses. Keduanya tidak boleh saling menggantikan.**