import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {getStorage} from '@/lib/storage';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {isUuid, ISO} from '@/lib/http/uuid';
import {readRawBytes} from '@/lib/http/body';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {listSnapshots, saveSnapshot, type SnapshotResult} from '@/server/snapshots';

const snapshotDto = (result: SnapshotResult) => ({
    snapshot_id: result.snapshot_id,
    diambil_pada: ISO(result.diambil_pada),
    isi_hash: result.isi_hash,
    ukuran_bytes: result.ukuran_bytes,
    baru: result.baru,
    terlambat: result.terlambat,
    ...(result.penyimpanan_akhir ? {penyimpanan_akhir: true} : {})
});

/*
 * GET  /api/v1/editor/projects/{assignment_id}/snapshots  (daftar, API-CONTRACTS.md 4.7)
 * POST /api/v1/editor/projects/{assignment_id}/snapshots  (simpan, API-CONTRACTS.md 4.3)
 */
export async function GET(
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

        const items = await listSnapshots({db, storage: getStorage()}, assignmentId, session!.user.id);
        return Response.json({
            snapshots: items.map(item => ({
                id: item.id,
                diambil_pada: ISO(item.diambil_pada),
                ukuran_bytes: item.ukuran_bytes,
                isi_hash: item.isi_hash,
                terlambat: false
            }))
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

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
        const saveIntentToken = request.headers.get('x-save-intent-token');

        const result = await saveSnapshot(
            {db, storage: getStorage()},
            {
                assignmentId,
                studentId: session!.user.id,
                bytes,
                jenis,
                saveIntentToken
            }
        );

        return Response.json(snapshotDto(result), {status: 201});
    } catch (error) {
        return toErrorResponse(error);
    }
}
