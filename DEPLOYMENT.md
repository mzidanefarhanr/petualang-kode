# DEPLOYMENT.md — Panduan Deployment Online Petualang Kode v1

> Panduan menyiapkan dan menjalankan **Petualang Kode** di server online (VPS Ubuntu + Caddy/Nginx atau Platform Container seperti Docker / Railway / Fly.io / Render).

---

## 1. Kebutuhan Layanan

1. **Node.js 20+ / 22+ / 24+** (satu proses menjalankan Next.js App Router + WebSocket `/ws`).
2. **PostgreSQL 15+**.
3. **Penyimpanan Media (Gambar & Suara)**:
   - Untuk 1 server VPS/container dengan persistent disk: `MEDIA_STORAGE=local` dan `MEDIA_DIR=/var/lib/petualang-kode/media`.
   - Untuk cloud object storage (Cloudflare R2 / AWS S3 / MinIO): `MEDIA_STORAGE=s3` beserta kredensial bucket privat.
4. **Reverse Proxy HTTPS & WSS** (Caddy, Nginx, atau load balancer PaaS) yang mendukung header `Upgrade: websocket`.

---

## 2. Variabel Lingkungan Produksi (`.env`)

```dotenv
NODE_ENV=production
PORT=3000

# Database PostgreSQL 15+
DATABASE_URL=postgresql://user:password@db-host:5432/petualang_kode

# Auth.js (NextAuth) JWT
# Buat secret acak minimal 32 karakter (mis. `openssl rand -base64 32`)
AUTH_SECRET=isi-dengan-string-acak-minimal-32-karakter
AUTH_URL=https://kode.domainanda.com

# Penyimpanan Media
MEDIA_STORAGE=local
MEDIA_DIR=/var/lib/petualang-kode/media
MAX_MEDIA_SIZE_BYTES=10485760

# Kapasitas Sesi Live
MAX_LIVE_STUDENTS=20
```

Jika menggunakan penyimpanan S3-kompatibel (`MEDIA_STORAGE=s3`), tambahkan:

```dotenv
S3_ENDPOINT=https://s3.ap-southeast-1.amazonaws.com
S3_REGION=ap-southeast-1
S3_BUCKET=petualang-kode
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

---

## 3. Langkah Deployment

### 3.1 Instalasi & Migrasi Database

```bash
npm ci
npm run db:migrate
```

Untuk membuat akun Admin pertama di server produksi:

```bash
SEED_ADMIN_EMAIL="emailanda@domain.com" \
SEED_ADMIN_PASSWORD="kata-sandi-kuat-anda" \
SEED_ADMIN_NAMA="Nama Pengajar" \
npm run db:seed
```

### 3.2 Build & Menjalankan Server Produksi

```bash
npm run build
npm start
```

(`npm start` menjalankan `node --env-file-if-exists=.env scripts/server.mjs --production` pada port `3000`.)

### 3.3 Pemeriksaan Kesehatan Server (Healthcheck)

Endpoint healthcheck tersedia di:
- `GET /api/v1/health` → mengembalikan `200 { "status": "ok", "server_time": "..." }` bila aplikasi dan PostgreSQL sehat.

---

## 4. Contoh Konfigurasi Reverse Proxy (HTTPS + WebSocket `/ws`)

### Opsi A — Caddy (`Caddyfile`, otomatis HTTPS Let's Encrypt + WebSocket)

```caddyfile
kode.domainanda.com {
    reverse_proxy 127.0.0.1:3000
}
```

### Opsi B — Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name kode.domainanda.com;

    client_max_body_size 12M;

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
