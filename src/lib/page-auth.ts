import {redirect} from 'next/navigation';
import type {Session} from 'next-auth';
import {auth} from '@/auth';

export async function requireAdminPage(): Promise<Session> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'admin') {
        redirect('/masuk?tab=admin');
    }
    return session;
}

export async function requireStudentPage(nextPath?: string): Promise<Session> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'student') {
        const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
        redirect(`/masuk${suffix}`);
    }
    return session;
}
