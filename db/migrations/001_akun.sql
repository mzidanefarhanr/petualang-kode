-- 001_akun.sql
-- Tabel akun: teachers, schools, students.
-- Sumber kebenaran skema: DATABASE.md Bagian 5.1.

create table teachers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  nama          text not null,
  dibuat_pada   timestamptz not null default now()
);

create unique index teachers_email_lower_unique
  on teachers (lower(email));

create table schools (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  nama       text not null,
  catatan    text,

  unique (id, teacher_id)
);

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
