import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireStudent} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {getStudentActiveClassLiveSession} from '@/server/live-sessions';

export async function GET(
    _request: Request,
    context: {params: Promise<{class_id: string}>}
) {
    try {
        const student = requireStudent(await auth());
        const {class_id} = await context.params;
        const data = await getStudentActiveClassLiveSession(getPool(), student.id, class_id);
        return NextResponse.json(data);
    } catch (error) {
        return errorResponse(error);
    }
}
