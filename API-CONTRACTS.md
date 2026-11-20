# API-CONTRACTS.md — Kontrak REST API & WebSocket Petualang Kode v1

> Semua endpoint REST berada di bawah `/api/v1` dengan autentikasi cookie JWT Auth.js (`HttpOnly; SameSite=Lax`).
> Koneksi real-time menggunakan WebSocket di `/ws?session_id=<uuid>`.

---

## 1. Konvensi Umum

### 1.1 Format Error Seragam

```json
{
  "error": {
    "kode": "SESI_PENUH",
    "pesan": "Kelas sudah penuh (maksimal 20 siswa).",
    "detail": {}
  }
}
```

### 1.2 Kode HTTP

- `200` / `201` / `204`: berhasil.
- `400` / `422`: payload atau skema tidak valid.
- `401`: belum login (`BELUM_MASUK`).
- `403`: peran tidak sesuai (`PERAN_TIDAK_SESUAI`) atau aksi dikunci Admin (`STAGE_DIKUNCI`).
- `404`: sumber daya tidak ada atau bukan milik pemanggil.
- `409`: konflik data (misal `username` sudah dipakai, kelas sudah memiliki sesi aktif, sesi penuh 20 siswa).
- `410`: invite class sudah kedaluwarsa atau dicabut.
- `413`: ukuran file media melebihi batas (10 MB).

### 1.3 Keamanan & Kepemilikan

- Setiap endpoint Admin wajib memeriksa `session.user.role === 'admin'` dan menelusuri kepemilikan ke `admins.id`.
- Setiap endpoint Siswa wajib memeriksa `session.user.role === 'student'` dan keanggotaan `class_members`.
- Siswa **tidak dapat** meminta konfigurasi stage lain di luar `active_stage_id` pada `live_sessions` yang sedang aktif.

---

## 2. Endpoint Admin (`/api/v1/admin/*`)

### 2.1 Kelas & Anggota Siswa

- `GET /api/v1/admin/classes` — daftar kelas aktif milik Admin beserta jumlah siswa dan status sesi live aktif.
- `POST /api/v1/admin/classes` — membuat kelas baru (`{ nama, deskripsi? }`).
- `GET /api/v1/admin/classes/{class_id}` — detail kelas, daftar anggota siswa, daftar invite class, dan sesi live aktif.
- `PATCH /api/v1/admin/classes/{class_id}` — mengubah nama/deskripsi atau mengarsipkan kelas.

### 2.2 Akun Siswa (Dibuat Hanya oleh Admin)

- `GET /api/v1/admin/students` — daftar semua siswa milik Admin (bisa difilter kelas).
- `POST /api/v1/admin/students` — membuat akun siswa baru (`{ nama, username, password, class_id? }`) — `password` di-hash dengan `bcryptjs`.
- `PATCH /api/v1/admin/students/{student_id}` — ubah nama, reset password/PIN, atau arsipkan siswa.
- `POST /api/v1/admin/classes/{class_id}/members` — memasukkan siswa yang sudah ada ke kelas (`{ student_id }`).
- `DELETE /api/v1/admin/classes/{class_id}/members/{student_id}` — mengeluarkan siswa dari kelas.

### 2.3 Invite Class

- `POST /api/v1/admin/classes/{class_id}/invites` — membuat tautan/kode undangan kelas (`{ berlaku_jam? }`, default 24 jam).
- `DELETE /api/v1/admin/invites/{invite_id}` — mencabut invite class (`dicabut_pada = now()`).

### 2.4 Aset Media (Gambar & Suara)

- `GET /api/v1/admin/media?jenis=image|audio` — daftar aset media milik Admin.
- `POST /api/v1/admin/media` (`multipart/form-data`) — unggah file gambar (`png/jpg/jpeg/webp/gif`) atau suara (`mp3/wav/ogg`), maks. 10 MB (`{ file, nama, jenis }`).
- `DELETE /api/v1/admin/media/{asset_id}` — hapus aset (ditolak `409` bila masih dirujuk oleh stage).

### 2.5 Pelajaran & Stage (`story` / `challenge`)

- `GET /api/v1/admin/lessons` — daftar pelajaran milik Admin beserta jumlah stage.
- `POST /api/v1/admin/lessons` — buat pelajaran baru (`{ judul, deskripsi? }`).
- `GET /api/v1/admin/lessons/{lesson_id}` — detail pelajaran + daftar stage terurut berdasarkan `urutan`.
- `PATCH /api/v1/admin/lessons/{lesson_id}` / `DELETE /api/v1/admin/lessons/{lesson_id}`.
- `POST /api/v1/admin/lessons/{lesson_id}/stages` — tambah stage baru (`{ judul, tipe: 'story' | 'challenge', config }`).
- `PATCH /api/v1/admin/stages/{stage_id}` — sunting judul atau `config` (timeline cerita, suara, atau peta challenge).
- `DELETE /api/v1/admin/stages/{stage_id}` — hapus stage dan rapikan `urutan`.
- `POST /api/v1/admin/lessons/{lesson_id}/stages/reorder` — ubah urutan stage (`{ stage_ids: string[] }`).

### 2.6 Sesi Live & Kontrol Layar

- `POST /api/v1/admin/live-sessions` — mulai sesi live (`{ class_id, lesson_id, active_stage_id? }`). Maks. 1 sesi aktif per kelas.
- `GET /api/v1/admin/live-sessions/{session_id}` — status sesi live, daftar 20 slot siswa (online/offline + progres stage aktif).
- `PATCH /api/v1/admin/live-sessions/{session_id}/control` — ubah kontrol live oleh Admin:
  - `{ action: 'set_stage', stage_id }`
  - `{ action: 'playback', playback_status: 'playing' | 'paused' | 'idle', offset_ms? }`
  - `{ action: 'set_lock', challenge_locked: boolean }`
  - Server memperbarui DB lalu menyiarkan `session:state` via WebSocket ke seluruh siswa di sesi tersebut.
- `POST /api/v1/admin/live-sessions/{session_id}/end` — akhiri sesi live (`status = 'ended'`, `diakhiri_pada = now()`) dan siarkan `session:ended`.

---

## 3. Endpoint Bersama & Siswa

### 3.1 Media Terproteksi

- `GET /api/v1/media/{asset_id}` — mengembalikan stream gambar/audio dengan `Content-Type` yang tepat; hanya dapat diakses oleh Admin pemilik atau Siswa yang terautentikasi.

### 3.2 Invite Class & Ruang Siswa

- `GET /api/v1/invites/{kode}` — info publik aman tentang invite class (`kelas_nama`, `admin_nama`, `aktif: boolean`) untuk menampilkan halaman `/join/{kode}`.
- `GET /api/v1/student/classes/{class_id}/live` — memeriksa apakah ada `live_session` aktif untuk kelas di mana siswa terdaftar sebagai anggota, serta mengembalikan state awal stage aktif.
- `POST /api/v1/live-sessions/{session_id}/progress` — dipanggil siswa saat menekan **Jalankan** pada stage `challenge`:
  - Payload: `{ stage_id, actions: ChallengeAction[], workspace_json?: unknown }`.
  - Server memverifikasi:
    1. `session.user.role === 'student'` & anggota kelas.
    2. `live_sessions.status === 'active'`.
    3. `stage_id === live_sessions.active_stage_id` (siswa tidak bisa mengirim progres stage lain!).
    4. `live_sessions.challenge_locked === false`.
  - Server menjalankan evaluator deterministik atas `actions`, menyimpan `attempts + 1`, `status` (`completed` / `in_progress`), `blocks_used`, dan menyiarkan `student:progress` ke Admin via WebSocket.

---

## 4. Kontrak WebSocket (`/ws?session_id=<uuid>`)

### 4.1 Handshake & Kapasitas

- Browser otomatis mengirim cookie sesi `HttpOnly` saat membuka koneksi `wss://.../ws?session_id=<uuid>`.
- Server memverifikasi JWT cookie:
  - Jika Admin pemilik sesi -> bergabung sebagai pengendali (`admin`).
  - Jika Siswa anggota kelas sesi -> cek jumlah koneksi siswa unik saat ini; jika sudah **20 siswa** dan siswa ini belum terhubung -> tolak dengan close code `4009` (`SESI_PENUH`).

### 4.2 Event Server -> Klien

- `session:state` (dikirim saat baru terhubung dan setiap kali Admin mengubah kontrol):
  ```json
  {
    "type": "session:state",
    "payload": {
      "session_id": "...",
      "status": "active",
      "active_stage": {
        "id": "...",
        "urutan": 1,
        "total_stages": 5,
        "judul": "Mengenal Petualang",
        "tipe": "story",
        "config": { "..." : "..." }
      },
      "playback": {
        "status": "playing",
        "offset_ms": 0,
        "server_time_ms": 1795159378000
      },
      "challenge_locked": false
    }
  }
  ```
- `session:presence` (khusus ke Admin): daftar siswa online/offline saat ini (maks. 20).
- `student:progress` (khusus ke Admin): pembaruan status siswa saat menjalankan blok challenge (`student_id`, `status`, `attempts`, `blocks_used`).
- `session:ended`: memberi tahu semua siswa bahwa sesi pembelajaran telah diakhiri oleh Admin.

### 4.3 Event Klien -> Server

- Hanya Admin yang boleh mengirim pesan kontrol (`admin:set_stage`, `admin:playback`, `admin:set_lock`, `admin:end_session`). Pesan kontrol yang dikirim oleh koneksi ber-peran `student` **diabaikan/ditolak** oleh server.
- Klien siswa dapat mengirim `ping` / heartbeat berkala.
