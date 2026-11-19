-- 003_tugas_dan_pekerjaan.sql
-- Tabel tugas dan pekerjaan: assignments, submissions, snapshots, save_intents, comments,
-- serta view submission_terakhir.
-- Sumber kebenaran skema: DATABASE.md Bagian 5.3 dan Bagian 6.

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
