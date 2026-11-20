import Link from 'next/link';
import {Shell} from '@/components/Shell';
import {CreateClassForm} from '@/components/GuruForms';
import {requireGuruPage} from '@/lib/page-auth';
import {getPool} from '@/lib/db';
import {listClasses} from '@/server/classes';
import {listSchools} from '@/server/schools';

export const dynamic = 'force-dynamic';

export default async function GuruPage() {
    const session = await requireGuruPage();
    const db = getPool();
    const [classes, schools] = await Promise.all([
        listClasses(db, session.user.id),
        listSchools(db, session.user.id)
    ]);

    return (
        <Shell nav={[{href: '/guru', label: 'Kelas saya'}]}>
            <h1 className="mb-1 text-xl font-semibold text-blue-900">Kelas saya</h1>
            <p className="mb-6 text-sm text-slate-600">Kelola kelas, tugas, dan muridmu di sini.</p>

            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <section>
                    {classes.length === 0 ? (
                        <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
                            Belum ada kelas. Buat kelas pertama di samping.
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {classes.map(kelas => (
                                <li key={kelas.id} className="rounded-md border border-slate-200 bg-white">
                                    <Link
                                        href={`/guru/kelas/${kelas.id}`}
                                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-800">{kelas.nama}</div>
                                            <div className="text-sm text-slate-500">
                                                {kelas.school ?? 'Tanpa sekolah'} — {kelas.jumlah_murid} murid —{' '}
                                                {kelas.jumlah_tugas} tugas
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            {kelas.tugas_aktif > 0
                                                ? `${kelas.tugas_aktif} tugas sedang dibuka`
                                                : 'tidak ada tugas aktif'}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="rounded-md border border-slate-200 bg-white p-4">
                    <h2 className="mb-3 text-sm font-semibold text-slate-700">Buat kelas</h2>
                    <CreateClassForm schools={schools.map(school => ({id: school.id, nama: school.nama}))} />
                </section>
            </div>
        </Shell>
    );
}
