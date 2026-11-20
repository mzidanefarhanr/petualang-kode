import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Shell} from '@/components/Shell';
import {Waktu} from '@/components/Waktu';
import {requireGuruPage} from '@/lib/page-auth';
import {getPool} from '@/lib/db';
import {requireAccess} from '@/lib/access';
import {listSubmissionsForTeacher} from '@/server/assignments';

export const dynamic = 'force-dynamic';

export default async function NilaiPage({
    params
}: {
    params: Promise<{class_id: string; assignment_id: string}>;
}) {
    const {class_id: classId, assignment_id: assignmentId} = await params;
    const session = await requireGuruPage();
    const db = getPool();

    try {
        await requireAccess(db, session, {role: 'guru', assignmentId});
    } catch {
        notFound();
    }

    const data = await listSubmissionsForTeacher(db, assignmentId);

    const murid = [...data.murid].sort((a, b) => {
        if (a.belum_kumpul !== b.belum_kumpul) {
            return a.belum_kumpul ? -1 : 1;
        }
        return a.nama.localeCompare(b.nama, 'id');
    });

    return (
        <Shell nav={[{href: '/guru', label: 'Kelas saya'}]}>
            <Link href={`/guru/kelas/${classId}`} className="text-sm text-slate-500 hover:text-blue-900">
                &larr; Kembali ke kelas
            </Link>
            <h1 className="mb-1 mt-2 text-xl font-semibold text-blue-900">{data.assignment.judul}</h1>
            <p className="mb-6 text-sm text-slate-600">
                Ditutup <Waktu iso={data.assignment.ditutup_pada.toISOString()} /> — {murid.length} murid
            </p>

            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-2">Nama murid</th>
                        <th className="py-2">Terakhir mengumpulkan</th>
                        <th className="py-2">Jumlah</th>
                        <th className="py-2">Terlambat?</th>
                        <th className="py-2">Komentar terakhir</th>
                        <th className="py-2">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {murid.map(row => (
                        <tr key={row.student_id} className="border-b border-slate-100 align-top">
                            <td className="py-2 font-medium text-slate-800">{row.nama}</td>
                            <td className="py-2 text-slate-600">
                                {row.terakhir_dikumpulkan_pada ? (
                                    <Waktu iso={row.terakhir_dikumpulkan_pada.toISOString()} />
                                ) : (
                                    '—'
                                )}
                            </td>
                            <td className="py-2 text-slate-600">{row.jumlah_kumpul} kali</td>
                            <td className="py-2">
                                {row.terlambat ? (
                                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                                        Terlambat
                                        {row.perlu_tinjauan ? ' · perlu tinjauan' : ''}
                                    </span>
                                ) : (
                                    <span className="text-slate-400">—</span>
                                )}
                            </td>
                            <td className="max-w-[16rem] py-2 text-slate-600">
                                {row.komentar_terakhir ? row.komentar_terakhir : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="py-2">
                                <Link
                                    href={`/guru/kelas/${classId}/tugas/${assignmentId}/murid/${row.student_id}`}
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                                >
                                    Riwayat
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Shell>
    );
}
