import bcrypt from 'bcryptjs';
import {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {assertAdminOwnsClass, assertAdminOwnsStudent, assertStudentInClass} from './access';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('integrasi database Tahap 1 (admins, students, classes, class_members)', () => {
    let pool: Pool;

    beforeAll(() => {
        pool = new Pool({connectionString});
    });

    beforeEach(async () => {
        await pool.query(
            'truncate table class_invites, class_members, classes, students, admins restart identity cascade'
        );
    });

    afterAll(async () => {
        await pool.end();
    });

    it('menyimpan admin & siswa buatan admin serta memverifikasi rantai kepemilikan', async () => {
        const hash = await bcrypt.hash('rahasia123', 4);

        const admin1 = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin1@example.test', $1, 'Admin Satu')
                 returning id`,
                [hash]
            )
        ).rows[0];

        const admin2 = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin2@example.test', $1, 'Admin Dua')
                 returning id`,
                [hash]
            )
        ).rows[0];

        const student1 = (
            await pool.query(
                `insert into students (admin_id, username, nama, password_hash)
                 values ($1, 'kelinci01', 'Budi', $2)
                 returning id`,
                [admin1.id, hash]
            )
        ).rows[0];

        const kelas1 = (
            await pool.query(
                `insert into classes (admin_id, nama, deskripsi)
                 values ($1, 'Kelas 5A', 'Sesi Pagi')
                 returning id`,
                [admin1.id]
            )
        ).rows[0];

        await pool.query(
            `insert into class_members (class_id, student_id)
             values ($1, $2)`,
            [kelas1.id, student1.id]
        );

        const ownedClass = await assertAdminOwnsClass(pool, admin1.id, kelas1.id);
        expect(ownedClass.nama).toBe('Kelas 5A');

        await expect(assertAdminOwnsClass(pool, admin2.id, kelas1.id)).rejects.toMatchObject({
            status: 404
        });

        const ownedStudent = await assertAdminOwnsStudent(pool, admin1.id, student1.id);
        expect(ownedStudent.username).toBe('kelinci01');

        await expect(assertAdminOwnsStudent(pool, admin2.id, student1.id)).rejects.toMatchObject({
            status: 404
        });

        const memberClass = await assertStudentInClass(pool, student1.id, kelas1.id);
        expect(memberClass.id).toBe(kelas1.id);
    });

    it('menolak username siswa duplikat tanpa memedulikan huruf besar/kecil', async () => {
        const hash = await bcrypt.hash('1234', 4);
        const admin = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin@example.test', $1, 'Admin')
                 returning id`,
                [hash]
            )
        ).rows[0];

        await pool.query(
            `insert into students (admin_id, username, nama, password_hash)
             values ($1, 'Petualang1', 'Ani', $2)`,
            [admin.id, hash]
        );

        await expect(
            pool.query(
                `insert into students (admin_id, username, nama, password_hash)
                 values ($1, 'petualang1', 'Ani Duplikat', $2)`,
                [admin.id, hash]
            )
        ).rejects.toThrow();
    });
});
