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
