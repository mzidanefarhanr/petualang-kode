import {describe, expect, it} from 'vitest';
import {ApiError, errorBody, toErrorResponse} from './errors';

describe('errorBody', () => {
    it('menyertakan kode, pesan, dan detail', () => {
        const body = errorBody(
            new ApiError(403, 'TUGAS_DITUTUP', 'Tugas sudah ditutup.', {
                ditutup_pada: '2026-11-18T09:00:00Z'
            })
        );
        expect(body).toEqual({
            error: {
                kode: 'TUGAS_DITUTUP',
                pesan: 'Tugas sudah ditutup.',
                detail: {ditutup_pada: '2026-11-18T09:00:00Z'}
            }
        });
    });

    it('tanpa detail tidak menambahkan field detail', () => {
        const body = errorBody(new ApiError(401, 'BELUM_MASUK', 'Anda belum masuk.'));
        expect(body).toEqual({error: {kode: 'BELUM_MASUK', pesan: 'Anda belum masuk.'}});
        expect('detail' in body.error).toBe(false);
    });
});

describe('toErrorResponse', () => {
    it('memakai status dan body dari ApiError', async () => {
        const response = toErrorResponse(new ApiError(404, 'BUKAN_ANGGOTA', 'Data tidak ditemukan.'));
        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: {kode: 'BUKAN_ANGGOTA', pesan: 'Data tidak ditemukan.'}
        });
    });

    it('mengubah error tak dikenal menjadi 500 KESALAHAN_INTERNAL', async () => {
        const response = toErrorResponse(new Error('boom'));
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.kode).toBe('KESALAHAN_INTERNAL');
    });
});
