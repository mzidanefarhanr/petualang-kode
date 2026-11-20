import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {reorderAdminStages} from '@/server/lessons';

export async function POST(
    request: Request,
    context: {params: Promise<{lesson_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {lesson_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const stages = await reorderAdminStages(getPool(), admin.id, lesson_id, body?.stage_ids);
        return NextResponse.json({stages});
    } catch (error) {
        return errorResponse(error);
    }
}
