import {describe, expect, it} from 'vitest';
import {evaluateAssignmentWindow} from './assignment-window';

const DIBUKA = new Date('2026-11-18T01:00:00Z');
const DITUTUP = new Date('2026-11-18T09:00:00Z');

const at = (iso: string) => evaluateAssignmentWindow({
    sekarang: new Date(iso),
    dibukaPada: DIBUKA,
    ditutupPada: DITUTUP
});

describe('evaluateAssignmentWindow', () => {
    it('belum_dibuka sebelum waktu buka', () => {
        expect(at('2026-11-18T00:59:59Z')).toEqual({
            status: 'belum_dibuka',
            boleh_edit: false,
            boleh_kumpul: false
        });
    });

    it('dibuka tepat pada waktu buka', () => {
        expect(at('2026-11-18T01:00:00Z')).toEqual({
            status: 'dibuka',
            boleh_edit: true,
            boleh_kumpul: true
        });
    });

    it('dibuka di tengah jendela', () => {
        expect(at('2026-11-18T05:00:00Z')).toEqual({
            status: 'dibuka',
            boleh_edit: true,
            boleh_kumpul: true
        });
    });

    it('ditutup tepat pada waktu tutup', () => {
        expect(at('2026-11-18T09:00:00Z')).toEqual({
            status: 'ditutup',
            boleh_edit: false,
            boleh_kumpul: true
        });
    });

    it('ditutup setelah waktu tutup, murid tetap boleh kumpul', () => {
        expect(at('2026-11-18T12:00:00Z')).toEqual({
            status: 'ditutup',
            boleh_edit: false,
            boleh_kumpul: true
        });
    });
});
