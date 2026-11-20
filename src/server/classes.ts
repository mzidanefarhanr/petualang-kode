import {assertAdminOwnsClass} from '@/lib/access';
import type {Queryable} from '@/lib/db';
import {ApiError} from '@/lib/http/errors';

export interface AdminClassSummary {
    id: string;
    nama: string;
    deskripsi: string | null;
    dibuat_pada: Date;
    jumlah_siswa: number;
    jumlah_undangan_aktif: number;
}

export async function listAdminClasses(db: Queryable, adminId: string): Promise<AdminClassSummary[]> {
    const {rows} = await db.query(
        `select
            c.id,
            c.nama,
            c.deskripsi,
            c.dibuat_pada,
            count(distinct s.id) filter (where s.diarsipkan_pada is null)::int as jumlah_siswa,
            count(distinct ci.id) filter (
                where ci.dicabut_pada is null and ci.berlaku_sampai > now()
            )::int as jumlah_undangan_aktif
         from classes c
         left join class_members cm on cm.class_id = c.id
         left join students s on s.id = cm.student_id
         left join class_invites ci on ci.class_id = c.id
         where c.admin_id = $1
           and c.diarsipkan_pada is null
         group by c.id
         order by c.dibuat_pada desc`,
        [adminId]
    );
    return rows;
}

export async function createAdminClass(
    db: Queryable,
    adminId: string,
    input: {nama?: unknown; deskripsi?: unknown}
): Promise<{id: string; nama: string; deskripsi: string | null; dibuat_pada: Date}> {
    const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
    const deskripsi =
        typeof input.deskripsi === 'string' && input.deskripsi.trim().length > 0
            ? input.deskripsi.trim()
            : null;

    if (!nama || nama.length > 100) {
        throw new ApiError(400, 'INPUT_TIDAK_VALID', 'Nama kelas wajib diisi (maksimal 100 karakter).');
    }

    const {rows} = await db.query(
        `insert into classes (admin_id, nama, deskripsi)
         values ($1, $2, $3)
         returning id, nama, deskripsi, dibuat_pada`,
        [adminId, nama, deskripsi]
    );
    return rows[0];
}

export async function getAdminClassDetail(db: Queryable, adminId: string, classId: string) {
    const kelas = await assertAdminOwnsClass(db, adminId, classId);

    const [membersRes, invitesRes] = await Promise.all([
        db.query(
            `select s.id, s.nama, s.username, cm.bergabung_pada
             from class_members cm
             join students s on s.id = cm.student_id
             where cm.class_id = $1
               and s.diarsipkan_pada is null
             order by s.nama asc`,
            [classId]
        ),
        db.query(
            `select
                id,
                kode,
                berlaku_dari,
                berlaku_sampai,
                dicabut_pada,
                dibuat_pada,
                (dicabut_pada is null and now() >= berlaku_dari and now() < berlaku_sampai) as aktif
             from class_invites
             where class_id = $1
             order by dibuat_pada desc`,
            [classId]
        )
    ]);

    return {
        kelas,
        siswa: membersRes.rows,
        undangan: invitesRes.rows
    };
}

export async function updateAdminClass(
    db: Queryable,
    adminId: string,
    classId: string,
    input: {nama?: unknown; deskripsi?: unknown; arsipkan?: unknown}
) {
    const existing = await assertAdminOwnsClass(db, adminId, classId);

    const nama =
        typeof input.nama === 'string' && input.nama.trim().length > 0 ? input.nama.trim() : existing.nama;
    const deskripsi =
        input.deskripsi === undefined
            ? existing.deskripsi
            : typeof input.deskripsi === 'string' && input.deskripsi.trim().length > 0
              ? input.deskripsi.trim()
              : null;
    const arsipkan = input.arsipkan === true;

    const {rows} = await db.query(
        `update classes
         set nama = $1,
             deskripsi = $2,
             diarsipkan_pada = case when $3::boolean then coalesce(diarsipkan_pada, now()) else diarsipkan_pada end
         where id = $4 and admin_id = $5
         returning id, nama, deskripsi, diarsipkan_pada`,
        [nama, deskripsi, arsipkan, classId, adminId]
    );
    return rows[0];
}
