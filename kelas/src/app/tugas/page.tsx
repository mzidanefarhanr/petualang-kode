import Link from 'next/link';
import {Shell} from '@/components/Shell';
import {Waktu} from '@/components/Waktu';
import {requireMuridPage} from '@/lib/page-auth';
import {getPool} from '@/lib/db';
import {listStudentAssignments} from '@/server/student';

export const dynamic = 'force-dynamic';

const editorBase = process.env.NEXT_PUBLIC_EDITOR_URL ?? '';

export default async function TugasPage() {
    const session = await requireMuridPage();
    const assignments = await listStudentAssignments(getPool(), session.user.id);

    const order = {dibuka: 0, belum_dibuka: 1, ditutup: 2} as const;
    assignments.sort(
        (a, b) =>
            order[a.status] - order[b.status] ||
            b.ditutup_pada.getTime() - a.ditutup_pada.getTime()
    );

    return (
        <Shell nav={[{href: '/tugas', label: 'Tugas saya'}]}>
            <h1 className="mb-1 text-xl font-semibold text-blue-900">Tugas saya</h1>
            <p className="mb-6 text-sm text-slate-600">Pilih tugas yang mau kamu kerjakan.</p>

            {assignments.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    Belum ada tugas. Gurumu belum memberi tugas.
                </div>
            ) : (
                <ul className="space-y-3">
                    {assignments.map(item => {
                        const editorUrl = `${editorBase}?assignment_id=${item.id}`;
                        const sudahKumpul = item.jumlah_kumpul > 0;
                        return (
                            <li key={item.id} className="rounded-md border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium text-slate-800">{item.judul}</div>
                                        <div className="text-sm text-slate-500">{item.kelas.nama}</div>
                                        <div className="mt-1 text-sm text-slate-600">
                                            {item.status === 'belum_dibuka' && (
                                                <>Tugas ini dibuka <Waktu iso={item.dibuka_pada.toISOString()} />.</>
                                            )}
                                            {item.status === 'dibuka' && (
                                                <>Bisa dikerjakan sampai <Waktu iso={item.ditutup_pada.toISOString()} />.</>
                                            )}
                                            {item.status === 'ditutup' && (
                                                <>
                                                    Sudah ditutup pada <Waktu iso={item.ditutup_pada.toISOString()} />.
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {sudahKumpul && (
                                            <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-900">
                                                Sudah dikumpulkan
                                            </span>
                                        )}
                                        {item.status === 'dibuka' && (
                                            <a
                                                href={editorUrl}
                                                className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                                            >
                                                Kerjakan
                                            </a>
                                        )}
                                        {item.status === 'ditutup' && (
                                            <a
                                                href={editorUrl}
                                                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                            >
                                                Lihat &amp; Kumpulkan
                                            </a>
                                        )}
                                        {sudahKumpul && (
                                            <Link
                                                href={`/tugas/${item.id}`}
                                                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                            >
                                                Lihat hasilku
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Shell>
    );
}
