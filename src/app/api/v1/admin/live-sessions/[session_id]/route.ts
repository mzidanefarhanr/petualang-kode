import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {getAdminLiveSessionDetail} from '@/server/live-sessions';

export async function GET(
    _request: Request,
    context: {params: Promise<{session_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {session_id} = await context.params;
        const detail = await getAdminLiveSessionDetail(getPool(), admin.id, session_id);
        return NextResponse.json(detail);
    } catch (error) {
        return errorResponse(error);
    }
}
