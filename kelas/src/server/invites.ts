import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {ApiError, Errors} from '../lib/http/errors';
import {withTransaction, type Queryable} from '../lib/db';
import {MAX_MURID_PER_KELAS} from '../lib/config';

export interface InviteRow {
    id: string;
    kode: string;
    berlaku_dari: Date;
    berlaku_sampai: Date;
    maks_pemakaian: number | null;
    dipakai: number;
    dicabut_pada: Date | null;
    dibuat_pada: Date;
}

const KODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateKode(): string {
    const bytes = randomBytes(8);
    let kode = '';
    for (let i = 0; i < 8; i++) {
        kode += KODE_ALPHABET[bytes[i] % KODE_ALPHABET.length];
    }
    return `${kode.slice(0, 4)}-${kode.slice(4)}`;
}

const isUniqueViolation = (error: unknown, constraint?: string): boolean => {
    const err = error as {code?: string; constraint?: string};
    return err?.code === '23505' && (!constraint || err.constraint === constraint);
};

export async function listInvites(db: Queryable, classId: string): Promise<InviteRow[]> {
    const {rows} = await db.query(
        `select id, kode, berlaku_dari, berlaku_sampai, maks_pemakaian, dipakai, dicabut_pada, dibuat_pada
           from invites
          where class_id = $1
          order by dibuat_pada desc`,
        [classId]
    );
    return rows;
}

export async function createInvite(
    db: Queryable,
    input: {classId: string; teacherId: string; berlakuSampai: Date; maksPemakaian: number | null}
): Promise<InviteRow> {
    const now = (await db.query('select now() as sekarang')).rows[0].sekarang as Date;
    if (!(input.berlakuSampai instanceof Date) || Number.isNaN(input.berlakuSampai.getTime())) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'berlaku_sampai tidak valid.');
    }
    if (input.berlakuSampai.getTime() <= now.getTime()) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'berlaku_sampai harus di masa depan.');
    }
    if (input.maksPemakaian !== null && (!Number.isInteger(input.maksPemakaian) || input.maksPemakaian <= 0)) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'maks_pemakaian tidak valid.');
    }

    for (let attempt = 0; attempt < 5; attempt++) {
        const kode = generateKode();
        try {
            const {rows} = await db.query(
                `insert into invites (class_id, kode, berlaku_sampai, maks_pemakaian)
                 values ($1, $2, $3, $4)
                 returning id, kode, berlaku_dari, berlaku_sampai, maks_pemakaian, dipakai, dicabut_pada, dibuat_pada`,
                [input.classId, kode, input.berlakuSampai, input.maksPemakaian]
            );
            return rows[0];
        } catch (error) {
            if (isUniqueViolation(error, 'invites_kode_key')) {
                continue;
            }
            throw error;
        }
    }
    throw new ApiError(500, 'KESALAHAN_INTERNAL', 'Gagal membuat kode undangan.');
}

export async function revokeInvite(db: Queryable, inviteId: string): Promise<void> {
    await db.query('update invites set dicabut_pada = now() where id = $1 and dicabut_pada is null', [
        inviteId
    ]);
}

export type StatusUndangan = 'berlaku' | 'dicabut' | 'kedaluwarsa' | 'penuh';

export interface InviteInfo {
    kode: string;
    kelas: {id: string; nama: string; guru: string};
    berlaku_dari: Date;
    berlaku_sampai: Date;
    status: StatusUndangan;
}

function computeStatus(invite: {
    dicabut_pada: Date | null;
    berlaku_dari: Date;
    berlaku_sampai: Date;
    maks_pemakaian: number | null;
    dipakai: number;
    sekarang: Date;
}): StatusUndangan {
    if (invite.dicabut_pada) {
        return 'dicabut';
    }
    if (invite.sekarang < invite.berlaku_dari || invite.sekarang >= invite.berlaku_sampai) {
        return 'kedaluwarsa';
    }
    if (invite.maks_pemakaian !== null && invite.dipakai >= invite.maks_pemakaian) {
        return 'penuh';
    }
    return 'berlaku';
}

export async function getInviteInfo(db: Queryable, kode: string): Promise<InviteInfo> {
    const {rows} = await db.query(
        `select i.kode, i.berlaku_dari, i.berlaku_sampai, i.maks_pemakaian, i.dipakai, i.dicabut_pada,
                c.id as class_id, c.nama as class_nama, t.nama as guru_nama, now() as sekarang
           from invites i
           join classes c on c.id = i.class_id
           join teachers t on t.id = c.teacher_id
          where i.kode = $1`,
        [kode]
    );
    const row = rows[0];
    if (!row) {
        throw new ApiError(404, 'UNDANGAN_TIDAK_VALID', 'Undangan tidak ditemukan.');
    }
    return {
        kode: row.kode,
        kelas: {id: row.class_id, nama: row.class_nama, guru: row.guru_nama},
        berlaku_dari: row.berlaku_dari,
        berlaku_sampai: row.berlaku_sampai,
        status: computeStatus(row)
    };
}

export interface JoinResult {
    student: {id: string; nama: string; username: string};
    kelas: {id: string; nama: string};
}

/*
 * Pendaftaran murid lewat undangan secara atomik.
 *
 * Baris undangan dikunci (FOR UPDATE) sehingga pemeriksaan batas pemakaian dan
 * penambahan `dipakai` tidak dapat terlewati oleh permintaan bersamaan.
 */
export async function joinViaInvite(
    db: Queryable,
    input: {kode: string; nama: unknown; username: unknown; email?: unknown; password: unknown}
): Promise<JoinResult> {
    const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const email = typeof input.email === 'string' && input.email.trim() ? input.email.trim().toLowerCase() : null;

    if (!nama) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Nama wajib diisi.');
    }
    if (username.length < 3) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Nama pengguna minimal 3 karakter.');
    }
    if (password.length < 6) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Kata sandi minimal 6 karakter.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
        return await withTransaction(db, async q => {
            const locked = (
                await q.query(
                    `select id, class_id, kode, berlaku_dari, berlaku_sampai, maks_pemakaian, dipakai,
                            dicabut_pada, now() as sekarang
                       from invites
                      where kode = $1
                      for update`,
                    [input.kode]
                )
            ).rows[0];

            if (!locked) {
                throw new ApiError(404, 'UNDANGAN_TIDAK_VALID', 'Undangan tidak ditemukan.');
            }

            const status = computeStatus(locked);
            if (status === 'dicabut') {
                throw new ApiError(410, 'UNDANGAN_DICABUT', 'Undangan sudah dicabut.');
            }
            if (status === 'kedaluwarsa') {
                throw new ApiError(410, 'UNDANGAN_KEDALUWARSA', 'Undangan sudah kedaluwarsa.');
            }
            if (status === 'penuh') {
                throw new ApiError(410, 'UNDANGAN_PENUH', 'Batasan pemakaian undangan sudah tercapai.');
            }

            const memberCount = (
                await q.query('select count(*)::int as n from class_members where class_id = $1', [
                    locked.class_id
                ])
            ).rows[0].n as number;
            if (memberCount >= MAX_MURID_PER_KELAS) {
                throw new ApiError(409, 'KELAS_PENUH', 'Jumlah murid di kelas ini sudah penuh.');
            }

            const existing = (
                await q.query('select id from students where lower(username) = lower($1)', [username])
            ).rows[0];
            if (existing) {
                throw new ApiError(409, 'USERNAME_SUDAH_DIPAKAI', 'Nama pengguna sudah dipakai.');
            }

            if (email) {
                const existingEmail = (
                    await q.query('select id from students where lower(email) = lower($1)', [email])
                ).rows[0];
                if (existingEmail) {
                    throw new ApiError(409, 'EMAIL_SUDAH_DIPAKAI', 'Email sudah dipakai.');
                }
            }

            const student = (
                await q.query(
                    `insert into students (username, nama, email, password_hash)
                     values ($1, $2, $3, $4)
                     returning id, nama, username`,
                    [username, nama, email, passwordHash]
                )
            ).rows[0];

            await q.query('insert into class_members (class_id, student_id) values ($1, $2)', [
                locked.class_id,
                student.id
            ]);

            await q.query('update invites set dipakai = dipakai + 1 where id = $1', [locked.id]);

            const classRow = (
                await q.query('select id, nama from classes where id = $1', [locked.class_id])
            ).rows[0];

            return {
                student: {id: student.id, nama: student.nama, username: student.username},
                kelas: {id: classRow.id, nama: classRow.nama}
            };
        });
    } catch (error) {
        if (isUniqueViolation(error, 'students_username_lower_unique')) {
            throw new ApiError(409, 'USERNAME_SUDAH_DIPAKAI', 'Nama pengguna sudah dipakai.');
        }
        if (isUniqueViolation(error, 'students_email_lower_unique')) {
            throw new ApiError(409, 'EMAIL_SUDAH_DIPAKAI', 'Email sudah dipakai.');
        }
        throw error;
    }
}
