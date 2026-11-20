'use server';

import {revalidatePath} from 'next/cache';
import {signOut, auth} from '@/auth';
import {requireAccess} from '@/lib/access';
import {getPool} from '@/lib/db';
import {Errors} from '@/lib/http/errors';
import {createComment} from '@/server/comments';

export async function logoutAction(): Promise<void> {
    await signOut({redirectTo: '/masuk'});
}

/*
 * Balas komentar pada submission (guru pemilik kelas atau murid pemilik).
 * Server action: dilindungi pemeriksaan Origin bawaan Next.js.
 */
export async function replyCommentAction(formData: FormData): Promise<void> {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id) {
        throw Errors.belumMasuk();
    }
    if (role !== 'guru' && role !== 'murid') {
        throw Errors.peranTidakSesuai();
    }

    const submissionId = String(formData.get('submission_id') ?? '');
    const isi = formData.get('isi');
    const path = String(formData.get('path') ?? '');

    await requireAccess(getPool(), session, {role, submissionId});
    await createComment(getPool(), {submissionId, role, userId: session.user.id, isi});

    if (path) {
        revalidatePath(path);
    }
}
