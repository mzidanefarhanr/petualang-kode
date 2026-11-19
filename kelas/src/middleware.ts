import {NextResponse, type NextRequest} from 'next/server';
import {corsHeaders} from '@/lib/http/cors';
import {CSRF_COOKIE, csrfCookieOptions, newCsrfToken} from '@/lib/csrf';

/*
 * Middleware terpusat untuk seluruh endpoint /api/*:
 * - CORS eksplisit (API-CONTRACTS.md 2.2)
 * - penanganan preflight OPTIONS
 * - penanaman cookie CSRF ganda bila belum ada
 */
export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {status: 204, headers: corsHeaders(origin)});
    }

    const response = NextResponse.next();
    for (const [name, value] of Object.entries(corsHeaders(origin))) {
        response.headers.set(name, value);
    }

    if (!request.cookies.get(CSRF_COOKIE)?.value) {
        response.cookies.set(CSRF_COOKIE, newCsrfToken(), csrfCookieOptions());
    }

    return response;
}

export const config = {
    matcher: '/api/:path*'
};
