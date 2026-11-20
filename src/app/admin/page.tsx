import {AdminClassesClient} from '@/components/AdminClassesClient';
import {AdminShell} from '@/components/AdminShell';
import {getPool} from '@/lib/db';
import {requireAdminPage} from '@/lib/page-auth';
import {listAdminClasses} from '@/server/classes';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
    const session = await requireAdminPage();
    const classes = await listAdminClasses(getPool(), session.user.id);

    return (
        <AdminShell adminName={session.user.name} active="kelas">
            <div className="mb-6">
                <h1 className="text-2xl font-black" style={{color: 'var(--navy)'}}>
                    Kelola Kelas &amp; Sesi Belajar
                </h1>
                <p className="text-sm font-semibold text-slate-600">
                    Buat kelas, daftarkan akun siswa, dan bagikan kode invite class untuk memulai
                    petualangan.
                </p>
            </div>

            <AdminClassesClient initialClasses={classes} />
        </AdminShell>
    );
}
