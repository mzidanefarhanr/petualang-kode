import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {createAdminStage} from '@/server/lessons';

export async function POST(
    request: Request,
    context: {params: Promise<{lesson_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {lesson_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const stage = await createAdminStage(getPool(), admin.id, lesson_id, body);
        return NextResponse.json({stage}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
