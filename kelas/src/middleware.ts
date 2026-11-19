import {NextResponse, type NextRequest} from 'next/server';
import {corsHeaders} from '@/lib/http/cors';

/*
 * CORS terpusat untuk seluruh endpoint /api/* (API-CONTRACTS.md Bagian 2.2).
 * Menangani preflight OPTIONS dan menambahkan header CORS pada semua respons API.
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
    return response;
}

export const config = {
    matcher: '/api/:path*'
};
