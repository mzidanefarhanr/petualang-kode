import {randomUUID} from 'node:crypto';
import type {Queryable} from '@/lib/db';
import {ApiError, assertValidUuid} from '@/lib/http/errors';
import {getMediaStorage, validateMediaUpload, type MediaStorage} from '@/lib/storage';

export interface MediaAssetItem {
    id: string;
    nama: string;
    jenis: 'image' | 'audio';
    mime_type: string;
    ukuran_bytes: number;
    dibuat_pada: Date;
    url: string;
}

function toPublicMediaItem(row: any): MediaAssetItem {
    return {
        id: row.id,
        nama: row.nama,
        jenis: row.jenis,
        mime_type: row.mime_type,
        ukuran_bytes: Number(row.ukuran_bytes),
        dibuat_pada: row.dibuat_pada,
        url: `/api/v1/media/${row.id}`
    };
}

export async function listAdminMedia(
    db: Queryable,
    adminId: string,
    jenisFilter?: string | null
): Promise<MediaAssetItem[]> {
    const params: unknown[] = [adminId];
    let filterSql = '';
    if (jenisFilter === 'image' || jenisFilter === 'audio') {
        params.push(jenisFilter);
        filterSql = 'and jenis = $2';
    }

    const {rows} = await db.query(
        `select id, nama, jenis, mime_type, ukuran_bytes, dibuat_pada
         from media_assets
         where admin_id = $1 ${filterSql}
         order by dibuat_pada desc`,
        params
    );
    return rows.map(toPublicMediaItem);
}

export async function createAdminMedia(
    db: Queryable,
    adminId: string,
    input: {
        nama?: unknown;
        jenis?: unknown;
        mimeType: string;
        bytes: Uint8Array;
    },
    storage: MediaStorage = getMediaStorage()
): Promise<MediaAssetItem> {
    const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
    if (!nama || nama.length > 100) {
        throw new ApiError(400, 'NAMA_MEDIA_WAJIB', 'Nama aset media wajib diisi (maks. 100 karakter).');
    }

    const expectedJenis =
        input.jenis === 'image' || input.jenis === 'audio' ? input.jenis : undefined;

    const spec = validateMediaUpload({
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        expectedJenis
    });

    const assetId = randomUUID();
    const objectKey = `media/${adminId}/${assetId}${spec.ext}`;

    await storage.put(objectKey, input.bytes, spec.canonicalMime);

    try {
        const {rows} = await db.query(
            `insert into media_assets (id, admin_id, nama, jenis, mime_type, ukuran_bytes, object_key)
             values ($1, $2, $3, $4, $5, $6, $7)
             returning id, nama, jenis, mime_type, ukuran_bytes, dibuat_pada`,
            [assetId, adminId, nama, spec.jenis, spec.canonicalMime, input.bytes.byteLength, objectKey]
        );
        return toPublicMediaItem(rows[0]);
    } catch (error) {
        await storage.delete(objectKey).catch(() => {});
        throw error;
    }
}

export async function deleteAdminMedia(
    db: Queryable,
    adminId: string,
    assetId: string,
    storage: MediaStorage = getMediaStorage()
): Promise<void> {
    assertValidUuid(assetId, 'Aset media tidak ditemukan.');

    const {rows} = await db.query(
        `select id, object_key
         from media_assets
         where id = $1 and admin_id = $2`,
        [assetId, adminId]
    );
    const asset = rows[0];
    if (!asset) {
        throw new ApiError(404, 'MEDIA_TIDAK_DITEMUKAN', 'Aset media tidak ditemukan.');
    }

    // Cek apakah aset masih dirujuk di dalam stages.config milik admin ini
    const usedRes = await db.query(
        `select s.id, s.judul
         from stages s
         join lessons l on l.id = s.lesson_id
         where l.admin_id = $1
           and s.config::text like '%' || $2 || '%'
         limit 1`,
        [adminId, assetId]
    );
    if (usedRes.rows.length > 0) {
        throw new ApiError(
            409,
            'MEDIA_SEDANG_DIPAKAI',
            `Aset ini masih dipakai pada stage "${usedRes.rows[0].judul}".`
        );
    }

    await db.query('delete from media_assets where id = $1 and admin_id = $2', [assetId, adminId]);
    await storage.delete(asset.object_key).catch(() => {});
}

export async function getMediaContentForActor(
    db: Queryable,
    actor: {id: string; role: 'admin' | 'student'},
    assetId: string,
    storage: MediaStorage = getMediaStorage()
): Promise<{mime_type: string; ukuran_bytes: number; bytes: Uint8Array}> {
    assertValidUuid(assetId, 'Aset media tidak ditemukan.');

    if (actor.role === 'admin') {
        const {rows} = await db.query(
            `select mime_type, ukuran_bytes, object_key
             from media_assets
             where id = $1 and admin_id = $2`,
            [assetId, actor.id]
        );
        if (!rows[0]) {
            throw new ApiError(404, 'MEDIA_TIDAK_DITEMUKAN', 'Aset media tidak ditemukan.');
        }
        const bytes = await storage.get(rows[0].object_key);
        return {
            mime_type: rows[0].mime_type,
            ukuran_bytes: Number(rows[0].ukuran_bytes),
            bytes
        };
    }

    // Untuk siswa: pastikan siswa terdaftar di bawah admin pemilik aset
    const {rows} = await db.query(
        `select m.mime_type, m.ukuran_bytes, m.object_key
         from media_assets m
         join students s on s.admin_id = m.admin_id
         where m.id = $1
           and s.id = $2
           and s.diarsipkan_pada is null`,
        [assetId, actor.id]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'MEDIA_TIDAK_DITEMUKAN', 'Aset media tidak ditemukan.');
    }
    const bytes = await storage.get(rows[0].object_key);
    return {
        mime_type: rows[0].mime_type,
        ukuran_bytes: Number(rows[0].ukuran_bytes),
        bytes
    };
}
