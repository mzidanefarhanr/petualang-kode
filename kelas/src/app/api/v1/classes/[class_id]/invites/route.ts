import type {NextRequest} from 'next/server';
import {auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {ApiError, toErrorResponse} from '@/lib/http/errors';
import {ISO, isUuid, parseDate} from '@/lib/http/uuid';
import {CSRF_COOKIE, assertCsrf} from '@/lib/csrf';
import {createInvite, listInvites} from '@/server/invites';

const tautan = (kode: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/join/${kode}`;

/*
 * GET  /api/v1/classes/{class_id}/invites  — daftar undangan kelas (guru)
 * POST /api/v1/classes/{class_id}/invites  — buat undangan (guru)
 */
export async function GET(request: NextRequest, context: {params: Promise<{class_id: string}>}) {
    try {
        const {class_id: classId} = await context.params;
        if (!isUuid(classId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'class_id tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', classId});

        const invites = await listInvites(db, classId);
        return Response.json({
            invites: invites.map(row => ({
                id: row.id,
                kode: row.kode,
                tautan: tautan(row.kode),
                berlaku_dari: ISO(row.berlaku_dari),
                berlaku_sampai: ISO(row.berlaku_sampai),
                maks_pemakaian: row.maks_pemakaian,
                dipakai: row.dipakai,
                dicabut_pada: row.dicabut_pada ? ISO(row.dicabut_pada) : null,
                dibuat_pada: ISO(row.dibuat_pada)
            }))
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(request: NextRequest, context: {params: Promise<{class_id: string}>}) {
    try {
        const {class_id: classId} = await context.params;
        if (!isUuid(classId)) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'class_id tidak valid.');
        }

        const db = getPool();
        const session = await auth();
        await requireAccess(db, session, {role: 'guru', classId});
        assertCsrf(request, request.cookies.get(CSRF_COOKIE)?.value);

        const body = (await request.json()) as {berlaku_sampai?: unknown; maks_pemakaian?: unknown};
        const berlakuSampai = parseDate(body?.berlaku_sampai);
        if (!berlakuSampai) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'berlaku_sampai tidak valid.');
        }
        const maksPemakaian =
            body?.maks_pemakaian === null || body?.maks_pemakaian === undefined
                ? null
                : Number(body.maks_pemakaian);

        const invite = await createInvite(db, {
            classId,
            teacherId: session!.user.id,
            berlakuSampai,
            maksPemakaian
        });

        return Response.json(
            {
                id: invite.id,
                kode: invite.kode,
                tautan: tautan(invite.kode),
                berlaku_dari: ISO(invite.berlaku_dari),
                berlaku_sampai: ISO(invite.berlaku_sampai),
                maks_pemakaian: invite.maks_pemakaian,
                dipakai: invite.dipakai
            },
            {status: 201}
        );
    } catch (error) {
        return toErrorResponse(error);
    }
}
