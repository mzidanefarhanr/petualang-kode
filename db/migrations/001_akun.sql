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
