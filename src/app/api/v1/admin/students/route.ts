import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {createAdminStudent, listAdminStudents} from '@/server/students';

export async function GET() {
    try {
        const admin = requireAdmin(await auth());
        const students = await listAdminStudents(getPool(), admin.id);
        return NextResponse.json({students});
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(request: Request) {
    try {
        const admin = requireAdmin(await auth());
        const body = await request.json().catch(() => ({}));
        const student = await createAdminStudent(getPool(), admin.id, body);
        return NextResponse.json({student}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
