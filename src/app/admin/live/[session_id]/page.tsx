import {notFound} from 'next/navigation';
import {AdminLiveControlClient} from '@/components/AdminLiveControlClient';
import {AdminShell} from '@/components/AdminShell';
import {getPool} from '@/lib/db';
import {requireAdminPage} from '@/lib/page-auth';
import {getAdminLiveSessionDetail} from '@/server/live-sessions';

export const dynamic = 'force-dynamic';

export default async function AdminLiveSessionPage({
    params
}: {
    params: Promise<{session_id: string}>;
}) {
    const {session_id} = await params;
    const session = await requireAdminPage();

    let detail: Awaited<ReturnType<typeof getAdminLiveSessionDetail>>;
    try {
        detail = await getAdminLiveSessionDetail(getPool(), session.user.id, session_id);
    } catch {
        notFound();
    }

    return (
        <AdminShell adminName={session.user.name} active="kelas">
            <AdminLiveControlClient
                initialState={detail.state}
                stages={detail.stages}
                initialStudents={detail.students}
            />
        </AdminShell>
    );
}
