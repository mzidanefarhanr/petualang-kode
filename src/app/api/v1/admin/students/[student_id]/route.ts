import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {updateAdminStudent} from '@/server/students';

export async function PATCH(
    request: Request,
    context: {params: Promise<{student_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {student_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const student = await updateAdminStudent(getPool(), admin.id, student_id, body);
        return NextResponse.json({student});
    } catch (error) {
        return errorResponse(error);
    }
}
