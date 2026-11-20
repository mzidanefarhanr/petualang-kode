import {getPool} from '@/lib/db';
import {toErrorResponse} from '@/lib/http/errors';
import {requireSessionRole} from '@/lib/http/auth-guard';
import {listStudentClasses} from '@/server/student';

/*
 * GET /api/v1/student/classes — daftar kelas yang diikuti murid aktif.
 */
export async function GET() {
    try {
        const session = await requireSessionRole('murid');
        const classes = await listStudentClasses(getPool(), session.user.id);
        return Response.json({classes});
    } catch (error) {
        return toErrorResponse(error);
    }
}
