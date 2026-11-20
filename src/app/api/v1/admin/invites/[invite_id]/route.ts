import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {revokeClassInvite} from '@/server/invites';

export async function DELETE(
    _request: Request,
    context: {params: Promise<{invite_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {invite_id} = await context.params;
        const undangan = await revokeClassInvite(getPool(), admin.id, invite_id);
        return NextResponse.json({undangan});
    } catch (error) {
        return errorResponse(error);
    }
}
