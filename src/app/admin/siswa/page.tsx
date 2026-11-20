import {AdminShell} from '@/components/AdminShell';
import {AdminStudentsClient} from '@/components/AdminStudentsClient';
import {getPool} from '@/lib/db';
import {requireAdminPage} from '@/lib/page-auth';
import {listAdminClasses} from '@/server/classes';
import {listAdminStudents} from '@/server/students';

export const dynamic = 'force-dynamic';

export default async function AdminStudentsPage() {
    const session = await requireAdminPage();
    const db = getPool();
    const [students, classes] = await Promise.all([
        listAdminStudents(db, session.user.id),
        listAdminClasses(db, session.user.id)
    ]);

    return (
        <AdminShell adminName={session.user.name} active="siswa">
            <div className="mb-6">
                <h1 className="text-2xl font-black" style={{color: 'var(--navy)'}}>
                    Kelola Akun Login Siswa
                </h1>
                <p className="text-sm font-semibold text-slate-600">
                    Seluruh akun siswa dibuat dan diatur oleh Admin. Siswa menggunakan akun ini
                    untuk masuk dan mengikuti invite class.
                </p>
            </div>

            <AdminStudentsClient
                students={students}
                classes={classes.map(c => ({id: c.id, nama: c.nama}))}
            />
        </AdminShell>
    );
}
