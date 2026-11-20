import type {Session} from 'next-auth';
import type {Queryable} from './db';
import {ApiError, assertValidUuid} from './http/errors';

export interface AuthActor {
    id: string;
    role: 'admin' | 'student';
    name?: string | null;
    username?: string;
}

export function requireSessionActor(session: Session | null | undefined): AuthActor {
    const user = session?.user;
    if (!user?.id || (user.role !== 'admin' && user.role !== 'student')) {
        throw new ApiError(401, 'BELUM_MASUK', 'Silakan masuk terlebih dahulu.');
    }
    return {
        id: user.id,
        role: user.role,
        name: user.name,
        username: user.username
    };
}

export function requireAdmin(session: Session | null | undefined): AuthActor & {role: 'admin'} {
    const actor = requireSessionActor(session);
    if (actor.role !== 'admin') {
        throw new ApiError(403, 'PERAN_TIDAK_SESUAI', 'Halaman atau aksi ini hanya untuk Admin.');
    }
    return actor as AuthActor & {role: 'admin'};
}

export function requireStudent(session: Session | null | undefined): AuthActor & {role: 'student'} {
    const actor = requireSessionActor(session);
    if (actor.role !== 'student') {
        throw new ApiError(403, 'PERAN_TIDAK_SESUAI', 'Halaman atau aksi ini hanya untuk Siswa.');
    }
    return actor as AuthActor & {role: 'student'};
}

export async function assertAdminOwnsClass(
    db: Queryable,
    adminId: string,
    classId: string
): Promise<{id: string; nama: string; deskripsi: string | null; diarsipkan_pada: Date | null}> {
    assertValidUuid(classId, 'Kelas tidak ditemukan.');
    const {rows} = await db.query(
        `select id, nama, deskripsi, diarsipkan_pada
         from classes
         where id = $1 and admin_id = $2`,
        [classId, adminId]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'KELAS_TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }
    return rows[0];
}

export async function assertAdminOwnsStudent(
    db: Queryable,
    adminId: string,
    studentId: string
): Promise<{id: string; username: string; nama: string; diarsipkan_pada: Date | null}> {
    assertValidUuid(studentId, 'Siswa tidak ditemukan.');
    const {rows} = await db.query(
        `select id, username, nama, diarsipkan_pada
         from students
         where id = $1 and admin_id = $2`,
        [studentId, adminId]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'SISWA_TIDAK_DITEMUKAN', 'Siswa tidak ditemukan.');
    }
    return rows[0];
}

export async function assertStudentInClass(
    db: Queryable,
    studentId: string,
    classId: string
): Promise<{id: string; nama: string; admin_id: string}> {
    assertValidUuid(classId, 'Kelas tidak ditemukan.');
    const {rows} = await db.query(
        `select c.id, c.nama, c.admin_id
         from class_members cm
         join classes c on c.id = cm.class_id
         join students s on s.id = cm.student_id
         where cm.student_id = $1
           and cm.class_id = $2
           and c.diarsipkan_pada is null
           and s.diarsipkan_pada is null`,
        [studentId, classId]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'KELAS_TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }
    return rows[0];
}
