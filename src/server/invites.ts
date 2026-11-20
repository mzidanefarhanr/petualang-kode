import {randomBytes} from 'node:crypto';
import {assertAdminOwnsClass} from '@/lib/access';
import type {Queryable} from '@/lib/db';
import {ApiError, assertValidUuid} from '@/lib/http/errors';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = 6): string {
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return out;
}

export async function createClassInvite(
    db: Queryable,
    adminId: string,
    classId: string,
    input?: {berlaku_jam?: unknown}
) {
    await assertAdminOwnsClass(db, adminId, classId);

    const berlakuJamRaw = Number(input?.berlaku_jam ?? 168);
    const berlakuJam = Number.isFinite(berlakuJamRaw) && berlakuJamRaw >= 1 && berlakuJamRaw <= 720
        ? Math.floor(berlakuJamRaw)
        : 168;

    const kode = generateInviteCode(6);
    const {rows} = await db.query(
        `insert into class_invites (class_id, kode, berlaku_dari, berlaku_sampai)
         values ($1, $2, now(), now() + ($3::int * interval '1 hour'))
         returning id, class_id, kode, berlaku_dari, berlaku_sampai, dicabut_pada, dibuat_pada`,
        [classId, kode, berlakuJam]
    );
    return rows[0];
}

export async function revokeClassInvite(
    db: Queryable,
    adminId: string,
    inviteId: string
) {
    assertValidUuid(inviteId, 'Undangan tidak ditemukan.');
    const {rows} = await db.query(
        `update class_invites ci
         set dicabut_pada = coalesce(ci.dicabut_pada, now())
         from classes c
         where ci.id = $1
           and c.id = ci.class_id
           and c.admin_id = $2
         returning ci.id, ci.kode, ci.dicabut_pada`,
        [inviteId, adminId]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'UNDANGAN_TIDAK_DITEMUKAN', 'Undangan tidak ditemukan.');
    }
    return rows[0];
}

export interface PublicInviteInfo {
    id: string;
    kode: string;
    class_id: string;
    kelas_nama: string;
    admin_nama: string;
    berlaku_sampai: Date;
    dicabut_pada: Date | null;
    aktif: boolean;
}

export async function getPublicInviteByCode(db: Queryable, kodeRaw: string): Promise<PublicInviteInfo> {
    const kode = typeof kodeRaw === 'string' ? kodeRaw.trim().toUpperCase() : '';
    if (!kode) {
        throw new ApiError(404, 'UNDANGAN_TIDAK_DITEMUKAN', 'Kode kelas tidak ditemukan.');
    }

    const {rows} = await db.query(
        `select
            ci.id,
            ci.kode,
            ci.class_id,
            c.nama as kelas_nama,
            a.nama as admin_nama,
            ci.berlaku_sampai,
            ci.dicabut_pada,
            (
                ci.dicabut_pada is null
                and c.diarsipkan_pada is null
                and now() >= ci.berlaku_dari
                and now() < ci.berlaku_sampai
            ) as aktif
         from class_invites ci
         join classes c on c.id = ci.class_id
         join admins a on a.id = c.admin_id
         where upper(ci.kode) = $1`,
        [kode]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'UNDANGAN_TIDAK_DITEMUKAN', 'Kode kelas tidak ditemukan.');
    }
    return rows[0];
}

/*
 * Siswa yang akunnya sudah dibuat oleh Admin bergabung/masuk ke kelas melalui
 * kode invite class yang masih berlaku.
 */
export async function joinClassWithInviteForStudent(
    db: Queryable,
    studentId: string,
    kodeRaw: string
): Promise<{class_id: string; kelas_nama: string}> {
    const invite = await getPublicInviteByCode(db, kodeRaw);
    if (!invite.aktif) {
        throw new ApiError(
            410,
            'UNDANGAN_TIDAK_BERLAKU',
            'Kode kelas ini sudah tidak berlaku. Minta kode baru ke pengajar.'
        );
    }

    // Pastikan siswa milik admin yang sama dengan pemilik kelas dan tidak diarsipkan.
    const {rows} = await db.query(
        `select s.id
         from students s
         join classes c on c.admin_id = s.admin_id
         where s.id = $1
           and c.id = $2
           and s.diarsipkan_pada is null`,
        [studentId, invite.class_id]
    );
    if (!rows[0]) {
        throw new ApiError(403, 'SISWA_TIDAK_TERDAFTAR', 'Akun siswa ini tidak terdaftar pada kelas pengajar.');
    }

    await db.query(
        `insert into class_members (class_id, student_id)
         values ($1, $2)
         on conflict do nothing`,
        [invite.class_id, studentId]
    );

    return {
        class_id: invite.class_id,
        kelas_nama: invite.kelas_nama
    };
}
