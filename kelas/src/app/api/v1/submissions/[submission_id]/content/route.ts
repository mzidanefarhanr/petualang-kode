import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {getStorage} from '@/lib/storage';
import {ApiError, Errors, toErrorResponse} from '@/lib/http/errors';
import {isUuid} from '@/lib/http/uuid';
import {toArrayBuffer} from '@/lib/files';
import {getSubmissionContent} from '@/server/submissions';

/*
 * GET /api/v1/submissions/{submission_id}/content (API-CONTRACTS.md 6.9)
 * Guru pemilik kelas atau murid pemilik submission. `object_key` tidak dikirim.
 */
export async function GET(request: NextRequest, context: {params: Promise<{submission_id: string}>}) {
    try {
        const {submission_id: submissionId} = await context.params;
        if (!isUuid(submissionId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'submission_id tidak valid.');
        }

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

        const content = await getSubmissionContent({db, storage: getStorage()}, submissionId);
        return new Response(toArrayBuffer(content.bytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="proyek-scratch.sb3"',
                ETag: `"${content.isi_hash}"`
            }
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
