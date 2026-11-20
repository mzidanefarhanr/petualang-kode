import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {addStudentToClass} from '@/server/students';

export async function POST(
    request: Request,
    context: {params: Promise<{class_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {class_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        await addStudentToClass(
            getPool(),
            admin.id,
            class_id,
            typeof body?.student_id === 'string' ? body.student_id : ''
        );
        return NextResponse.json({ok: true}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
