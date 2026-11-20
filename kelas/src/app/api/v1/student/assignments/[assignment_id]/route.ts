import type {NextRequest} from 'next/server';
import {getPool} from '@/lib/db';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid} from '@/lib/http/uuid';
import {requireSessionRole} from '@/lib/http/auth-guard';
import {getStudentAssignment} from '@/server/student';

/*
 * GET /api/v1/student/assignments/{assignment_id}
 * Detail tugas untuk murid beserta daftar pengumpulan miliknya.
 */
export async function GET(request: NextRequest, context: {params: Promise<{assignment_id: string}>}) {
    try {
        const {assignment_id: assignmentId} = await context.params;
        if (!isUuid(assignmentId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'assignment_id tidak valid.');
        }

        const session = await requireSessionRole('murid');
        const data = await getStudentAssignment(getPool(), session.user.id, assignmentId);

        return Response.json({
            assignment: {
                id: data.assignment.id,
                judul: data.assignment.judul,
                instruksi: data.assignment.instruksi,
                dibuka_pada: ISO(data.assignment.dibuka_pada),
                ditutup_pada: ISO(data.assignment.ditutup_pada),
                izinkan_terlambat: data.assignment.izinkan_terlambat,
                status: data.assignment.status,
                boleh_edit: data.assignment.boleh_edit,
                boleh_kumpul: data.assignment.boleh_kumpul
            },
            hasil: data.hasil.map(row => ({
                id: row.id,
                dikumpulkan_pada: ISO(row.dikumpulkan_pada),
                terlambat: row.terlambat,
                perlu_tinjauan: row.perlu_tinjauan
            })),
            jumlah_snapshot: data.jumlah_snapshot
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
