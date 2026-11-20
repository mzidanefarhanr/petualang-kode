import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, errorResponse} from '@/lib/http/errors';
import {createAdminMedia, listAdminMedia} from '@/server/media';

export async function GET(request: Request) {
    try {
        const admin = requireAdmin(await auth());
        const {searchParams} = new URL(request.url);
        const jenis = searchParams.get('jenis');
        const media = await listAdminMedia(getPool(), admin.id, jenis);
        return NextResponse.json({media});
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(request: Request) {
    try {
        const admin = requireAdmin(await auth());
        const formData = await request.formData();
        const fileEntry = formData.get('file');

        if (!fileEntry || typeof (fileEntry as Blob).arrayBuffer !== 'function') {
            throw new ApiError(400, 'BERKAS_WAJIB', 'Pilih berkas gambar atau suara untuk diunggah.');
        }

        const blob = fileEntry as File;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const namaRaw = formData.get('nama');
        const nama =
            typeof namaRaw === 'string' && namaRaw.trim().length > 0
                ? namaRaw.trim()
                : blob.name || 'Aset Media';
        const jenis = formData.get('jenis');

        const asset = await createAdminMedia(getPool(), admin.id, {
            nama,
            jenis,
            mimeType: blob.type || 'application/octet-stream',
            bytes
        });

        return NextResponse.json({asset}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
