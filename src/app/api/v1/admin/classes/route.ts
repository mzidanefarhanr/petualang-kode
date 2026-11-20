import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {createAdminClass, listAdminClasses} from '@/server/classes';

export async function GET() {
    try {
        const admin = requireAdmin(await auth());
        const classes = await listAdminClasses(getPool(), admin.id);
        return NextResponse.json({classes});
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(request: Request) {
    try {
        const admin = requireAdmin(await auth());
        const body = await request.json().catch(() => ({}));
        const kelas = await createAdminClass(getPool(), admin.id, body);
        return NextResponse.json({kelas}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
