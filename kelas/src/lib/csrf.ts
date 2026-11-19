import {ApiError} from './http/errors';

/*
 * Perlindungan CSRF ganda (double-submit cookie) untuk endpoint mutasi.
 *
 * Middleware menanam cookie `csrf_token` (dapat dibaca JavaScript editor).
 * Editor mengirim nilai yang sama lewat header `X-CSRF-Token`.
 * `sendBeacon` tidak dapat menetapkan header, sehingga token juga diterima
 * lewat query string `?csrf=`.
 *
 * Berkas ini dipakai middleware (Edge runtime), karena itu tidak memakai
 * modul Node (`node:crypto`, `Buffer`). Hanya Web Crypto dan timer yang dipakai.
 */

export const CSRF_COOKIE = 'csrf_token';

export function newCsrfToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function csrfCookieOptions(): {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
    domain?: string;
} {
    return {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
    };
}

function tokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b || a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export function requestCsrfToken(request: Request): string | null {
    const header = request.headers.get('x-csrf-token');
    if (header) {
        return header;
    }
    try {
        return new URL(request.url).searchParams.get('csrf');
    } catch {
        return null;
    }
}

export function assertCsrf(request: Request, cookieValue: string | undefined): void {
    if (!tokensMatch(requestCsrfToken(request), cookieValue)) {
        throw new ApiError(403, 'CSRF_TIDAK_VALID', 'Permintaan tidak diizinkan.');
    }
}
