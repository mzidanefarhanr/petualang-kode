import bcrypt from 'bcryptjs';
import {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MemoryMediaStorage} from '@/lib/storage';
import {defaultStoryConfig} from '@/lib/story/schema';
import {
    createAdminLesson,
    createAdminStage,
    deleteAdminStage,
    getAdminLessonDetail,
    reorderAdminStages,
    updateAdminStage
} from './lessons';
import {
    createAdminMedia,
    deleteAdminMedia,
    getMediaContentForActor,
    listAdminMedia
} from './media';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('Tahap 3 — Pustaka Media, Pelajaran, & Stage Cerita (Timeline + Suara)', () => {
    let pool: Pool;
    let admin1Id: string;
    let admin2Id: string;
    let storage: MemoryMediaStorage;

    beforeAll(() => {
        pool = new Pool({connectionString});
    });

    beforeEach(async () => {
        storage = new MemoryMediaStorage();
        await pool.query(
            'truncate table stages, lessons, media_assets, class_invites, class_members, classes, students, admins restart identity cascade'
        );
        const hash = await bcrypt.hash('rahasia123', 4);
        admin1Id = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin1@example.test', $1, 'Admin Satu')
                 returning id`,
                [hash]
            )
        ).rows[0].id;
        admin2Id = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin2@example.test', $1, 'Admin Dua')
                 returning id`,
                [hash]
            )
        ).rows[0].id;
    });

    afterAll(async () => {
        await pool.end();
    });

    it('mengunggah gambar & suara tanpa membocorkan object_key, serta melindungi aset yang dipakai stage (409)', async () => {
        const fakePng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
        const fakeMp3 = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0]);

        const imgAsset = await createAdminMedia(
            pool,
            admin1Id,
            {nama: 'Latar Hutan', mimeType: 'image/png', bytes: fakePng},
            storage
        );
        const audAsset = await createAdminMedia(
            pool,
            admin1Id,
            {nama: 'Musik Hutan', mimeType: 'audio/mpeg', bytes: fakeMp3},
            storage
        );

        expect(imgAsset).not.toHaveProperty('object_key');
        expect(imgAsset.jenis).toBe('image');
        expect(audAsset.jenis).toBe('audio');

        const listAll = await listAdminMedia(pool, admin1Id);
        expect(listAll).toHaveLength(2);
        expect(JSON.stringify(listAll)).not.toContain('object_key');

        // Admin pemilik dapat mengunduh byte identik, admin lain ditolak 404
        const downloaded = await getMediaContentForActor(
            pool,
            {id: admin1Id, role: 'admin'},
            imgAsset.id,
            storage
        );
        expect(Array.from(downloaded.bytes)).toEqual(Array.from(fakePng));

        await expect(
            getMediaContentForActor(pool, {id: admin2Id, role: 'admin'}, imgAsset.id, storage)
        ).rejects.toMatchObject({status: 404});

        // Gunakan audAsset di dalam sebuah stage cerita
        const lesson = await createAdminLesson(pool, admin1Id, {judul: 'Misi Hutan'});
        const storyCfg = defaultStoryConfig();
        storyCfg.timeline.push({
            id: 'aud-1',
            kind: 'audio',
            start_ms: 0,
            end_ms: 4000,
            asset_id: audAsset.id,
            label: 'Musik Hutan',
            volume: 0.8,
            loop: false
        });
        await createAdminStage(pool, admin1Id, lesson.id, {
            judul: 'Stage 1 — Pembuka',
            tipe: 'story',
            config: storyCfg
        });

        // Menghapus audAsset yang sedang dipakai stage harus ditolak 409
        await expect(
            deleteAdminMedia(pool, admin1Id, audAsset.id, storage)
        ).rejects.toMatchObject({
            status: 409,
            kode: 'MEDIA_SEDANG_DIPAKAI'
        });

        // Menghapus imgAsset yang belum dipakai stage berhasil
        await deleteAdminMedia(pool, admin1Id, imgAsset.id, storage);
        const remaining = await listAdminMedia(pool, admin1Id);
        expect(remaining.map(m => m.id)).toEqual([audAsset.id]);
    });

    it('mengelola urutan stage (create, update timeline, reorder transaksional, dan delete merapikan urutan)', async () => {
        const lesson = await createAdminLesson(pool, admin1Id, {
            judul: 'Petualangan Sungai',
            deskripsi: 'Bab 2'
        });

        const s1 = await createAdminStage(pool, admin1Id, lesson.id, {
            judul: 'Stage 1 — Cerita',
            tipe: 'story'
        });
        const s2 = await createAdminStage(pool, admin1Id, lesson.id, {
            judul: 'Stage 2 — Challenge',
            tipe: 'challenge'
        });
        const s3 = await createAdminStage(pool, admin1Id, lesson.id, {
            judul: 'Stage 3 — Penutup',
            tipe: 'story'
        });

        expect([s1.urutan, s2.urutan, s3.urutan]).toEqual([1, 2, 3]);

        // Tukar urutan: s3, s1, s2 dalam satu transaksi (menguji constraint deferrable)
        const reordered = await reorderAdminStages(pool, admin1Id, lesson.id, [
            s3.id,
            s1.id,
            s2.id
        ]);
        expect(reordered.map(s => ({id: s.id, urutan: s.urutan}))).toEqual([
            {id: s3.id, urutan: 1},
            {id: s1.id, urutan: 2},
            {id: s2.id, urutan: 3}
        ]);

        // Perbarui timeline stage cerita s1
        const updatedStory = {
            ...defaultStoryConfig(),
            duration_ms: 12000
        };
        const afterUpdate = await updateAdminStage(pool, admin1Id, s1.id, {
            judul: 'Stage Cerita Baru',
            config: updatedStory
        });
        expect(afterUpdate.judul).toBe('Stage Cerita Baru');
        expect((afterUpdate.config as any).duration_ms).toBe(12000);

        // Hapus stage urutan 1 (s3) -> stage tersisa otomatis memiliki urutan 1 dan 2
        await deleteAdminStage(pool, admin1Id, s3.id);
        const detail = await getAdminLessonDetail(pool, admin1Id, lesson.id);
        expect(detail.stages.map(s => ({id: s.id, urutan: s.urutan}))).toEqual([
            {id: s1.id, urutan: 1},
            {id: s2.id, urutan: 2}
        ]);
    });
});
