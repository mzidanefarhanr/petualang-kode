import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid} from '@/lib/http/uuid';
import {listVersions} from '@/server/assignments';

/*
 * GET /api/v1/submissions/{submission_id}/versions (API-CONTRACTS.md 6.8)
 * Riwayat pengumpulan & snapshot milik murid, terbaru lebih dulu. Tanpa object_key.
 */
export async function GET(request: NextRequest, context: {params: Promise<{submission_id: string}>}) {
    try {
        const {submission_id: submissionId} = await context.params;
        if (!isUuid(submissionId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'submission_id tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', submissionId});

        const data = await listVersions(db, submissionId);

        return Response.json({
            submission: {
                id: data.submission.id,
                dikumpulkan_pada: ISO(data.submission.dikumpulkan_pada),
                terlambat: data.submission.terlambat
            },
            versi: data.versi.map(entry => ({
                jenis: entry.jenis,
                id: entry.id,
                waktu: ISO(entry.waktu),
                ukuran_bytes: entry.ukuran_bytes,
                ...(entry.jenis_simpan ? {jenis_simpan: entry.jenis_simpan} : {}),
                url_unduh: entry.url_unduh
            }))
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
