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
