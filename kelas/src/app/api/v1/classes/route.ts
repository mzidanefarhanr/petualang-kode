import type {NextRequest} from 'next/server';
import {getPool} from '@/lib/db';
import {toErrorResponse} from '@/lib/http/errors';
import {ISO} from '@/lib/http/uuid';
import {requireSessionRole} from '@/lib/http/auth-guard';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {createClass, listClasses} from '@/server/classes';

/*
 * GET  /api/v1/classes  — daftar kelas milik guru aktif
 * POST /api/v1/classes  — buat kelas (school_id opsional, wajib milik guru)
 */
export async function GET() {
    try {
        const session = await requireSessionRole('guru');
        const classes = await listClasses(getPool(), session.user.id);
        return Response.json({
            classes: classes.map(row => ({
                id: row.id,
                nama: row.nama,
                school: row.school,
                jumlah_murid: Number(row.jumlah_murid),
                tugas_aktif: Number(row.tugas_aktif),
                diarsipkan_pada: row.diarsipkan_pada
            }))
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireSessionRole('guru');
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);
        const body = (await request.json()) as {nama?: unknown; school_id?: unknown};
        const created = await createClass(getPool(), session.user.id, {
            nama: body?.nama,
            schoolId: body?.school_id
        });
        return Response.json(
            {
                id: created.id,
                nama: created.nama,
                school_id: created.school_id,
                diarsipkan_pada: created.diarsipkan_pada ? ISO(created.diarsipkan_pada) : null
            },
            {status: 201}
        );
    } catch (error) {
        return toErrorResponse(error);
    }
}
