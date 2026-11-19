/*
 * Penentuan status jendela tugas berdasarkan waktu server (waktu database).
 * Batas: tugas terbuka jika now() >= dibuka_pada; ditutup jika now() >= ditutup_pada
 * (API-CONTRACTS.md Bagian 2.5).
 *
 * Eksklusif logika murni agar bisa diuji tanpa database.
 */

export type StatusTugas = 'belum_dibuka' | 'dibuka' | 'ditutup';

export interface JendelaTugasInput {
    sekarang: Date;
    dibukaPada: Date;
    ditutupPada: Date;
}

export interface JendelaTugas {
    status: StatusTugas;
    boleh_edit: boolean;
    boleh_kumpul: boolean;
}

export function evaluateAssignmentWindow(input: JendelaTugasInput): JendelaTugas {
    const sekarang = input.sekarang.getTime();

    if (sekarang < input.dibukaPada.getTime()) {
        return {status: 'belum_dibuka', boleh_edit: false, boleh_kumpul: false};
    }

    if (sekarang >= input.ditutupPada.getTime()) {
        return {status: 'ditutup', boleh_edit: false, boleh_kumpul: true};
    }

    return {status: 'dibuka', boleh_edit: true, boleh_kumpul: true};
}
