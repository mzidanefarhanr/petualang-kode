import {redirect} from 'next/navigation';
import type {Session} from 'next-auth';
import {auth} from '@/auth';

/*
 * Penjaga halaman berbasis peran. Mengalihkan ke /masuk bila belum sesuai.
 */
export async function requireGuruPage(): Promise<Session> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'guru') {
        redirect('/masuk');
    }
    return session;
}

export async function requireMuridPage(): Promise<Session> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'murid') {
        redirect('/masuk');
    }
    return session;
}
