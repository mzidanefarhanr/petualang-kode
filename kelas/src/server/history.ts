import {Errors} from '../lib/http/errors';
import type {Queryable} from '../lib/db';

/*
 * Riwayat pengerjaan seorang murid pada satu tugas: daftar snapshot dan
 * pengumpulan. Dipakai Layar 7 (guru) sehingga daftar snapshot tetap tampil
 * walau murid belum pernah mengumpulkan.
 */

export interface SnapshotEntry {
    id: string;
    diambil_pada: Date;
    jenis_simpan: 'otomatis' | 'manual';
    ukuran_bytes: number;
}

export interface SubmissionEntry {
    id: string;
    dikumpulkan_pada: Date;
    terlambat: boolean;
    perlu_tinjauan: boolean;
    catatan_siswa: string | null;
}

export interface StudentHistory {
    assignment: {id: string; class_id: string; judul: string; dibuka_pada: Date; ditutup_pada: Date};
    student: {id: string; nama: string; username: string};
    snapshots: SnapshotEntry[];
    submissions: SubmissionEntry[];
}

export async function getStudentHistory(
    db: Queryable,
    assignmentId: string,
    studentId: string
): Promise<StudentHistory> {
    const assignment = (
        await db.query(
            `select a.id, a.class_id, a.judul, a.dibuka_pada, a.ditutup_pada,
                    st.id as student_id, st.nama as student_nama, st.username
               from assignments a
               join class_members cm on cm.class_id = a.class_id and cm.student_id = $2
               join students st on st.id = cm.student_id
              where a.id = $1`,
            [assignmentId, studentId]
        )
    ).rows[0];

    if (!assignment) {
        throw Errors.bukanAnggota();
    }

    const snapshots = (
        await db.query(
            `select id, diambil_pada, jenis_simpan, ukuran_bytes
               from snapshots
              where assignment_id = $1 and student_id = $2
              order by diambil_pada desc, id desc`,
            [assignmentId, studentId]
        )
    ).rows.map(row => ({
        id: row.id,
        diambil_pada: row.diambil_pada,
        jenis_simpan: row.jenis_simpan,
        ukuran_bytes: Number(row.ukuran_bytes)
    }));

    const submissions = (
        await db.query(
            `select id, dikumpulkan_pada, terlambat, perlu_tinjauan, catatan_siswa
               from submissions
              where assignment_id = $1 and student_id = $2
              order by dikumpulkan_pada desc, id desc`,
            [assignmentId, studentId]
        )
    ).rows.map(row => ({
        id: row.id,
        dikumpulkan_pada: row.dikumpulkan_pada,
        terlambat: row.terlambat,
        perlu_tinjauan: row.perlu_tinjauan,
        catatan_siswa: row.catatan_siswa ?? null
    }));

    return {
        assignment: {
            id: assignment.id,
            class_id: assignment.class_id,
            judul: assignment.judul,
            dibuka_pada: assignment.dibuka_pada,
            ditutup_pada: assignment.ditutup_pada
        },
        student: {id: assignment.student_id, nama: assignment.student_nama, username: assignment.username},
        snapshots,
        submissions
    };
}
