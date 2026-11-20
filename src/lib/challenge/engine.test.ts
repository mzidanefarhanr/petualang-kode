import {describe, expect, it} from 'vitest';
import {
    defaultChallengeConfig,
    evaluateChallenge,
    validateChallengeConfig,
    type ChallengeAction
} from './engine';

describe('validateChallengeConfig & evaluateChallenge (CodeMonkey 2D Grid)', () => {
    it('menyelesaikan misi default ketika maju, ambil bintang, lompat sungai, dan maju ke tujuan', () => {
        const cfg = validateChallengeConfig(defaultChallengeConfig());
        // Start: (0,2) hadap E. Bintang: (1,2). Sungai/hazard: (2,2). Tujuan: (4,2).
        const solution: ChallengeAction[] = [
            {type: 'move', steps: 1}, // ke (1,2)
            {type: 'collect'}, // ambil bintang di (1,2)
            {type: 'jump'}, // lompat melewati (2,2), mendarat di (3,2)
            {type: 'move', steps: 1} // ke (4,2) = goal!
        ];

        const res = evaluateChallenge(cfg, solution);
        expect(res.completed).toBe(true);
        expect(res.reason_code).toBe('BERHASIL');
        expect(res.stars_collected).toBe(1);
        expect(res.blocks_used).toBe(4);
        expect(res.stars_earned).toBe(3);
    });

    it('mendeteksi tabrakan dinding, jatuh ke bahaya, dan bintang yang belum diambil', () => {
        const cfg = validateChallengeConfig(defaultChallengeConfig());

        // Jalan biasa tanpa melompat sungai di (2,2) -> KENA_BAHAYA
        const intoHazard = evaluateChallenge(cfg, [{type: 'move', steps: 2}]);
        expect(intoHazard.completed).toBe(false);
        expect(intoHazard.reason_code).toBe('KENA_BAHAYA');

        // Putar kiri di (0,2) lalu maju 3 langkah -> keluar batas atas (y < 0) -> TABRAK_RINTANGAN
        const outOfBounds = evaluateChallenge(cfg, [
            {type: 'turn_left'},
            {type: 'move', steps: 3}
        ]);
        expect(outOfBounds.completed).toBe(false);
        expect(outOfBounds.reason_code).toBe('TABRAK_RINTANGAN');

        // Sampai tujuan tanpa memanggil collect di (1,2) -> BINTANG_BELUM_LENGKAP
        const missedStar = evaluateChallenge(cfg, [
            {type: 'move', steps: 1},
            {type: 'jump'},
            {type: 'move', steps: 1}
        ]);
        expect(missedStar.completed).toBe(false);
        expect(missedStar.reason_code).toBe('BINTANG_BELUM_LENGKAP');
    });

    it('mendukung blok repeat (ulangi) dan menghentikan program jika melebihi 200 langkah', () => {
        const cfg = validateChallengeConfig({
            ...defaultChallengeConfig(),
            cols: 6,
            rows: 3,
            start: {x: 0, y: 1, dir: 'E'},
            goal: {x: 5, y: 1},
            walls: [],
            hazards: [],
            stars: [],
            allowed_blocks: ['move', 'turn_left', 'repeat']
        });

        const loopWin = evaluateChallenge(cfg, [
            {type: 'repeat', count: 5, body: [{type: 'move', steps: 1}]}
        ]);
        expect(loopWin.completed).toBe(true);
        expect(loopWin.steps_taken).toBe(5);

        // Nested repeat yang berputar-putar > 200 langkah
        const infiniteLike = evaluateChallenge(cfg, [
            {
                type: 'repeat',
                count: 20,
                body: [
                    {
                        type: 'repeat',
                        count: 20,
                        body: [{type: 'turn_left'}]
                    }
                ]
            }
        ]);
        expect(infiniteLike.completed).toBe(false);
        expect(infiniteLike.reason_code).toBe('LANGKAH_TERLALU_BANYAK');
    });

    it('menolak blok yang tidak termasuk dalam allowed_blocks stage tersebut', () => {
        const cfg = validateChallengeConfig({
            ...defaultChallengeConfig(),
            allowed_blocks: ['move']
        });
        const res = evaluateChallenge(cfg, [{type: 'jump'}]);
        expect(res.completed).toBe(false);
        expect(res.reason_code).toBe('BLOK_TIDAK_DIIZINKAN');
    });
});
