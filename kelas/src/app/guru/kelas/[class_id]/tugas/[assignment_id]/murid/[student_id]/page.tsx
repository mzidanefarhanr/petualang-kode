import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Shell} from '@/components/Shell';
import {Waktu} from '@/components/Waktu';
import {ReplyForm} from '@/components/ReplyForm';
import {requireGuruPage} from '@/lib/page-auth';
import {getPool} from '@/lib/db';
import {requireAccess} from '@/lib/access';
import {getStudentHistory} from '@/server/history';
import {listComments} from '@/server/comments';

export const dynamic = 'force-dynamic';

interface Versi {
    key: string;
    jenis: 'pengumpulan' | 'snapshot';
    id: string;
    waktu: Date;
    label: string;
    urlUnduh: string;
    pertama?: boolean;
}

export default async function RiwayatPage({
    params
}: {
    params: Promise<{class_id: string; assignment_id: string; student_id: string}>;
}) {
    const {class_id: classId, assignment_id: assignmentId, student_id: studentId} = await params;
    const session = await requireGuruPage();
    const db = getPool();

    try {
        await requireAccess(db, session, {role: 'guru', assignmentId});
    } catch {
        notFound();
    }

    const history = await getStudentHistory(db, assignmentId, studentId);

    const oldestSnapshot = [...history.snapshots].sort(
        (a, b) => a.diambil_pada.getTime() - b.diambil_pada.getTime()
    )[0];

    const versi: Versi[] = [
        ...history.submissions.map(sub => ({
            key: `sub-${sub.id}`,
            jenis: 'pengumpulan' as const,
            id: sub.id,
            waktu: sub.dikumpulkan_pada,
            label: 'Pengumpulan',
            urlUnduh: `/api/v1/submissions/${sub.id}/content`
        })),
        ...history.snapshots.map(snap => ({
            key: `snap-${snap.id}`,
            jenis: 'snapshot' as const,
            id: snap.id,
            waktu: snap.diambil_pada,
            label: snap.jenis_simpan === 'manual' ? 'Simpan manual' : 'Simpan otomatis',
            urlUnduh: `/api/v1/snapshots/${snap.id}/content`,
            pertama: oldestSnapshot?.id === snap.id
        }))
    ].sort((a, b) => b.waktu.getTime() - a.waktu.getTime());

    const latestSubmission = history.submissions[0] ?? null;
    const latestSnapshot = [...history.snapshots].sort(
        (a, b) => b.diambil_pada.getTime() - a.diambil_pada.getTime()
    )[0];
    const komentar = latestSubmission ? await listComments(db, latestSubmission.id) : [];

    const path = `/guru/kelas/${classId}/tugas/${assignmentId}/murid/${studentId}`;

    return (
        <Shell nav={[{href: '/guru', label: 'Kelas saya'}]}>
            <Link href={`/guru/kelas/${classId}/tugas/${assignmentId}`} className="text-sm text-slate-500 hover:text-blue-900">
                &larr; Kembali ke daftar nilai
            </Link>
            <h1 className="mb-1 mt-2 text-xl font-semibold text-blue-900">{history.student.nama}</h1>
            <p className="mb-6 text-sm text-slate-600">
                {history.assignment.judul} · nama pengguna <span className="font-mono">{history.student.username}</span>
            </p>

            <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-slate-700">Daftar snapshot &amp; pengumpulan</h2>
                    {versi.length === 0 ? (
                        <p className="text-sm text-slate-600">Belum ada pengerjaan tersimpan.</p>
                    ) : (
                        <ul className="space-y-2">
                            {versi.map(item => (
                                <li
                                    key={item.key}
                                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 py-3"
                                >
                                    <div className="text-sm">
                                        <div className="text-slate-800">
                                            <Waktu iso={item.waktu.toISOString()} />
                                        </div>
                                        <div className="text-slate-600">
                                            {item.label}
                                            {item.jenis === 'pengumpulan' && (
                                                <span className="ml-2 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-900">
                                                    Pengumpulan
                                                </span>
                                            )}
                                            {item.pertama && (
                                                <span className="ml-2 text-xs text-slate-500">Snapshot pertama</span>
                                            )}
                                        </div>
                                    </div>
                                    <a
                                        href={item.urlUnduh}
                                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        Unduh
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <h2 className="mb-3 text-sm font-semibold text-slate-700">Lihat versi</h2>
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                        <p className="mb-3 text-sm text-slate-600">
                            Pemutar menyusul. Untuk sekarang, unduh berkasnya lalu buka di editor.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {latestSubmission && (
                                <a
                                    href={`/api/v1/submissions/${latestSubmission.id}/content`}
                                    className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                                >
                                    Unduh pengumpulan terakhir
                                </a>
                            )}
                            {latestSnapshot && (
                                <a
                                    href={`/api/v1/snapshots/${latestSnapshot.id}/content`}
                                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                    Unduh snapshot terakhir
                                </a>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Komentar pengumpulan terakhir</h2>
                {!latestSubmission ? (
                    <p className="text-sm text-slate-600">Murid ini belum mengumpulkan.</p>
                ) : (
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                        {komentar.length === 0 ? (
                            <p className="mb-3 text-sm text-slate-500">Belum ada komentar.</p>
                        ) : (
                            <ul className="mb-3 space-y-2">
                                {komentar.map(item => (
                                    <li key={item.id} className="text-sm">
                                        <span className="font-medium text-slate-700">{item.penulis.nama}</span>{' '}
                                        <span className="text-xs text-slate-400">
                                            <Waktu iso={item.dibuat_pada.toISOString()} />
                                        </span>
                                        <p className="text-slate-700">{item.isi}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <ReplyForm submissionId={latestSubmission.id} path={path} />
                    </div>
                )}
            </section>
        </Shell>
    );
}
