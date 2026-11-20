import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {removeStudentFromClass} from '@/server/students';

export async function DELETE(
    _request: Request,
    context: {params: Promise<{class_id: string; student_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {class_id, student_id} = await context.params;
        await removeStudentFromClass(getPool(), admin.id, class_id, student_id);
        return new NextResponse(null, {status: 204});
    } catch (error) {
        return errorResponse(error);
    }
}
