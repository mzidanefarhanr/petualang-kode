import {describe, expect, it} from 'vitest';
import {validateMediaUpload} from '@/lib/storage';
import {computeStoryFrameAt, defaultStoryConfig, validateStoryConfig} from './schema';

describe('validateMediaUpload', () => {
    it('menerima gambar dan audio yang valid serta menolak ukuran > 10 MB atau MIME asing', () => {
        expect(validateMediaUpload({mimeType: 'image/png', sizeBytes: 1024})).toEqual({
            jenis: 'image',
            ext: '.png',
            canonicalMime: 'image/png'
        });
        expect(validateMediaUpload({mimeType: 'audio/mpeg', sizeBytes: 2048})).toEqual({
            jenis: 'audio',
            ext: '.mp3',
            canonicalMime: 'audio/mpeg'
        });

        expect(() =>
            validateMediaUpload({mimeType: 'image/png', sizeBytes: 11 * 1024 * 1024})
        ).toThrowError(expect.objectContaining({status: 413, kode: 'UKURAN_MEDIA_TERLALU_BESAR'}));

        expect(() =>
            validateMediaUpload({mimeType: 'application/x-msdownload', sizeBytes: 512})
        ).toThrowError(expect.objectContaining({status: 400, kode: 'TIPE_MEDIA_TIDAK_DIDUKUNG'}));
    });
});

describe('validateStoryConfig & computeStoryFrameAt', () => {
    it('memvalidasi konfigurasi cerita bawaan dan menghitung posisi interpolasi timeline', () => {
        const cfg = validateStoryConfig(defaultStoryConfig());
        expect(cfg.duration_ms).toBe(8000);
        expect(cfg.actors).toHaveLength(1);

        // Pada t = 0 ms, aktor di (18, 68) dan dialog belum muncul (mulai 500 ms)
        const f0 = computeStoryFrameAt(cfg, 0);
        expect(f0.actors[0].x).toBeCloseTo(18, 1);
        expect(f0.dialogues).toHaveLength(0);

        // Pada t = 2250 ms (setengah dari 0..4500 ms), x berada di tengah antara 18 dan 54 -> 36
        const fMid = computeStoryFrameAt(cfg, 2250);
        expect(fMid.actors[0].x).toBeCloseTo(36, 1);
        expect(fMid.dialogues).toHaveLength(1);
        expect(fMid.dialogues[0].speaker).toBe('Kelinci Penjelajah');

        // Pada t = 6000 ms (setelah 4500 ms), x tetap di 54
        const fEnd = computeStoryFrameAt(cfg, 6000);
        expect(fEnd.actors[0].x).toBeCloseTo(54, 1);
    });

    it('menolak event timeline yang melewati durasi stage atau merujuk aktor tidak dikenal', () => {
        const invalidTime = {
            ...defaultStoryConfig(),
            duration_ms: 5000,
            timeline: [
                {
                    id: 'ev-1',
                    kind: 'dialogue',
                    start_ms: 1000,
                    end_ms: 6000,
                    speaker: 'Kelinci',
                    text: 'Halo'
                }
            ]
        };
        expect(() => validateStoryConfig(invalidTime)).toThrowError(
            expect.objectContaining({status: 400, kode: 'WAKTU_TIMELINE_TIDAK_VALID'})
        );

        const invalidActor = {
            ...defaultStoryConfig(),
            timeline: [
                {
                    id: 'ev-2',
                    kind: 'move',
                    start_ms: 0,
                    end_ms: 2000,
                    actor_id: 'aktor-hantu',
                    from_x: 10,
                    from_y: 10,
                    to_x: 50,
                    to_y: 50
                }
            ]
        };
        expect(() => validateStoryConfig(invalidActor)).toThrowError(
            expect.objectContaining({status: 400, kode: 'AKTOR_EVENT_TIDAK_DITEMUKAN'})
        );
    });
});
