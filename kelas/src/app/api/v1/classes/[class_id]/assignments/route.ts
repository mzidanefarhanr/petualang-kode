import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid, parseDate} from '@/lib/http/uuid';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {createAssignment} from '@/server/assignments';

/*
 * POST /api/v1/classes/{class_id}/assignments — buat tugas (guru pemilik kelas)
 */
export async function POST(request: NextRequest, context: {params: Promise<{class_id: string}>}) {
    try {
        const {class_id: classId} = await context.params;
        if (!isUuid(classId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'class_id tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', classId});
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);

        const body = (await request.json()) as {
            judul?: unknown;
            instruksi?: unknown;
            dibuka_pada?: unknown;
            ditutup_pada?: unknown;
            izinkan_terlambat?: unknown;
        };

        const assignment = await createAssignment(db, {
            classId,
            judul: body?.judul,
            instruksi: body?.instruksi,
            dibukaPada: parseDate(body?.dibuka_pada),
            ditutupPada: parseDate(body?.ditutup_pada),
            izinkanTerlambat: body?.izinkan_terlambat
        });

        return Response.json(
            {
                id: assignment.id,
                class_id: assignment.class_id,
                judul: assignment.judul,
                instruksi: assignment.instruksi,
                dibuka_pada: ISO(assignment.dibuka_pada),
                ditutup_pada: ISO(assignment.ditutup_pada),
                izinkan_terlambat: assignment.izinkan_terlambat,
                dibuat_pada: ISO(assignment.dibuat_pada)
            },
            {status: 201}
        );
    } catch (error) {
        return toErrorResponse(error);
    }
}
