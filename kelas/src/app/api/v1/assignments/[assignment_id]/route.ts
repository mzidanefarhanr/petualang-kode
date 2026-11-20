import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid} from '@/lib/http/uuid';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {updateAssignment} from '@/server/assignments';

/*
 * PATCH /api/v1/assignments/{assignment_id} — ubah tugas (guru pemilik kelas).
 * Mengubah jendela waktu tidak mengubah fakta `terlambat`/`perlu_tinjauan`
 * submission lama (tidak dihitung ulang).
 */
export async function PATCH(request: NextRequest, context: {params: Promise<{assignment_id: string}>}) {
    try {
        const {assignment_id: assignmentId} = await context.params;
        if (!isUuid(assignmentId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'assignment_id tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', assignmentId});
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);

        const body = (await request.json()) as {
            judul?: unknown;
            instruksi?: unknown;
            dibuka_pada?: unknown;
            ditutup_pada?: unknown;
            izinkan_terlambat?: unknown;
        };

        const patch: {
            judul?: unknown;
            instruksi?: unknown;
            dibukaPada?: unknown;
            ditutupPada?: unknown;
            izinkanTerlambat?: unknown;
        } = {};
        if (body?.judul !== undefined) patch.judul = body.judul;
        if (body?.instruksi !== undefined) patch.instruksi = body.instruksi;
        if (body?.dibuka_pada !== undefined) patch.dibukaPada = new Date(String(body.dibuka_pada));
        if (body?.ditutup_pada !== undefined) patch.ditutupPada = new Date(String(body.ditutup_pada));
        if (body?.izinkan_terlambat !== undefined) patch.izinkanTerlambat = body.izinkan_terlambat;

        const assignment = await updateAssignment(db, assignmentId, patch);

        return Response.json({
            id: assignment.id,
            class_id: assignment.class_id,
            judul: assignment.judul,
            instruksi: assignment.instruksi,
            dibuka_pada: ISO(assignment.dibuka_pada),
            ditutup_pada: ISO(assignment.ditutup_pada),
            izinkan_terlambat: assignment.izinkan_terlambat,
            dibuat_pada: ISO(assignment.dibuat_pada)
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
