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
