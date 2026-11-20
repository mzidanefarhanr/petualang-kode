import {describe, expect, it} from 'vitest';
import {ApiError, assertValidUuid, errorResponse, isValidUuid} from './errors';

describe('ApiError & errorResponse', () => {
    it('mengembalikan format error standar sesuai API-CONTRACTS.md', async () => {
        const res = errorResponse(new ApiError(409, 'SESI_PENUH', 'Kelas sudah penuh.', {maks: 20}));
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body).toEqual({
            error: {
                kode: 'SESI_PENUH',
                pesan: 'Kelas sudah penuh.',
                detail: {maks: 20}
            }
        });
    });

    it('menyembunyikan error internal tak dikenal sebagai 500 KESALAHAN_SERVER', async () => {
        const res = errorResponse(new Error('Detail database rahasia'));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error.kode).toBe('KESALAHAN_SERVER');
    });

    it('memvalidasi UUID dengan benar', () => {
        expect(isValidUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
        expect(isValidUuid('invalid')).toBe(false);
        expect(() => assertValidUuid('invalid')).toThrowError(
            expect.objectContaining({status: 404, kode: 'TIDAK_DITEMUKAN'})
        );
    });
});
