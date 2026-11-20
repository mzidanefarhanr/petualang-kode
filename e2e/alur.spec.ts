import {encode} from '@auth/core/jwt';
import {expect, test} from '@playwright/test';
import {WebSocket} from 'ws';

const AUTH_SECRET = 'e2e-secret-petualang-kode-minimal-32-karakter';

test('alur lengkap Petualang Kode: Landing Page, Admin buat kelas/siswa/pelajaran, Sesi Live sinkron ke Siswa, & batas 20 siswa', async ({
    browser,
    baseURL
}) => {
    const adminContext = await browser.newContext();
    const studentContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const studentPage = await studentContext.newPage();

    // 0. Healthcheck endpoint (/api/v1/health)
    const healthRes = await adminPage.request.get('/api/v1/health');
    expect(healthRes.status()).toBe(200);
    expect(await healthRes.json()).toMatchObject({status: 'ok'});

    // 1. Buka Landing Page (/) — pastikan tidak langsung redirect ke /masuk
    await adminPage.goto('/');
    await expect(
        adminPage.getByRole('heading', {name: /Setiap anak punya cerita/i})
    ).toBeVisible();
    await expect(
        adminPage.getByRole('img', {name: /Maskot Kelinci Penjelajah/i})
    ).toBeVisible();

    // 2. Admin masuk di /masuk?tab=admin
    await adminPage.goto('/masuk?tab=admin');
    await adminPage.getByLabel('Email Admin').fill('admin@example.test');
    await adminPage.getByLabel('Kata Sandi / PIN').fill('rahasia123');
    await adminPage.getByRole('button', {name: /Masuk sebagai Admin/i}).click();
    await expect(adminPage).toHaveURL(/\/admin$/);

    // 3. Admin membuat kelas baru
    await adminPage.getByLabel('Nama Kelas').fill('Kelas Coding 5A');
    await adminPage.getByRole('button', {name: /\+ Buat Kelas/i}).click();
    await expect(adminPage.getByRole('link', {name: 'Kelas Coding 5A'})).toBeVisible();

    // 4. Admin membuat pelajaran dengan Stage 1 (Cerita) dan Stage 2 (Challenge)
    await adminPage.getByRole('link', {name: 'Pelajaran & Stage'}).click();
    await expect(adminPage).toHaveURL(/\/admin\/pelajaran$/);
    await adminPage.getByLabel('Judul Pelajaran').fill('Misi 1 — Hutan Kode');
    await adminPage.getByRole('button', {name: /\+ Buat Pelajaran/i}).click();
    await expect(adminPage).toHaveURL(/\/admin\/pelajaran\/[0-9a-f-]+$/);

    await adminPage.getByRole('button', {name: '+ Stage Cerita'}).click();
    await expect(adminPage.getByText('Stage 1 — Cerita Petualang')).toBeVisible();

    await adminPage.getByRole('button', {name: '+ Stage Challenge'}).click();
    await expect(adminPage.getByText('Stage 2 — Tantangan Blok')).toBeVisible();

    // 5. Buka halaman kelas, buat akun siswa, buat kode invite class, dan mulai sesi live
    await adminPage.getByRole('link', {name: 'Kelas & Invite'}).click();
    await adminPage.getByRole('link', {name: 'Kelas Coding 5A'}).first().click();
    await expect(adminPage).toHaveURL(/\/admin\/kelas\/[0-9a-f-]+$/);

    // Buat akun siswa budi5a
    await adminPage.getByLabel('Nama Siswa').fill('Budi Santoso');
    await adminPage.getByLabel(/Username Login/i).fill('budi5a');
    await adminPage.getByLabel(/Kata Sandi \/ PIN/i).fill('1234');
    await adminPage.getByRole('button', {name: /\+ Buat & Masukkan ke Kelas/i}).click();
    await expect(adminPage.getByText('@budi5a')).toBeVisible();

    // Buat kode invite class
    await adminPage.getByRole('button', {name: /\+ Buat Kode Undangan/i}).click();
    const copyBtn = adminPage.getByRole('button', {name: /Salin Tautan \/join\//i}).first();
    await expect(copyBtn).toBeVisible();
    const copyText = (await copyBtn.textContent()) || '';
    const kodeMatch = copyText.match(/\/join\/([A-Z0-9]+)/);
    expect(kodeMatch).not.toBeNull();
    const kode = kodeMatch![1];

    // Mulai Sesi Live
    await adminPage.getByRole('button', {name: /Mulai Sesi Live/i}).click();
    await expect(adminPage).toHaveURL(/\/admin\/live\/[0-9a-f-]+$/);
    const sessionId = adminPage.url().split('/admin/live/')[1].split('?')[0];

    // 6. Siswa membuka /join/<kode> dan masuk memakai akun buatan Admin
    await studentPage.goto(`/join/${kode}`);
    await expect(studentPage.getByRole('heading', {name: 'Kelas Coding 5A'})).toBeVisible();
    await studentPage.getByLabel('Nama Pengguna Siswa').fill('budi5a');
    await studentPage.getByLabel('Kata Sandi / PIN').fill('1234');
    await studentPage.getByRole('button', {name: /Masuk & Gabung Kelas/i}).click();

    await expect(studentPage).toHaveURL(/\/kelas\/[0-9a-f-]+\/live$/);
    // Layar siswa otomatis terkunci di Stage 1 (Cerita)
    await expect(studentPage.getByText('Stage 1 dari 2')).toBeVisible();
    await expect(
        studentPage.getByRole('heading', {name: 'Stage 1 — Cerita Petualang'})
    ).toBeVisible();

    // 7. Admin memutar cerita -> layar siswa menampilkan indikator cerita sedang diputar
    await adminPage.getByRole('button', {name: /Putar Cerita di Layar Siswa/i}).click();
    await expect(
        studentPage.getByText(/Cerita sedang diputar oleh gurumu/i)
    ).toBeVisible();

    // 8. Admin berpindah ke Stage 2 (Challenge) -> layar siswa otomatis berpindah ke Stage 2
    await adminPage.getByRole('button', {name: /Stage Berikutnya/i}).click();
    await expect(studentPage.getByText('Stage 2 dari 2')).toBeVisible();
    await expect(
        studentPage.getByRole('heading', {name: 'Stage 2 — Tantangan Blok'})
    ).toBeVisible();

    // 9. Admin mengunci challenge -> layar siswa menampilkan overlay kunci, lalu Admin membuka kunci
    await adminPage.getByRole('button', {name: /Kunci Interaksi Siswa/i}).click();
    await expect(
        studentPage.getByRole('heading', {name: /Perhatikan Penjelasan Gurumu Dulu Ya/i})
    ).toBeVisible();

    await adminPage.getByRole('button', {name: /Buka Interaksi Siswa/i}).click();
    await expect(
        studentPage.getByRole('heading', {name: /Perhatikan Penjelasan Gurumu Dulu Ya/i})
    ).toBeHidden();

    // 10. Siswa menyusun blok solusi pada Stage 2 dan menekan Jalankan Kode
    await studentPage.getByRole('button', {name: /\+ → MAJU/i}).click();
    await studentPage.getByRole('button', {name: /\+ ⭐ AMBIL BINTANG/i}).click();
    await studentPage.getByRole('button', {name: /\+ ⤴ LOMPAT/i}).click();
    await studentPage.getByRole('button', {name: /\+ → MAJU/i}).click();
    await studentPage.getByRole('button', {name: /Jalankan Kode/i}).click();

    await expect(
        studentPage.getByRole('heading', {name: /Misi Berhasil Diselesaikan!/i})
    ).toBeVisible();

    // Panel Admin otomatis memperbarui status budi5a menjadi "Selesai ✓"
    const studentMonitorCard = adminPage.locator('[data-student-monitor="budi5a"]');
    await expect(studentMonitorCard).toContainText('Selesai ✓');

    // 11. Uji kapasitas 20 siswa per sesi: daftarkan 20 siswa tambahan, hubungkan 19 siswa lagi
    // (bersama budi5a = 20 siswa aktif), lalu pastikan siswa ke-21 ditolak dengan close code 4009!
    const extraStudentIds: string[] = [];
    for (let i = 2; i <= 21; i++) {
        const uname = `siswa${String(i).padStart(2, '0')}`;
        const created = await adminPage.evaluate(
            async ({uname, classId}) => {
                const res = await fetch('/api/v1/admin/students', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        nama: `Siswa ${uname}`,
                        username: uname,
                        password: '1234',
                        class_id: classId
                    })
                });
                const body = await res.json();
                return body.student.id as string;
            },
            {
                uname,
                classId: studentPage.url().split('/kelas/')[1].split('/live')[0]
            }
        );
        extraStudentIds.push(created);
    }

    const wsHost = new URL(baseURL || 'http://localhost:3100').host;
    const openSockets: WebSocket[] = [];

    try {
        // Hubungkan 19 siswa (indeks 0..18) sehingga total siswa online = 1 (budi5a) + 19 = 20
        for (let i = 0; i < 19; i++) {
            const token = await encode({
                secret: AUTH_SECRET,
                salt: 'sesi',
                token: {uid: extraStudentIds[i], role: 'student'}
            });
            const ws = new WebSocket(`ws://${wsHost}/ws?session_id=${sessionId}`, {
                headers: {Cookie: `sesi=${token}`}
            });
            await new Promise<void>((resolve, reject) => {
                ws.once('open', () => resolve());
                ws.once('error', reject);
            });
            openSockets.push(ws);
        }

        // Koneksi siswa ke-21 (indeks 19) wajib ditolak dengan close code 4009 (SESI_PENUH)
        const token21 = await encode({
            secret: AUTH_SECRET,
            salt: 'sesi',
            token: {uid: extraStudentIds[19], role: 'student'}
        });
        const closeCode = await new Promise<number>(resolve => {
            const ws21 = new WebSocket(`ws://${wsHost}/ws?session_id=${sessionId}`, {
                headers: {Cookie: `sesi=${token21}`}
            });
            ws21.on('close', code => resolve(code));
        });
        expect(closeCode).toBe(4009);
    } finally {
        for (const s of openSockets) {
            s.close();
        }
    }

    await adminContext.close();
    await studentContext.close();
});
