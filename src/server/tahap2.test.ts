import bcrypt from 'bcryptjs';
import {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
    createAdminClass,
    getAdminClassDetail,
    listAdminClasses,
    updateAdminClass
} from './classes';
import {
    createClassInvite,
    getPublicInviteByCode,
    joinClassWithInviteForStudent,
    revokeClassInvite
} from './invites';
import {
    addStudentToClass,
    createAdminStudent,
    listAdminStudents,
    removeStudentFromClass,
    updateAdminStudent
} from './students';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('Tahap 2 — Kelas, Akun Siswa Buatan Admin, & Invite Class', () => {
    let pool: Pool;
    let admin1Id: string;
    let admin2Id: string;

    beforeAll(() => {
        pool = new Pool({connectionString});
    });

    beforeEach(async () => {
        await pool.query(
            'truncate table class_invites, class_members, classes, students, admins restart identity cascade'
        );
        const hash = await bcrypt.hash('rahasia123', 4);
        admin1Id = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin1@example.test', $1, 'Kak Budi')
                 returning id`,
                [hash]
            )
        ).rows[0].id;
        admin2Id = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin2@example.test', $1, 'Kak Sari')
                 returning id`,
                [hash]
            )
        ).rows[0].id;
    });

    afterAll(async () => {
        await pool.end();
    });

    it('mengelola kelas dan menjaga isolasi kepemilikan admin_id', async () => {
        const kelas = await createAdminClass(pool, admin1Id, {
            nama: 'Kelas Coding 5A',
            deskripsi: 'Selasa Pagi'
        });
        expect(kelas.nama).toBe('Kelas Coding 5A');

        const daftar = await listAdminClasses(pool, admin1Id);
        expect(daftar).toHaveLength(1);
        expect(daftar[0].jumlah_siswa).toBe(0);

        // Admin lain tidak dapat mengakses detail atau mengubah kelas admin1
        await expect(getAdminClassDetail(pool, admin2Id, kelas.id)).rejects.toMatchObject({
            status: 404
        });
        await expect(
            updateAdminClass(pool, admin2Id, kelas.id, {nama: 'Bajak'})
        ).rejects.toMatchObject({status: 404});

        // Arsipkan kelas
        await updateAdminClass(pool, admin1Id, kelas.id, {arsipkan: true});
        const setelahArsip = await listAdminClasses(pool, admin1Id);
        expect(setelahArsip).toHaveLength(0);
    });

    it('membuat akun siswa, mencegah username kembar (409), dan mengelola anggota kelas', async () => {
        const kelas = await createAdminClass(pool, admin1Id, {nama: 'Kelas 6B'});

        const s1 = await createAdminStudent(pool, admin1Id, {
            nama: 'Budi',
            username: 'Budi01',
            password: '1234',
            class_id: kelas.id
        });
        expect(s1.username).toBe('budi01');

        // Username sama (beda huruf besar/kecil) ditolak 409
        await expect(
            createAdminStudent(pool, admin1Id, {
                nama: 'Budi Lain',
                username: 'BUDI01',
                password: '5678'
            })
        ).rejects.toMatchObject({
            status: 409,
            kode: 'USERNAME_SUDAH_DIPAKAI'
        });

        const s2 = await createAdminStudent(pool, admin1Id, {
            nama: 'Ani',
            username: 'ani02',
            password: '1234'
        });
        await addStudentToClass(pool, admin1Id, kelas.id, s2.id);

        const detail = await getAdminClassDetail(pool, admin1Id, kelas.id);
        expect(detail.siswa.map(x => x.username)).toEqual(['ani02', 'budi01']);

        // Keluarkan s2 dari kelas
        await removeStudentFromClass(pool, admin1Id, kelas.id, s2.id);
        const detailSetelahHapus = await getAdminClassDetail(pool, admin1Id, kelas.id);
        expect(detailSetelahHapus.siswa.map(x => x.username)).toEqual(['budi01']);

        // Reset password & arsipkan siswa
        await updateAdminStudent(pool, admin1Id, s2.id, {password: '9999', arsipkan: true});
        const semuaSiswaAktif = await listAdminStudents(pool, admin1Id);
        expect(semuaSiswaAktif.map(x => x.username)).toEqual(['budi01']);
    });

    it('mengelola invite class: gabung siswa sah, tolak undangan dicabut/kedaluwarsa (410) & siswa admin lain (403)', async () => {
        const kelas = await createAdminClass(pool, admin1Id, {nama: 'Kelas Petualang'});
        const siswaSah = await createAdminStudent(pool, admin1Id, {
            nama: 'Rina',
            username: 'rina01',
            password: '1234'
        });
        const siswaAdminLain = await createAdminStudent(pool, admin2Id, {
            nama: 'Doni',
            username: 'doni02',
            password: '1234'
        });

        const undangan = await createClassInvite(pool, admin1Id, kelas.id, {berlaku_jam: 24});
        const info = await getPublicInviteByCode(pool, undangan.kode);
        expect(info.aktif).toBe(true);
        expect(info.kelas_nama).toBe('Kelas Petualang');
        expect(info.admin_nama).toBe('Kak Budi');

        // Siswa milik admin lain ditolak 403
        await expect(
            joinClassWithInviteForStudent(pool, siswaAdminLain.id, undangan.kode)
        ).rejects.toMatchObject({
            status: 403,
            kode: 'SISWA_TIDAK_TERDAFTAR'
        });

        // Siswa sah milik admin1 berhasil bergabung lewat invite class
        const joined = await joinClassWithInviteForStudent(pool, siswaSah.id, undangan.kode);
        expect(joined.class_id).toBe(kelas.id);

        // Cabut undangan: undangan ditolak 410 untuk pemakaian berikutnya, tetapi anggota lama tetap di kelas
        await revokeClassInvite(pool, admin1Id, undangan.id);
        await expect(
            joinClassWithInviteForStudent(pool, siswaSah.id, undangan.kode)
        ).rejects.toMatchObject({
            status: 410,
            kode: 'UNDANGAN_TIDAK_BERLAKU'
        });

        const detail = await getAdminClassDetail(pool, admin1Id, kelas.id);
        expect(detail.siswa.map(x => x.username)).toEqual(['rina01']);

        // Undangan kedaluwarsa ditolak 410
        const expRes = await pool.query(
            `insert into class_invites (class_id, kode, berlaku_dari, berlaku_sampai)
             values ($1, 'EXPRD1', now() - interval '2 hours', now() - interval '1 hour')
             returning kode`,
            [kelas.id]
        );
        await expect(
            joinClassWithInviteForStudent(pool, siswaSah.id, expRes.rows[0].kode)
        ).rejects.toMatchObject({
            status: 410,
            kode: 'UNDANGAN_TIDAK_BERLAKU'
        });
    });
});
