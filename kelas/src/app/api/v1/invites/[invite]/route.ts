import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {toErrorResponse} from '@/lib/http/errors';
import {ISO} from '@/lib/http/uuid';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {getInviteInfo, revokeInvite} from '@/server/invites';

/*
 * GET    /api/v1/invites/{kode}        — informasi undangan publik (tanpa sesi)
 * DELETE /api/v1/invites/{invite_id}   — cabut undangan (guru pemilik kelas)
 *
 * Parameter segmen sama ([invite]) dipakai sebagai `kode` pada GET dan sebagai
 * `invite_id` pada DELETE. Keduanya berbeda metode dan format nilainya.
 */
export async function GET(request: NextRequest, context: {params: Promise<{invite: string}>}) {
    try {
        const {invite: kode} = await context.params;
        const info = await getInviteInfo(getPool(), kode);
        return Response.json({
            kode: info.kode,
            kelas: info.kelas,
            berlaku_dari: ISO(info.berlaku_dari),
            berlaku_sampai: ISO(info.berlaku_sampai),
            status: info.status
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(request: NextRequest, context: {params: Promise<{invite: string}>}) {
    try {
        const {invite: inviteId} = await context.params;

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', inviteId});
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);

        await revokeInvite(db, inviteId);
        return new Response(null, {status: 204});
    } catch (error) {
        return toErrorResponse(error);
    }
}
