import bcrypt from 'bcryptjs';
import {assertAdminOwnsClass, assertAdminOwnsStudent} from '@/lib/access';
import {MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH} from '@/lib/config';
import {withTransaction, type Queryable} from '@/lib/db';
import {ApiError} from '@/lib/http/errors';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export interface AdminStudentItem {
    id: string;
    username: string;
    nama: string;
    dibuat_pada: Date;
    kelas: Array<{id: string; nama: string}>;
}

export async function listAdminStudents(db: Queryable, adminId: string): Promise<AdminStudentItem[]> {
    const {rows} = await db.query(
        `select
            s.id,
            s.username,
            s.nama,
            s.dibuat_pada,
            coalesce(
                json_agg(
                    json_build_object('id', c.id, 'nama', c.nama)
                ) filter (where c.id is not null and c.diarsipkan_pada is null),
                '[]'::json
            ) as kelas
         from students s
         left join class_members cm on cm.student_id = s.id
         left join classes c on c.id = cm.class_id
         where s.admin_id = $1
           and s.diarsipkan_pada is null
         group by s.id
         order by s.nama asc, s.dibuat_pada desc`,
        [adminId]
    );
    return rows;
}

export async function createAdminStudent(
    db: Queryable,
    adminId: string,
    input: {nama?: unknown; username?: unknown; password?: unknown; class_id?: unknown}
): Promise<{id: string; nama: string; username: string; dibuat_pada: Date}> {
    const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const classId =
        typeof input.class_id === 'string' && input.class_id.trim().length > 0
            ? input.class_id.trim()
            : null;

    if (!nama || nama.length > 100) {
        throw new ApiError(400, 'INPUT_TIDAK_VALID', 'Nama siswa wajib diisi.');
    }
    if (username.length < MIN_USERNAME_LENGTH || username.length > 40 || !USERNAME_PATTERN.test(username)) {
        throw new ApiError(
            400,
            'USERNAME_TIDAK_VALID',
            `Username minimal ${MIN_USERNAME_LENGTH} karakter dan hanya boleh huruf, angka, titik, garis bawah, atau strip.`
        );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(
            400,
            'PASSWORD_TERLALU_PENDEK',
            `Kata sandi/PIN minimal ${MIN_PASSWORD_LENGTH} karakter.`
        );
    }

    if (classId) {
        await assertAdminOwnsClass(db, adminId, classId);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return withTransaction(db, async tx => {
        const dup = await tx.query('select id from students where lower(username) = lower($1)', [username]);
        if (dup.rows.length > 0) {
            throw new ApiError(409, 'USERNAME_SUDAH_DIPAKAI', 'Username tersebut sudah dipakai siswa lain.');
        }

        const {rows} = await tx.query(
            `insert into students (admin_id, username, nama, password_hash)
             values ($1, $2, $3, $4)
             returning id, nama, username, dibuat_pada`,
            [adminId, username, nama, passwordHash]
        );
        const student = rows[0];

        if (classId) {
            await tx.query(
                `insert into class_members (class_id, student_id)
                 values ($1, $2)
                 on conflict do nothing`,
                [classId, student.id]
            );
        }

        return student;
    });
}

export async function updateAdminStudent(
    db: Queryable,
    adminId: string,
    studentId: string,
    input: {nama?: unknown; password?: unknown; arsipkan?: unknown}
) {
    const existing = await assertAdminOwnsStudent(db, adminId, studentId);

    const nama =
        typeof input.nama === 'string' && input.nama.trim().length > 0 ? input.nama.trim() : existing.nama;
    const arsipkan = input.arsipkan === true;

    let newPasswordHash: string | null = null;
    if (typeof input.password === 'string' && input.password.length > 0) {
        if (input.password.length < MIN_PASSWORD_LENGTH) {
            throw new ApiError(
                400,
                'PASSWORD_TERLALU_PENDEK',
                `Kata sandi/PIN minimal ${MIN_PASSWORD_LENGTH} karakter.`
            );
        }
        newPasswordHash = await bcrypt.hash(input.password, 10);
    }

    const {rows} = await db.query(
        `update students
         set nama = $1,
             password_hash = coalesce($2, password_hash),
             diarsipkan_pada = case when $3::boolean then coalesce(diarsipkan_pada, now()) else diarsipkan_pada end
         where id = $4 and admin_id = $5
         returning id, username, nama, diarsipkan_pada`,
        [nama, newPasswordHash, arsipkan, studentId, adminId]
    );
    return rows[0];
}

export async function addStudentToClass(
    db: Queryable,
    adminId: string,
    classId: string,
    studentId: string
): Promise<void> {
    await assertAdminOwnsClass(db, adminId, classId);
    await assertAdminOwnsStudent(db, adminId, studentId);
    await db.query(
        `insert into class_members (class_id, student_id)
         values ($1, $2)
         on conflict do nothing`,
        [classId, studentId]
    );
}

export async function removeStudentFromClass(
    db: Queryable,
    adminId: string,
    classId: string,
    studentId: string
): Promise<void> {
    await assertAdminOwnsClass(db, adminId, classId);
    await assertAdminOwnsStudent(db, adminId, studentId);
    await db.query('delete from class_members where class_id = $1 and student_id = $2', [
        classId,
        studentId
    ]);
}
