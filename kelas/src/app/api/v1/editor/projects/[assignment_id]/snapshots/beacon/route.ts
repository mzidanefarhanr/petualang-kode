import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {getStorage} from '@/lib/storage';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {isUuid} from '@/lib/http/uuid';
import {readRawBytes} from '@/lib/http/body';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {saveSnapshot} from '@/server/snapshots';

/*
 * POST /api/v1/editor/projects/{assignment_id}/snapshots/beacon
 * Fallback `navigator.sendBeacon`. Memakai pemeriksaan izin dan aturan tenggat
 * yang sama; tidak boleh menjadi jalan pintas melewati tenggat (API-CONTRACTS.md 4.6).
 *
 * `sendBeacon` tidak dapat membaca respons, sehingga server hanya mengembalikan 204.
 * Token CSRF diterima lewat query string `?csrf=` karena header tak dapat ditetapkan.
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

        const jenis = request.nextUrl.searchParams.get('jenis') === 'manual' ? 'manual' : 'otomatis';
        const bytes = await readRawBytes(request);
        const saveIntentToken = request.nextUrl.searchParams.get('save_intent') ?? null;

        await saveSnapshot(
            {db, storage: getStorage()},
            {assignmentId, studentId: session!.user.id, bytes, jenis, saveIntentToken}
        );

        return new Response(null, {status: 204});
    } catch (error) {
        return toErrorResponse(error);
    }
}
