import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {getStorage} from '@/lib/storage';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {isUuid, ISO} from '@/lib/http/uuid';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {createSaveIntent} from '@/server/snapshots';

/*
 * POST /api/v1/editor/projects/{assignment_id}/save-intents
 * Mendaftarkan satu perubahan terakhir sebelum tenggat (API-CONTRACTS.md 4.4).
 */
export async function POST(
    request: NextRequest,
    context: {params: Promise<{assignment_id: string}>}
) {
    try {
        const {assignment_id: assignmentId} = await context.params;
        if (!isUuid(assignmentId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'assignment_id tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'murid', assignmentId});
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);

        const body = (await request.json()) as {isi_hash?: unknown; ukuran_bytes?: unknown};
        if (typeof body?.isi_hash !== 'string' || typeof body?.ukuran_bytes !== 'number') {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'isi_hash dan ukuran_bytes wajib diisi.');
        }

        const result = await createSaveIntent(
            {db, storage: getStorage()},
            {
                assignmentId,
                studentId: session!.user.id,
                isiHash: body.isi_hash,
                ukuran: body.ukuran_bytes
            }
        );

        return Response.json(
            {
                save_intent_id: result.save_intent_id,
                upload_token: result.upload_token,
                berlaku_sampai: ISO(result.berlaku_sampai),
                maks_penggunaan: result.maks_penggunaan
            },
            {status: 201}
        );
    } catch (error) {
        return toErrorResponse(error);
    }
}
