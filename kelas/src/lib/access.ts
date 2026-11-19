import {Errors} from './http/errors';

/*
 * Pemeriksaan izin terpusat (API-CONTRACTS.md Bagian 7).
 *
 * Urutan: 401 sesi -> 403 peran -> 404 rantai kepemilikan.
 * Semua query kepemilikan berakhir pada teachers.id (guru) atau class_members (murid).
 *
 * `db` sengaja berupa antarmuka minimal (bukan Pool langsung) agar logika
 * pemeriksaan dapat diuji dengan database palsu.
 */

export type Role = 'guru' | 'murid';

export interface AccessSession {
    user?: {
        id?: string;
        role?: string;
    };
}

export interface Queryable {
    query: (text: string, params?: unknown[]) => Promise<{rows: any[]}>;
}

export interface AccessSpec {
    role: Role;
    classId?: string;
    assignmentId?: string;
}

export interface AccessResult {
    classId: string;
    assignmentId?: string;
}

export async function requireAccess(
    db: Queryable,
    session: AccessSession | null | undefined,
    spec: AccessSpec
): Promise<AccessResult> {
    if (!session?.user?.id) {
        throw Errors.belumMasuk();
    }
    if (session.user.role !== spec.role) {
        throw Errors.peranTidakSesuai();
    }

    const userId = session.user.id;

    if (spec.classId) {
        if (spec.role === 'guru') {
            const {rows} = await db.query(
                'select id from classes where id = $1 and teacher_id = $2',
                [spec.classId, userId]
            );
            if (!rows.length) {
                throw Errors.bukanMilikAnda();
            }
        } else {
            const {rows} = await db.query(
                'select 1 from class_members where class_id = $1 and student_id = $2',
                [spec.classId, userId]
            );
            if (!rows.length) {
                throw Errors.bukanAnggota();
            }
        }
        return {classId: spec.classId};
    }

    if (spec.assignmentId) {
        if (spec.role === 'guru') {
            const {rows} = await db.query(
                `select c.id as class_id
                   from assignments a
                   join classes c on c.id = a.class_id
                  where a.id = $1 and c.teacher_id = $2`,
                [spec.assignmentId, userId]
            );
            if (!rows.length) {
                throw Errors.bukanMilikAnda();
            }
            return {classId: rows[0].class_id, assignmentId: spec.assignmentId};
        }

        const {rows} = await db.query(
            `select a.class_id
               from assignments a
               join class_members cm on cm.class_id = a.class_id and cm.student_id = $2
              where a.id = $1`,
            [spec.assignmentId, userId]
        );
        if (!rows.length) {
            throw Errors.bukanAnggota();
        }
        return {classId: rows[0].class_id, assignmentId: spec.assignmentId};
    }

    throw Errors.permintaanTidakValid('Spesifikasi akses tidak lengkap.');
}
