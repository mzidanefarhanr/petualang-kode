# DATABASE.md — Skema Database Petualang Kode v1

> Dokumen ini merupakan sumber kebenaran untuk skema database **Petualang Kode** pada PostgreSQL 15+.
>
> SQL dalam berkas migrasi berurutan (`db/migrations/`) harus mengikuti dokumen ini. Migrasi yang sudah pernah dijalankan tidak boleh diubah; perubahan struktur wajib melalui migrasi baru.

---

## 1. Konvensi Database

- **Waktu**: seluruh kolom waktu memakai `timestamptz` dengan nilai server/database (`now()`).
- **Primary Key**: seluruh tabel utama memakai `uuid primary key default gen_random_uuid()`.
- **Penghapusan**: gunakan soft-archive (`diarsipkan_pada`, `dicabut_pada`) untuk kelas, siswa, dan undangan agar riwayat sesi tetap terjaga.
- **Kepemilikan**: rantai relasi selalu bermuara ke `admins.id` melalui foreign key komposit jika dibutuhkan.
- **Biner media**: file gambar dan suara tidak disimpan di PostgreSQL; database hanya menyimpan metadata (`object_key`, `mime_type`, `ukuran_bytes`) dan `object_key` hanya dipakai di server.

---

## 2. Peta Relasi

```text
admins
  ├── media_assets
  ├── students
  ├── classes
  │     ├── class_members ─── students
  │     ├── class_invites
  │     └── live_sessions ─── lessons
  │           └── student_stage_progress
  └── lessons
        └── stages
```

---

## 3. Daftar Migrasi

```text
db/migrations/
├── 001_akun.sql
├── 002_kelas.sql
├── 003_materi_dan_media.sql
└── 004_sesi_live.sql
```

### 3.1 Pelacakan Migrasi (`schema_migrations`)

```sql
create table if not exists schema_migrations (
  versi text primary key,
  diterapkan_pada timestamptz not null default now()
);
```

---

## 4. Struktur Tabel

### 4.1 Migrasi `001_akun.sql`

```sql
create extension if not exists pgcrypto;

create table admins (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  password_hash text not null,
  nama          text not null,
  dibuat_pada   timestamptz not null default now()
);

create unique index admins_email_lower_unique
  on admins (lower(email));

create table students (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references admins(id) on delete cascade,
  username        text not null,
  nama            text not null,
  password_hash   text not null,
  diarsipkan_pada timestamptz,
  dibuat_pada     timestamptz not null default now(),

  unique (id, admin_id),
  check (length(trim(username)) >= 3)
);

create unique index students_username_lower_unique
  on students (lower(username));

create index students_admin_idx
  on students (admin_id);
```

Catatan desain:
- Akun `students` dibuat hanya oleh `admin` (`admin_id` wajib ada).
- Siswa login menggunakan `username` (tidak peka huruf besar/kecil) + kata sandi/PIN yang ditetapkan Admin.

### 4.2 Migrasi `002_kelas.sql`

```sql
create table classes (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references admins(id) on delete cascade,
  nama            text not null,
  deskripsi       text,
  diarsipkan_pada timestamptz,
  dibuat_pada     timestamptz not null default now(),

  unique (id, admin_id)
);

create index classes_admin_idx
  on classes (admin_id);

create table class_members (
  class_id       uuid not null references classes(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  bergabung_pada timestamptz not null default now(),

  primary key (class_id, student_id)
);

create index class_members_student_idx
  on class_members (student_id);

create table class_invites (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id) on delete cascade,
  kode           text not null unique,
  berlaku_dari   timestamptz not null default now(),
  berlaku_sampai timestamptz not null,
  dicabut_pada   timestamptz,
  dibuat_pada    timestamptz not null default now(),

  check (berlaku_sampai > berlaku_dari)
);

create index class_invites_class_idx
  on class_invites (class_id);
```

Catatan desain:
- `class_invites` berfungsi sebagai tautan/kode kelas (`/join/<kode>`) untuk mengarahkan siswa yang akunnya sudah dibuat Admin agar masuk ke kelas & sesi live.

### 4.3 Migrasi `003_materi_dan_media.sql`

```sql
create table media_assets (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references admins(id) on delete cascade,
  nama         text not null,
  jenis        text not null check (jenis in ('image', 'audio')),
  mime_type    text not null,
  ukuran_bytes bigint not null check (ukuran_bytes > 0 and ukuran_bytes <= 10485760),
  object_key   text not null unique,
  dibuat_pada  timestamptz not null default now()
);

create index media_assets_admin_jenis_idx
  on media_assets (admin_id, jenis, dibuat_pada desc);

create table lessons (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references admins(id) on delete cascade,
  judul           text not null,
  deskripsi       text,
  dibuat_pada     timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),

  unique (id, admin_id)
);

create index lessons_admin_idx
  on lessons (admin_id, dibuat_pada desc);

create table stages (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null references lessons(id) on delete cascade,
  urutan          int not null check (urutan >= 1),
  judul           text not null,
  tipe            text not null check (tipe in ('story', 'challenge')),
  config          jsonb not null default '{}'::jsonb,
  dibuat_pada     timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),

  unique (id, lesson_id),
  constraint stages_lesson_urutan_unique unique (lesson_id, urutan) deferrable initially deferred
);

create index stages_lesson_idx
  on stages (lesson_id, urutan);
```

Catatan desain:
- `stages.config` menyimpan konfigurasi terstruktur sesuai `tipe`:
  - Untuk `story`: `duration_ms`, `background_asset_id`, `actors[]`, `timeline[]` (event `move`, `dialogue`, `audio`).
  - Untuk `challenge`: `grid` (`cols`, `rows`, `walls`, `hazards`, `stars`, `goal`, `start`), `character_asset_id`, `allowed_blocks[]`, `ideal_blocks`, `instruction`, `sounds` (`step`, `collect`, `win`, `fail`).
- Constraint `stages_lesson_urutan_unique` dibuat `deferrable initially deferred` agar penukaran urutan stage (`Stage 1 <-> Stage 2`) dalam satu transaksi SQL berjalan mulus.

### 4.4 Migrasi `004_sesi_live.sql`

```sql
create table live_sessions (
  id                  uuid primary key default gen_random_uuid(),
  admin_id            uuid not null references admins(id) on delete cascade,
  class_id            uuid not null,
  lesson_id           uuid not null,
  active_stage_id     uuid not null,
  status              text not null check (status in ('active', 'ended')) default 'active',
  playback_status     text not null check (playback_status in ('idle', 'playing', 'paused')) default 'idle',
  playback_offset_ms  int not null default 0 check (playback_offset_ms >= 0),
  playback_updated_at timestamptz not null default now(),
  challenge_locked    boolean not null default false,
  maks_siswa          int not null default 20 check (maks_siswa between 1 and 20),
  dimulai_pada        timestamptz not null default now(),
  diakhiri_pada       timestamptz,

  foreign key (class_id, admin_id) references classes(id, admin_id) on delete cascade,
  foreign key (lesson_id, admin_id) references lessons(id, admin_id) on delete cascade,
  foreign key (active_stage_id, lesson_id) references stages(id, lesson_id)
);

create unique index live_sessions_one_active_per_class
  on live_sessions (class_id)
  where status = 'active';

create index live_sessions_admin_idx
  on live_sessions (admin_id, dimulai_pada desc);

create table student_stage_progress (
  id              uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references live_sessions(id) on delete cascade,
  stage_id        uuid not null references stages(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  status          text not null check (status in ('in_progress', 'completed')) default 'in_progress',
  attempts        int not null default 0 check (attempts >= 0),
  blocks_used     int,
  program_json    jsonb,
  completed_at    timestamptz,
  updated_at      timestamptz not null default now(),

  unique (live_session_id, stage_id, student_id)
);

create index student_stage_progress_session_idx
  on student_stage_progress (live_session_id, stage_id);
```

Catatan desain:
- Satu kelas hanya boleh memiliki **1 sesi live aktif** pada satu waktu (`live_sessions_one_active_per_class`).
- `maks_siswa` default dan maksimal **20**.
- Composite foreign key memastikan Admin tidak bisa memulai sesi menggunakan kelas/pelajaran/stage yang tidak cocok atau bukan miliknya.
