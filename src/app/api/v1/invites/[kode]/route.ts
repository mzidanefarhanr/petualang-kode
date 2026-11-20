import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireStudent} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {getPublicInviteByCode, joinClassWithInviteForStudent} from '@/server/invites';

export async function GET(
    _request: Request,
    context: {params: Promise<{kode: string}>}
) {
    try {
        const {kode} = await context.params;
        const invite = await getPublicInviteByCode(getPool(), kode);
        return NextResponse.json({
            invite: {
                kode: invite.kode,
                class_id: invite.class_id,
                kelas_nama: invite.kelas_nama,
                admin_nama: invite.admin_nama,
                berlaku_sampai: invite.berlaku_sampai,
                aktif: invite.aktif
            }
        });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(
    _request: Request,
    context: {params: Promise<{kode: string}>}
) {
    try {
        const student = requireStudent(await auth());
        const {kode} = await context.params;
        const joined = await joinClassWithInviteForStudent(getPool(), student.id, kode);
        return NextResponse.json({joined});
    } catch (error) {
        return errorResponse(error);
    }
}
