import {auth} from '@/auth';
import type {Session} from 'next-auth';
import {Errors} from './errors';

/*
 * Penjaga peran untuk endpoint yang tidak memeriksa sumber daya tertentu
 * (mis. daftar sekolah/kelas milik guru). Endpoint berbasis sumber daya tetap
 * memakai `requireAccess`.
 */
export async function requireSessionRole(role: 'guru' | 'murid'): Promise<Session> {
    const session = await auth();
    if (!session?.user?.id) {
        throw Errors.belumMasuk();
    }
    if (session.user.role !== role) {
        throw Errors.peranTidakSesuai();
    }
    return session;
}
