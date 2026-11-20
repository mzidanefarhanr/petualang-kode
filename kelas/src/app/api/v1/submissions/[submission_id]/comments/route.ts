import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, Errors, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid} from '@/lib/http/uuid';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {createComment, listComments} from '@/server/comments';

/*
 * GET  /api/v1/submissions/{submission_id}/comments (API-CONTRACTS.md 6.12)
 * POST /api/v1/submissions/{submission_id}/comments (API-CONTRACTS.md 6.11)
 * Guru pemilik kelas atau murid pemilik submission.
 */
async function resolveRole(submissionId: string) {
    const db = getPool();
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id) {
        throw Errors.belumMasuk();
    }
    if (role !== 'murid' && role !== 'guru') {
        throw Errors.peranTidakSesuai();
    }
    await requireAccess(db, session, {role, submissionId});
    return {db, role, userId: session.user.id};
}

export async function GET(request: NextRequest, context: {params: Promise<{submission_id: string}>}) {
    try {
        const {submission_id: submissionId} = await context.params;
        if (!isUuid(submissionId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'submission_id tidak valid.');
        }

        const {db} = await resolveRole(submissionId);
        const komentar = await listComments(db, submissionId);

        return Response.json({
            komentar: komentar.map(row => ({
                id: row.id,
                penulis: row.penulis,
                isi: row.isi,
                dibuat_pada: ISO(row.dibuat_pada)
            }))
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(request: NextRequest, context: {params: Promise<{submission_id: string}>}) {
    try {
        const {submission_id: submissionId} = await context.params;
        if (!isUuid(submissionId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'submission_id tidak valid.');
        }

        const {db, role, userId} = await resolveRole(submissionId);
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);

        const body = (await request.json()) as {isi?: unknown};
        const created = await createComment(db, {
            submissionId,
            role,
            userId,
            isi: body?.isi
        });

        return Response.json({id: created.id}, {status: 201});
    } catch (error) {
        return toErrorResponse(error);
    }
}
