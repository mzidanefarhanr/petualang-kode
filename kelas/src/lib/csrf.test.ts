import {describe, expect, it} from 'vitest';
import {assertCsrf, newCsrfToken} from './csrf';
import {ApiError} from './http/errors';

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, {headers});

describe('newCsrfToken', () => {
    it('menghasilkan token hex 64 karakter', () => {
        expect(newCsrfToken()).toMatch(/^[0-9a-f]{64}$/);
    });

    it('selalu berbeda', () => {
        expect(newCsrfToken()).not.toBe(newCsrfToken());
    });
});

describe('assertCsrf', () => {
    it('lolos saat header cocok dengan cookie', () => {
        expect(() => assertCsrf(req('http://x/', {'x-csrf-token': 'abc'}), 'abc')).not.toThrow();
    });

    it('tolak saat nilai tidak cocok', () => {
        const error = (() => {
            try {
                assertCsrf(req('http://x/', {'x-csrf-token': 'abc'}), 'xyz');
                return null;
            } catch (e) {
                return e as ApiError;
            }
        })();
        expect(error).toBeInstanceOf(ApiError);
        expect(error!.status).toBe(403);
        expect(error!.kode).toBe('CSRF_TIDAK_VALID');
    });

    it('tolak saat cookie tidak ada', () => {
        expect(() => assertCsrf(req('http://x/', {'x-csrf-token': 'abc'}), undefined)).toThrow(ApiError);
    });

    it('menerima token lewat query string (sendBeacon)', () => {
        expect(() => assertCsrf(req('http://x/?csrf=abc'), 'abc')).not.toThrow();
    });
});
