import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireStudent} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {submitStudentChallengeProgress} from '@/server/live-sessions';

export async function POST(
    request: Request,
    context: {params: Promise<{session_id: string}>}
) {
    try {
        const student = requireStudent(await auth());
        const {session_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const result = await submitStudentChallengeProgress(getPool(), student.id, session_id, body);
        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error);
    }
}
