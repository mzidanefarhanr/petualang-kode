import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {deleteAdminStage, updateAdminStage} from '@/server/lessons';

export async function PATCH(
    request: Request,
    context: {params: Promise<{stage_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {stage_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const stage = await updateAdminStage(getPool(), admin.id, stage_id, body);
        return NextResponse.json({stage});
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(
    _request: Request,
    context: {params: Promise<{stage_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {stage_id} = await context.params;
        await deleteAdminStage(getPool(), admin.id, stage_id);
        return new NextResponse(null, {status: 204});
    } catch (error) {
        return errorResponse(error);
    }
}
