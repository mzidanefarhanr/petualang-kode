import type {NextRequest} from 'next/server';
import {getPool} from '@/lib/db';
import {toErrorResponse} from '@/lib/http/errors';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {joinViaInvite} from '@/server/invites';

/*
 * POST /api/v1/invites/{kode}/join
 * Pendaftaran murid lewat undangan (publik). Atomik terhadap batas pemakaian.
 */
export async function POST(request: NextRequest, context: {params: Promise<{invite: string}>}) {
    try {
        const {invite: kode} = await context.params;
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);

        const body = (await request.json()) as {
            nama?: unknown;
            username?: unknown;
            email?: unknown;
            password?: unknown;
        };

        const result = await joinViaInvite(getPool(), {
            kode,
            nama: body?.nama,
            username: body?.username,
            email: body?.email,
            password: body?.password
        });

        return Response.json(result, {status: 201});
    } catch (error) {
        return toErrorResponse(error);
    }
}
