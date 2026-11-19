import {ApiError} from './errors';

/*
 * Membaca badan permintaan berkas `.sb3`.
 *
 * Mendukung biner mentah (application/octet-stream) dan multipart/form-data
 * dengan kolom `file`. Server tidak mengurai isi berkas.
 */
export async function readRawBytes(request: Request): Promise<Uint8Array> {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Kolom file tidak ditemukan.');
        }
        return new Uint8Array(await file.arrayBuffer());
    }

    return new Uint8Array(await request.arrayBuffer());
}

export function isJsonRequest(request: Request): boolean {
    return (request.headers.get('content-type') ?? '').includes('application/json');
}
