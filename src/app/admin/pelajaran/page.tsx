import {AdminLessonsClient} from '@/components/AdminLessonsClient';
import {AdminShell} from '@/components/AdminShell';
import {getPool} from '@/lib/db';
import {requireAdminPage} from '@/lib/page-auth';
import {listAdminLessons} from '@/server/lessons';

export const dynamic = 'force-dynamic';

export default async function AdminLessonsPage() {
    const session = await requireAdminPage();
    const lessons = await listAdminLessons(getPool(), session.user.id);

    return (
        <AdminShell adminName={session.user.name} active="pelajaran">
            <div className="mb-6">
                <h1 className="text-2xl font-black" style={{color: 'var(--navy)'}}>
                    Pembuat Pelajaran &amp; Stage
                </h1>
                <p className="text-sm font-semibold text-slate-600">
                    Susun rangkaian stage yang memadukan cerita bergerak ber-timeline + suara dan
                    tantangan blok visual.
                </p>
            </div>

            <AdminLessonsClient initialLessons={lessons} />
        </AdminShell>
    );
}
