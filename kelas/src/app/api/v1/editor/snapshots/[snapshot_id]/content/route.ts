import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {getStorage} from '@/lib/storage';
import {ApiError, Errors, toErrorResponse} from '@/lib/http/errors';
import {isUuid} from '@/lib/http/uuid';
import {toArrayBuffer} from '@/lib/files';
import {getSnapshotContent} from '@/server/snapshots';

/*
 * GET /api/v1/editor/snapshots/{snapshot_id}/content (API-CONTRACTS.md 4.8)
 * Murid pemilik atau guru pemilik kelas boleh mengunduh. `object_key` tidak dikirim.
 */
export async function GET(
    request: NextRequest,
    context: {params: Promise<{snapshot_id: string}>}
) {
    try {
        const {snapshot_id: snapshotId} = await context.params;
        if (!isUuid(snapshotId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'snapshot_id tidak valid.');
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

        await requireAccess(db, session, {role, snapshotId});

        const content = await getSnapshotContent({db, storage: getStorage()}, snapshotId);
        return new Response(toArrayBuffer(content.bytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                ETag: `"${content.isi_hash}"`
            }
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
