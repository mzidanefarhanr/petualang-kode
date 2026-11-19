import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {getStorage} from '@/lib/storage';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {isUuid, ISO} from '@/lib/http/uuid';
import {isJsonRequest, readRawBytes} from '@/lib/http/body';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {createSubmission, type CreateSubmissionInput} from '@/server/submissions';

/*
 * POST /api/v1/assignments/{assignment_id}/submissions (API-CONTRACTS.md 5.1)
 * Tombol Kumpulkan. Mendukung sumber `snapshot_id` atau biner `.sb3`,
 * pengumpulan berulang, dan Idempotency-Key.
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

        const idempotencyKey = request.headers.get('idempotency-key');

        let source: Pick<CreateSubmissionInput, 'snapshotId' | 'bytes' | 'catatanSiswa'>;
        if (isJsonRequest(request)) {
            const body = (await request.json()) as {snapshot_id?: unknown; catatan_siswa?: unknown};
            source = {
                snapshotId: typeof body?.snapshot_id === 'string' ? body.snapshot_id : null,
                catatanSiswa: typeof body?.catatan_siswa === 'string' ? body.catatan_siswa : null
            };
        } else {
            source = {bytes: await readRawBytes(request)};
        }

        const result = await createSubmission(
            {db, storage: getStorage()},
            {assignmentId, studentId: session!.user.id, idempotencyKey, ...source}
        );

        return Response.json(
            {
                submission_id: result.submission_id,
                dikumpulkan_pada: ISO(result.dikumpulkan_pada),
                terlambat: result.terlambat,
                perlu_tinjauan: result.perlu_tinjauan,
                urutan_ke: result.urutan_ke
            },
            {status: 201}
        );
    } catch (error) {
        return toErrorResponse(error);
    }
}
