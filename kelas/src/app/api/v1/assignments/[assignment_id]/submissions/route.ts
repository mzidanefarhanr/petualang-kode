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
import {listSubmissionsForTeacher} from '@/server/assignments';

/*
 * GET  /api/v1/assignments/{assignment_id}/submissions (daftar nilai guru,
 *      API-CONTRACTS.md 6.7) — semua anggota kelas termasuk yang belum mengumpulkan.
 * POST /api/v1/assignments/{assignment_id}/submissions (tombol Kumpulkan murid,
 *      API-CONTRACTS.md 5.1).
 */
export async function GET(request: NextRequest, context: {params: Promise<{assignment_id: string}>}) {
    try {
        const {assignment_id: assignmentId} = await context.params;
        if (!isUuid(assignmentId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'assignment_id tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', assignmentId});

        const data = await listSubmissionsForTeacher(db, assignmentId);

        return Response.json({
            assignment: {
                id: data.assignment.id,
                judul: data.assignment.judul,
                ditutup_pada: ISO(data.assignment.ditutup_pada)
            },
            murid: data.murid.map(row => ({
                student_id: row.student_id,
                nama: row.nama,
                jumlah_kumpul: row.jumlah_kumpul,
                terakhir_dikumpulkan_pada: row.terakhir_dikumpulkan_pada
                    ? ISO(row.terakhir_dikumpulkan_pada)
                    : null,
                submission_id: row.submission_id,
                terlambat: row.terlambat,
                perlu_tinjauan: row.perlu_tinjauan,
                jumlah_snapshot: row.jumlah_snapshot,
                snapshot_terakhir_pada: row.snapshot_terakhir_pada
                    ? ISO(row.snapshot_terakhir_pada)
                    : null,
                belum_kumpul: row.belum_kumpul
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
