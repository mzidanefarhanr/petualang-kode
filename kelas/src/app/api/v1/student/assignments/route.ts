import {getPool} from '@/lib/db';
import {toErrorResponse} from '@/lib/http/errors';
import {ISO} from '@/lib/http/uuid';
import {requireSessionRole} from '@/lib/http/auth-guard';
import {listStudentAssignments} from '@/server/student';

/*
 * GET /api/v1/student/assignments — daftar tugas semua kelas yang diikuti murid,
 * lengkap dengan status jendela waktu (belum_dibuka/dibuka/ditutup).
 */
export async function GET() {
    try {
        const session = await requireSessionRole('murid');
        const assignments = await listStudentAssignments(getPool(), session.user.id);
        return Response.json({
            assignments: assignments.map(row => ({
                id: row.id,
                judul: row.judul,
                instruksi: row.instruksi,
                dibuka_pada: ISO(row.dibuka_pada),
                ditutup_pada: ISO(row.ditutup_pada),
                izinkan_terlambat: row.izinkan_terlambat,
                kelas: row.kelas,
                status: row.status,
                boleh_edit: row.boleh_edit,
                boleh_kumpul: row.boleh_kumpul,
                jumlah_kumpul: row.jumlah_kumpul
            }))
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
