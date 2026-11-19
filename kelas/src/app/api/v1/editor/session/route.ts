import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {evaluateAssignmentWindow} from '@/lib/assignment-window';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const iso = (value: Date | string): string => new Date(value).toISOString();

/*
 * GET /api/v1/editor/session?assignment_id=<uuid>
 * (API-CONTRACTS.md Bagian 4.1) — khusus sesi murid.
 */
export async function GET(request: NextRequest) {
    try {
        const assignmentId = request.nextUrl.searchParams.get('assignment_id');
        if (!assignmentId || !UUID_RE.test(assignmentId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'assignment_id tidak valid.');
        }

        const session = await auth();
        const db = getPool();

        await requireAccess(db, session, {role: 'murid', assignmentId});
        const studentId = session!.user.id;

        const {rows} = await db.query(
            `select a.id, a.judul, a.dibuka_pada, a.ditutup_pada, a.izinkan_terlambat,
                    now() as sekarang, s.nama as student_nama
               from assignments a
               cross join students s
              where a.id = $1 and s.id = $2`,
            [assignmentId, studentId]
        );
        const row = rows[0];
        if (!row) {
            throw new ApiError(404, 'BUKAN_ANGGOTA', 'Data tidak ditemukan.');
        }

        const waktu = evaluateAssignmentWindow({
            sekarang: row.sekarang,
            dibukaPada: row.dibuka_pada,
            ditutupPada: row.ditutup_pada
        });

        const snapshot = await db.query(
            `select id, diambil_pada, ukuran_bytes
               from snapshots
              where assignment_id = $1 and student_id = $2
              order by diambil_pada desc, id desc
              limit 1`,
            [assignmentId, studentId]
        );
        const proyekTerakhir = snapshot.rows[0]
            ? {
                  snapshot_id: snapshot.rows[0].id,
                  diambil_pada: iso(snapshot.rows[0].diambil_pada),
                  ukuran_bytes: Number(snapshot.rows[0].ukuran_bytes)
              }
            : null;

        if (waktu.status === 'belum_dibuka') {
            return Response.json({
                assignment: {
                    id: row.id,
                    boleh_edit: false,
                    boleh_kumpul: false,
                    status: 'belum_dibuka',
                    alasan: 'TUGAS_BELUM_DIBUKA',
                    dibuka_pada: iso(row.dibuka_pada)
                }
            });
        }

        if (waktu.status === 'ditutup') {
            return Response.json({
                assignment: {
                    id: row.id,
                    boleh_edit: false,
                    boleh_kumpul: true,
                    status: 'ditutup',
                    alasan: 'TUGAS_DITUTUP',
                    ditutup_pada: iso(row.ditutup_pada),
                    pesan:
                        'Tugas sudah ditutup. Proyek dapat dilihat dan dikumpulkan, tetapi tidak dapat diedit lagi.'
                },
                proyek_terakhir: proyekTerakhir
            });
        }

        return Response.json({
            student: {id: studentId, nama: row.student_nama},
            assignment: {
                id: row.id,
                judul: row.judul,
                dibuka_pada: iso(row.dibuka_pada),
                ditutup_pada: iso(row.ditutup_pada),
                izinkan_terlambat: row.izinkan_terlambat,
                boleh_edit: true,
                boleh_kumpul: true,
                status: 'dibuka'
            },
            proyek_terakhir: proyekTerakhir
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
