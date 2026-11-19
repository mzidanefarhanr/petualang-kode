/*
 * Format respons error seragam sesuai API-CONTRACTS.md Bagian 2.3:
 *   { "error": { "kode": "...", "pesan": "...", "detail": { ... } } }
 */

export interface ErrorBody {
    error: {
        kode: string;
        pesan: string;
        detail?: unknown;
    };
}

export class ApiError extends Error {
    readonly status: number;
    readonly kode: string;
    readonly pesan: string;
    readonly detail?: unknown;

    constructor(status: number, kode: string, pesan: string, detail?: unknown) {
        super(pesan);
        this.name = 'ApiError';
        this.status = status;
        this.kode = kode;
        this.pesan = pesan;
        this.detail = detail;
    }
}

export function errorBody(error: ApiError): ErrorBody {
    const body: ErrorBody = {error: {kode: error.kode, pesan: error.pesan}};
    if (error.detail !== undefined) {
        body.error.detail = error.detail;
    }
    return body;
}

export function toErrorResponse(error: unknown, headers?: HeadersInit): Response {
    const apiError = error instanceof ApiError
        ? error
        : new ApiError(500, 'KESALAHAN_INTERNAL', 'Terjadi kesalahan pada server.');
    return Response.json(errorBody(apiError), {status: apiError.status, headers});
}

/*
 * Kumpulan error yang sering dipakai. Urutan pemeriksaan izin:
 * 401 sesi -> 403 peran -> 404 rantai kepemilikan (API-CONTRACTS.md Bagian 7).
 */
export const Errors = {
    belumMasuk: () => new ApiError(401, 'BELUM_MASUK', 'Anda belum masuk.'),
    peranTidakSesuai: () => new ApiError(403, 'PERAN_TIDAK_SESUAI', 'Peran pengguna tidak sesuai.'),
    bukanAnggota: () => new ApiError(404, 'BUKAN_ANGGOTA', 'Data tidak ditemukan.'),
    bukanMilikAnda: () => new ApiError(404, 'BUKAN_MILIK_ANDA', 'Data tidak ditemukan.'),
    permintaanTidakValid: (pesan: string, detail?: unknown) =>
        new ApiError(400, 'PERMINTAAN_TIDAK_VALID', pesan, detail)
};
