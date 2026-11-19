import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {getStorage} from '@/lib/storage';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid} from '@/lib/http/uuid';
import {toArrayBuffer} from '@/lib/files';
import {getLastProject} from '@/server/snapshots';

/*
 * GET /api/v1/editor/projects/{assignment_id}
 * Mengambil proyek terakhir murid sebagai biner `.sb3` (API-CONTRACTS.md 4.2).
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

        const project = await getLastProject(
            {db, storage: getStorage()},
            assignmentId,
            session!.user.id
        );
        if (!project) {
            return new Response(null, {status: 204});
        }

        return new Response(toArrayBuffer(project.bytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="proyek-scratch.sb3"',
                ETag: `"${project.isi_hash}"`,
                'X-Snapshot-Id': project.snapshot_id,
                'X-Diambil-Pada': ISO(project.diambil_pada)
            }
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
