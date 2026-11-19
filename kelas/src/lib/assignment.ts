import type {Queryable} from './db';

/*
 * Pemuatan tugas untuk seorang murid, sekaligus mengambil waktu server (now()).
 * Keanggotaan kelas diperiksa melalui join ke class_members.
 */

export interface AssignmentRow {
    id: string;
    class_id: string;
    judul: string;
    dibuka_pada: Date;
    ditutup_pada: Date;
    izinkan_terlambat: boolean;
    sekarang: Date;
}

export async function loadAssignmentForStudent(
    db: Queryable,
    assignmentId: string,
    studentId: string
): Promise<AssignmentRow | null> {
    const {rows} = await db.query(
        `select a.id, a.class_id, a.judul, a.dibuka_pada, a.ditutup_pada,
                a.izinkan_terlambat, now() as sekarang
           from assignments a
           join class_members cm on cm.class_id = a.class_id and cm.student_id = $2
          where a.id = $1`,
        [assignmentId, studentId]
    );
    return rows[0] ?? null;
}

export async function dbNow(db: Queryable): Promise<Date> {
    const {rows} = await db.query('select now() as sekarang');
    return rows[0].sekarang as Date;
}
