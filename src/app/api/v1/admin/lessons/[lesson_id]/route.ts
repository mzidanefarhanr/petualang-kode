import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {deleteAdminLesson, getAdminLessonDetail, updateAdminLesson} from '@/server/lessons';

export async function GET(
    _request: Request,
    context: {params: Promise<{lesson_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {lesson_id} = await context.params;
        const detail = await getAdminLessonDetail(getPool(), admin.id, lesson_id);
        return NextResponse.json(detail);
    } catch (error) {
        return errorResponse(error);
    }
}

export async function PATCH(
    request: Request,
    context: {params: Promise<{lesson_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {lesson_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const lesson = await updateAdminLesson(getPool(), admin.id, lesson_id, body);
        return NextResponse.json({lesson});
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(
    _request: Request,
    context: {params: Promise<{lesson_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {lesson_id} = await context.params;
        await deleteAdminLesson(getPool(), admin.id, lesson_id);
        return new NextResponse(null, {status: 204});
    } catch (error) {
        return errorResponse(error);
    }
}
