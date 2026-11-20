import {evaluateAssignmentWindow, type StatusTugas} from '../lib/assignment-window';
import {loadAssignmentForStudent} from '../lib/assignment';
import {Errors} from '../lib/http/errors';
import type {Queryable} from '../lib/db';

export interface StudentClass {
    id: string;
    nama: string;
    guru: string;
    school: string | null;
}

export async function listStudentClasses(db: Queryable, studentId: string): Promise<StudentClass[]> {
    const {rows} = await db.query(
        `select c.id, c.nama, t.nama as guru, s.nama as school
           from class_members cm
           join classes c on c.id = cm.class_id
           join teachers t on t.id = c.teacher_id
           left join schools s on s.id = c.school_id
          where cm.student_id = $1
          order by c.nama`,
        [studentId]
    );
    return rows;
}

export interface StudentAssignment {
    id: string;
    judul: string;
    instruksi: string | null;
    dibuka_pada: Date;
    ditutup_pada: Date;
    izinkan_terlambat: boolean;
    kelas: {id: string; nama: string};
    status: StatusTugas;
    boleh_edit: boolean;
    boleh_kumpul: boolean;
    jumlah_kumpul: number;
}

export async function listStudentAssignments(
    db: Queryable,
    studentId: string
): Promise<StudentAssignment[]> {
    const {rows} = await db.query(
        `select a.id, a.judul, a.instruksi, a.dibuka_pada, a.ditutup_pada, a.izinkan_terlambat,
                c.id as class_id, c.nama as class_nama, now() as sekarang,
                (select count(*)::int from submissions sub
                  where sub.assignment_id = a.id and sub.student_id = $1) as jumlah_kumpul
           from class_members cm
           join assignments a on a.class_id = cm.class_id
           join classes c on c.id = a.class_id
          where cm.student_id = $1
          order by a.ditutup_pada desc`,
        [studentId]
    );

    return rows.map(row => {
        const window = evaluateAssignmentWindow({
            sekarang: row.sekarang,
            dibukaPada: row.dibuka_pada,
            ditutupPada: row.ditutup_pada
        });
        return {
            id: row.id,
            judul: row.judul,
            instruksi: row.instruksi,
            dibuka_pada: row.dibuka_pada,
            ditutup_pada: row.ditutup_pada,
            izinkan_terlambat: row.izinkan_terlambat,
            kelas: {id: row.class_id, nama: row.class_nama},
            status: window.status,
            boleh_edit: window.boleh_edit,
            boleh_kumpul: window.boleh_kumpul,
            jumlah_kumpul: Number(row.jumlah_kumpul)
        };
    });
}

export interface StudentSubmission {
    id: string;
    dikumpulkan_pada: Date;
    terlambat: boolean;
    perlu_tinjauan: boolean;
}

export interface StudentAssignmentDetail {
    assignment: {
        id: string;
        judul: string;
        instruksi: string | null;
        dibuka_pada: Date;
        ditutup_pada: Date;
        izinkan_terlambat: boolean;
        status: StatusTugas;
        boleh_edit: boolean;
        boleh_kumpul: boolean;
    };
    hasil: StudentSubmission[];
    jumlah_snapshot: number;
}

export async function getStudentAssignment(
    db: Queryable,
    studentId: string,
    assignmentId: string
): Promise<StudentAssignmentDetail> {
    const assignment = await loadAssignmentForStudent(db, assignmentId, studentId);
    if (!assignment) {
        throw Errors.bukanAnggota();
    }

    const window = evaluateAssignmentWindow({
        sekarang: assignment.sekarang,
        dibukaPada: assignment.dibuka_pada,
        ditutupPada: assignment.ditutup_pada
    });

    const hasil = (
        await db.query(
            `select id, dikumpulkan_pada, terlambat, perlu_tinjauan
               from submissions
              where assignment_id = $1 and student_id = $2
              order by dikumpulkan_pada desc, id desc`,
            [assignmentId, studentId]
        )
    ).rows;

    const snapshotCount = (
        await db.query(
            'select count(*)::int as n from snapshots where assignment_id = $1 and student_id = $2',
            [assignmentId, studentId]
        )
    ).rows[0].n as number;

    return {
        assignment: {
            id: assignment.id,
            judul: assignment.judul,
            instruksi: assignment.instruksi,
            dibuka_pada: assignment.dibuka_pada,
            ditutup_pada: assignment.ditutup_pada,
            izinkan_terlambat: assignment.izinkan_terlambat,
            status: window.status,
            boleh_edit: window.boleh_edit,
            boleh_kumpul: window.boleh_kumpul
        },
        hasil,
        jumlah_snapshot: snapshotCount
    };
}
