import type {NextRequest} from 'next/server';
import {getPool} from '@/lib/db';
import {toErrorResponse} from '@/lib/http/errors';
import {requireSessionRole} from '@/lib/http/auth-guard';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {createSchool, listSchools} from '@/server/schools';

/*
 * GET  /api/v1/schools  — daftar sekolah milik guru aktif
 * POST /api/v1/schools  — buat sekolah
 */
export async function GET() {
    try {
        const session = await requireSessionRole('guru');
        const schools = await listSchools(getPool(), session.user.id);
        return Response.json({schools});
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireSessionRole('guru');
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);
        const body = (await request.json()) as {nama?: unknown; catatan?: unknown};
        const school = await createSchool(getPool(), session.user.id, {
            nama: body?.nama,
            catatan: body?.catatan
        });
        return Response.json(school, {status: 201});
    } catch (error) {
        return toErrorResponse(error);
    }
}
