import {expect, test} from '@playwright/test';

const APP = 'http://localhost:3000';

function dtLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
        date.getMinutes()
    )}`;
}

/*
 * Alur utama (TESTING.md 9.3):
 * guru -> kelas & undangan -> murid join -> tugas -> editor simpan -> kumpulkan
 * -> guru lihat daftar pengumpulan & riwayat.
 */
test('alur kelas sampai pengumpulan', async ({browser}) => {
    const kelas = await browser.newContext();
    const guru = await kelas.newPage();

    // 1. Guru masuk.
    await guru.goto('/masuk');
    await guru.getByRole('button', {name: 'Guru'}).click();
    await guru.fill('input[name="email"]', 'guru@example.test');
    await guru.fill('input[name="password"]', 'rahasia123');
    await guru.getByRole('button', {name: 'Masuk'}).click();
    await expect(guru).toHaveURL(/\/guru$/);

    // 2. Buat kelas.
    const namaKelas = `Kelas E2E ${Date.now()}`;
    await guru.fill('input[name="nama"]', namaKelas);
    await guru.getByRole('button', {name: 'Buat kelas'}).click();
    await guru.getByRole('link', {name: new RegExp(namaKelas)}).click();
    await expect(guru).toHaveURL(/\/guru\/kelas\/[0-9a-f-]+$/);

    // 3. Buat tugas (jendela sedang dibuka).
    await guru.fill('input[name="judul"]', 'Tugas E2E');
    await guru.fill('input[name="dibuka_pada"]', dtLocal(new Date(Date.now() - 3600_000)));
    await guru.fill('input[name="ditutup_pada"]', dtLocal(new Date(Date.now() + 2 * 3600_000)));
    await guru.getByRole('button', {name: 'Buat tugas'}).click();
    await expect(guru.getByText('Tugas E2E')).toBeVisible();

    // 4. Buat undangan dan ambil kodenya.
    await guru.fill('input[name="berlaku_sampai"]', dtLocal(new Date(Date.now() + 24 * 3600_000)));
    await guru.getByRole('button', {name: 'Buat undangan'}).click();
    const kode = (await guru.locator('div.font-mono').first().textContent())?.trim() ?? '';
    expect(kode).toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);

    // 5. Murid bergabung lewat tautan undangan.
    const muridCtx = await browser.newContext();
    const murid = await muridCtx.newPage();
    await murid.goto(`/join/${kode}`);
    await expect(murid.getByText(/Kamu diundang ke kelas/)).toBeVisible();
    await murid.fill('input[name="nama"]', 'Rani E2E');
    await murid.fill('input[name="username"]', `rani${Date.now() % 100000}`);
    await murid.fill('input[name="password"]', 'rahasia123');
    await murid.getByRole('button', {name: 'Mulai belajar'}).click();
    await expect(murid).toHaveURL(/\/tugas$/);

    // 6. Buka editor.
    await murid.getByRole('link', {name: 'Kerjakan'}).click();
    await expect(murid).toHaveURL(/localhost:8601/);
    await expect(murid.locator('#btn-save')).toBeVisible({timeout: 60_000});
    await expect(murid.locator('#status')).toHaveText('Tersimpan', {timeout: 60_000});

    // 7. Simpan manual -> snapshot.
    const saveResponse = murid.waitForResponse(
        response => response.url().includes('/snapshots') && response.request().method() === 'POST'
    );
    await murid.locator('#btn-save').click();
    expect((await saveResponse).status()).toBe(201);

    // 8. Kumpulkan.
    murid.once('dialog', dialog => dialog.accept('Sudah selesai, Pak.'));
    const submitResponse = murid.waitForResponse(
        response => response.url().includes('/submissions') && response.request().method() === 'POST'
    );
    await murid.locator('#btn-kumpul').click();
    expect((await submitResponse).status()).toBe(201);
    await expect(murid.locator('#status')).toContainText('Sudah dikumpulkan');

    // 9. Guru melihat daftar pengumpulan dan riwayat.
    await guru.getByRole('link', {name: 'Lihat nilai'}).click();
    await expect(guru).toHaveURL(/\/tugas\/[0-9a-f-]+$/);
    await expect(guru.getByText('Rani E2E')).toBeVisible();
    await expect(guru.getByText('1 kali')).toBeVisible();

    await guru.getByRole('link', {name: 'Riwayat'}).click();
    await expect(guru).toHaveURL(/\/murid\/[0-9a-f-]+$/);
    await expect(guru.getByText('Pengumpulan').first()).toBeVisible();
    await expect(guru.getByRole('link', {name: 'Unduh'}).first()).toBeVisible();

    await muridCtx.close();
    await kelas.close();
});
