-- 002_kelas.sql
-- Tabel kelas dan undangan: classes, class_members, invites.
-- Sumber kebenaran skema: DATABASE.md Bagian 5.2.

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

create table class_members (
  class_id       uuid not null references classes(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  bergabung_pada timestamptz not null default now(),

  primary key (class_id, student_id)
);

create index class_members_student_idx
  on class_members (student_id);

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
