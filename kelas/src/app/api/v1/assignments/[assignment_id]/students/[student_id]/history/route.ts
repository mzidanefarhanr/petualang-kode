import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid} from '@/lib/http/uuid';
import {getStudentHistory} from '@/server/history';

/*
 * GET /api/v1/assignments/{assignment_id}/students/{student_id}/history
 * Riwayat pengerjaan seorang murid pada satu tugas (guru pemilik kelas).
 * Dipakai Layar 7. Daftar snapshot tetap tersedia walau belum ada submission.
 * Tidak mengirim object_key.
 */
export async function GET(
    request: NextRequest,
    context: {params: Promise<{assignment_id: string; student_id: string}>}
) {
    try {
        const {assignment_id: assignmentId, student_id: studentId} = await context.params;
        if (!isUuid(assignmentId) || !isUuid(studentId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Parameter tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', assignmentId});

        const data = await getStudentHistory(db, assignmentId, studentId);

        return Response.json({
            assignment: {
                id: data.assignment.id,
                judul: data.assignment.judul,
                dibuka_pada: ISO(data.assignment.dibuka_pada),
                ditutup_pada: ISO(data.assignment.ditutup_pada)
            },
            student: data.student,
            snapshots: data.snapshots.map(row => ({
                id: row.id,
                diambil_pada: ISO(row.diambil_pada),
                jenis_simpan: row.jenis_simpan,
                ukuran_bytes: row.ukuran_bytes
            })),
            submissions: data.submissions.map(row => ({
                id: row.id,
                dikumpulkan_pada: ISO(row.dikumpulkan_pada),
                terlambat: row.terlambat,
                perlu_tinjauan: row.perlu_tinjauan,
                catatan_siswa: row.catatan_siswa
            }))
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
