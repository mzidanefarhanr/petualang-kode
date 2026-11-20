import bcrypt from 'bcryptjs';
import {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {defaultChallengeConfig} from '@/lib/challenge/engine';
import {defaultStoryConfig} from '@/lib/story/schema';
import {createAdminClass} from './classes';
import {createAdminLesson, createAdminStage} from './lessons';
import {
    controlAdminLiveSession,
    endAdminLiveSession,
    getAdminLiveSessionDetail,
    getStudentActiveClassLiveSession,
    startAdminLiveSession,
    submitStudentChallengeProgress
} from './live-sessions';
import {createAdminStudent} from './students';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('Tahap 5 — Sesi Live, Kontrol Stage Admin, Kunci Layar Siswa, & Evaluasi Progres Server', () => {
    let pool: Pool;
    let adminId: string;
    let classId: string;
    let lessonId: string;
    let stage1StoryId: string;
    let stage2ChallengeId: string;
    let student1Id: string;
    let outsiderStudentId: string;

    beforeAll(() => {
        pool = new Pool({connectionString});
    });

    beforeEach(async () => {
        await pool.query(
            `truncate table
                student_stage_progress, live_sessions, stages, lessons, media_assets,
                class_invites, class_members, classes, students, admins
             restart identity cascade`
        );
        const hash = await bcrypt.hash('rahasia123', 4);
        adminId = (
            await pool.query(
                `insert into admins (email, password_hash, nama)
                 values ('admin@example.test', $1, 'Kak Budi')
                 returning id`,
                [hash]
            )
        ).rows[0].id;

        const kelas = await createAdminClass(pool, adminId, {nama: 'Kelas Live 5A'});
        classId = kelas.id;

        const s1 = await createAdminStudent(pool, adminId, {
            nama: 'Budi',
            username: 'budi01',
            password: '1234',
            class_id: classId
        });
        student1Id = s1.id;

        const s2 = await createAdminStudent(pool, adminId, {
            nama: 'Tamu Luar Kelas',
            username: 'tamu02',
            password: '1234'
        });
        outsiderStudentId = s2.id;

        const lesson = await createAdminLesson(pool, adminId, {judul: 'Misi Hutan'});
        lessonId = lesson.id;

        const st1 = await createAdminStage(pool, adminId, lessonId, {
            judul: 'Stage 1 — Cerita',
            tipe: 'story',
            config: defaultStoryConfig()
        });
        stage1StoryId = st1.id;

        const st2 = await createAdminStage(pool, adminId, lessonId, {
            judul: 'Stage 2 — Tantangan',
            tipe: 'challenge',
            config: defaultChallengeConfig()
        });
        stage2ChallengeId = st2.id;
    });

    afterAll(async () => {
        await pool.end();
    });

    it('memulai sesi live (maks 1 sesi aktif per kelas) dan mengontrol perpindahan stage serta playback', async () => {
        const state = await startAdminLiveSession(pool, adminId, {
            class_id: classId,
            lesson_id: lessonId
        });
        expect(state.status).toBe('active');
        expect(state.active_stage.id).toBe(stage1StoryId);
        expect(state.maks_siswa).toBe(20);

        // Menolak sesi live kedua pada kelas yang masih memiliki sesi aktif
        await expect(
            startAdminLiveSession(pool, adminId, {
                class_id: classId,
                lesson_id: lessonId
            })
        ).rejects.toMatchObject({
            status: 409,
            kode: 'SESI_SUDAH_AKTIF'
        });

        // Kontrol playback cerita
        const playingState = await controlAdminLiveSession(pool, adminId, state.session_id, {
            action: 'playback',
            playback_status: 'playing',
            offset_ms: 500
        });
        expect(playingState.playback.status).toBe('playing');
        expect(playingState.playback.offset_ms).toBe(500);

        // Siswa anggota kelas melihat stage aktif yang sama, siswa luar kelas ditolak 404
        const studentView = await getStudentActiveClassLiveSession(pool, student1Id, classId);
        expect(studentView.session?.active_stage.id).toBe(stage1StoryId);

        await expect(
            getStudentActiveClassLiveSession(pool, outsiderStudentId, classId)
        ).rejects.toMatchObject({status: 404});

        // Akhiri sesi
        const ended = await endAdminLiveSession(pool, adminId, state.session_id);
        expect(ended.status).toBe('ended');
    });

    it('menolak siswa mengerjakan stage yang tidak aktif (403) atau dikunci (403), serta memvalidasi solusi di server', async () => {
        const state = await startAdminLiveSession(pool, adminId, {
            class_id: classId,
            lesson_id: lessonId
        });

        // Saat Stage 1 (story) aktif, siswa tidak boleh mengirim progres untuk Stage 2 (challenge)
        await expect(
            submitStudentChallengeProgress(pool, student1Id, state.session_id, {
                stage_id: stage2ChallengeId,
                actions: [{type: 'move', steps: 1}]
            })
        ).rejects.toMatchObject({
            status: 403,
            kode: 'STAGE_TIDAK_AKTIF'
        });

        // Admin memindahkan layar ke Stage 2 (challenge) dan mengunci interaksi
        await controlAdminLiveSession(pool, adminId, state.session_id, {
            action: 'set_stage',
            stage_id: stage2ChallengeId
        });
        await controlAdminLiveSession(pool, adminId, state.session_id, {
            action: 'set_lock',
            challenge_locked: true
        });

        // Saat challenge_locked = true, pengiriman progres ditolak 403 STAGE_DIKUNCI
        await expect(
            submitStudentChallengeProgress(pool, student1Id, state.session_id, {
                stage_id: stage2ChallengeId,
                actions: [{type: 'move', steps: 1}]
            })
        ).rejects.toMatchObject({
            status: 403,
            kode: 'STAGE_DIKUNCI'
        });

        // Admin membuka kunci challenge
        await controlAdminLiveSession(pool, adminId, state.session_id, {
            action: 'set_lock',
            challenge_locked: false
        });

        // Percobaan 1 (belum sampai tujuan) -> status in_progress, attempts = 1
        const try1 = await submitStudentChallengeProgress(pool, student1Id, state.session_id, {
            stage_id: stage2ChallengeId,
            actions: [{type: 'move', steps: 1}]
        });
        expect(try1.progress.status).toBe('in_progress');
        expect(try1.progress.attempts).toBe(1);
        expect(try1.evaluation.completed).toBe(false);

        // Percobaan 2 (solusi benar untuk defaultChallengeConfig) -> status completed, attempts = 2
        const try2 = await submitStudentChallengeProgress(pool, student1Id, state.session_id, {
            stage_id: stage2ChallengeId,
            actions: [
                {type: 'move', steps: 1},
                {type: 'collect'},
                {type: 'jump'},
                {type: 'move', steps: 1}
            ]
        });
        expect(try2.progress.status).toBe('completed');
        expect(try2.progress.attempts).toBe(2);
        expect(try2.evaluation.completed).toBe(true);

        // Panel Admin menampilkan progres siswa sudah selesai
        const detail = await getAdminLiveSessionDetail(pool, adminId, state.session_id);
        expect(detail.students[0]).toMatchObject({
            username: 'budi01',
            progress_status: 'completed',
            attempts: 2,
            blocks_used: 4
        });
    });
});
