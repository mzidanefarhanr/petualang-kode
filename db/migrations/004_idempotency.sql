-- 004_idempotency.sql
-- Tabel pendukung idempotensi endpoint mutasi (API-CONTRACTS.md Bagian 5.4).
-- Request yang diulang dengan Idempotency-Key yang sama tidak membuat baris baru;
-- server mengembalikan hasil operasi sebelumnya berdasarkan resource_id.
-- Sumber kebenaran skema: DATABASE.md Bagian 5.4.

create table idempotency_keys (
  kode        text not null,
  scope       text not null,
  resource_id uuid not null,
  dibuat_pada timestamptz not null default now(),

  primary key (kode, scope)
);
