import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {createClassInvite} from '@/server/invites';

export async function POST(
    request: Request,
    context: {params: Promise<{class_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {class_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const undangan = await createClassInvite(getPool(), admin.id, class_id, body);
        return NextResponse.json({undangan}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
