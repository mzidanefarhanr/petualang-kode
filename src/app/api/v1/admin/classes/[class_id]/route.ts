import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {getAdminClassDetail, updateAdminClass} from '@/server/classes';

export async function GET(
    _request: Request,
    context: {params: Promise<{class_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {class_id} = await context.params;
        const detail = await getAdminClassDetail(getPool(), admin.id, class_id);
        return NextResponse.json(detail);
    } catch (error) {
        return errorResponse(error);
    }
}

export async function PATCH(
    request: Request,
    context: {params: Promise<{class_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {class_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const kelas = await updateAdminClass(getPool(), admin.id, class_id, body);
        return NextResponse.json({kelas});
    } catch (error) {
        return errorResponse(error);
    }
}
