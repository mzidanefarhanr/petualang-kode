import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {deleteAdminMedia} from '@/server/media';

export async function DELETE(
    _request: Request,
    context: {params: Promise<{asset_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {asset_id} = await context.params;
        await deleteAdminMedia(getPool(), admin.id, asset_id);
        return new NextResponse(null, {status: 204});
    } catch (error) {
        return errorResponse(error);
    }
}
