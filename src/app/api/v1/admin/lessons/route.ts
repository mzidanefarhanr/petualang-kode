import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {createAdminLesson, listAdminLessons} from '@/server/lessons';

export async function GET() {
    try {
        const admin = requireAdmin(await auth());
        const lessons = await listAdminLessons(getPool(), admin.id);
        return NextResponse.json({lessons});
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(request: Request) {
    try {
        const admin = requireAdmin(await auth());
        const body = await request.json().catch(() => ({}));
        const lesson = await createAdminLesson(getPool(), admin.id, body);
        return NextResponse.json({lesson}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
