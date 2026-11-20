import {Errors} from './http/errors';
import type {Queryable} from './db';

/*
 * Pemeriksaan izin terpusat (API-CONTRACTS.md Bagian 7).
 *
 * Urutan: 401 sesi -> 403 peran -> 404 rantai kepemilikan.
 * Semua query kepemilikan berakhir pada teachers.id (guru) atau class_members (murid).
 */

export type Role = 'guru' | 'murid';

export interface AccessSession {
    user?: {
        id?: string;
        role?: string;
    };
}

export {type Queryable};

export interface AccessSpec {
    role: Role;
    classId?: string;
    assignmentId?: string;
    snapshotId?: string;
    submissionId?: string;
    inviteId?: string;
}

export interface AccessResult {
    classId: string;
    assignmentId?: string;
    snapshotId?: string;
    submissionId?: string;
    inviteId?: string;
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
    const isGuru = spec.role === 'guru';

    if (spec.classId) {
        if (isGuru) {
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
        if (isGuru) {
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

    if (spec.snapshotId) {
        const {rows} = isGuru
            ? await db.query(
                  `select s.class_id
                     from snapshots s
                     join classes c on c.id = s.class_id
                    where s.id = $1 and c.teacher_id = $2`,
                  [spec.snapshotId, userId]
              )
            : await db.query(
                  'select class_id from snapshots where id = $1 and student_id = $2',
                  [spec.snapshotId, userId]
              );
        if (!rows.length) {
            throw Errors.bukanMilikAnda();
        }
        return {classId: rows[0].class_id, snapshotId: spec.snapshotId};
    }

    if (spec.submissionId) {
        const {rows} = isGuru
            ? await db.query(
                  `select sub.class_id
                     from submissions sub
                     join classes c on c.id = sub.class_id
                    where sub.id = $1 and c.teacher_id = $2`,
                  [spec.submissionId, userId]
              )
            : await db.query(
                  'select class_id from submissions where id = $1 and student_id = $2',
                  [spec.submissionId, userId]
              );
        if (!rows.length) {
            throw Errors.bukanMilikAnda();
        }
        return {classId: rows[0].class_id, submissionId: spec.submissionId};
    }

    if (spec.inviteId) {
        // Undangan adalah sumber daya guru; tidak ada akses murid.
        if (!isGuru) {
            throw Errors.bukanMilikAnda();
        }
        const {rows} = await db.query(
            `select i.class_id
               from invites i
               join classes c on c.id = i.class_id
              where i.id = $1 and c.teacher_id = $2`,
            [spec.inviteId, userId]
        );
        if (!rows.length) {
            throw Errors.bukanMilikAnda();
        }
        return {classId: rows[0].class_id, inviteId: spec.inviteId};
    }

    throw Errors.permintaanTidakValid('Spesifikasi akses tidak lengkap.');
}
