import {NextResponse} from 'next/server';

/*
 * Format respons error seragam (API-CONTRACTS.md Bagian 1.1).
 */
export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly kode: string,
        public readonly pesan: string,
        public readonly detail: Record<string, unknown> = {}
    ) {
        super(pesan);
        this.name = 'ApiError';
    }
}

export function errorResponse(error: unknown): NextResponse {
    if (error instanceof ApiError) {
        return NextResponse.json(
            {
                error: {
                    kode: error.kode,
                    pesan: error.pesan,
                    detail: error.detail
                }
            },
            {status: error.status}
        );
    }

    return NextResponse.json(
        {
            error: {
                kode: 'KESALAHAN_SERVER',
                pesan: 'Terjadi kesalahan pada server.',
                detail: {}
            }
        },
        {status: 500}
    );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_REGEX.test(value);
}

export function assertValidUuid(value: unknown, pesan = 'Data tidak ditemukan.'): asserts value is string {
    if (!isValidUuid(value)) {
        throw new ApiError(404, 'TIDAK_DITEMUKAN', pesan);
    }
}
