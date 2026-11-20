import {AdminMediaClient} from '@/components/AdminMediaClient';
import {AdminShell} from '@/components/AdminShell';
import {getPool} from '@/lib/db';
import {requireAdminPage} from '@/lib/page-auth';
import {listAdminMedia} from '@/server/media';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
    const session = await requireAdminPage();
    const media = await listAdminMedia(getPool(), session.user.id);

    return (
        <AdminShell adminName={session.user.name} active="media">
            <div className="mb-6">
                <h1 className="text-2xl font-black" style={{color: 'var(--navy)'}}>
                    Pustaka Media (Gambar &amp; Suara)
                </h1>
                <p className="text-sm font-semibold text-slate-600">
                    Unggah latar panggung, sprite karakter, musik latar, atau efek suara untuk
                    dipakai di Stage Cerita maupun Stage Challenge.
                </p>
            </div>

            <AdminMediaClient initialMedia={media} />
        </AdminShell>
    );
}
