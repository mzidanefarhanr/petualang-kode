import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Shell} from '@/components/Shell';
import {Waktu} from '@/components/Waktu';
import {ReplyForm} from '@/components/ReplyForm';
import {requireMuridPage} from '@/lib/page-auth';
import {getPool} from '@/lib/db';
import {listComments} from '@/server/comments';
import {getStudentAssignment} from '@/server/student';

export const dynamic = 'force-dynamic';

export default async function HasilPage({params}: {params: Promise<{assignment_id: string}>}) {
    const {assignment_id: assignmentId} = await params;
    const session = await requireMuridPage();
    const db = getPool();

    let data;
    try {
        data = await getStudentAssignment(db, session.user.id, assignmentId);
    } catch {
        notFound();
    }

    const hasil = await Promise.all(
        data.hasil.map(async submission => ({
            ...submission,
            komentar: await listComments(db, submission.id)
        }))
    );

    const path = `/tugas/${assignmentId}`;

    return (
        <Shell nav={[{href: '/tugas', label: 'Tugas saya'}]}>
            <Link href="/tugas" className="text-sm text-slate-500 hover:text-blue-900">
                &larr; Kembali ke daftar tugas
            </Link>
            <h1 className="mb-1 mt-2 text-xl font-semibold text-blue-900">{data.assignment.judul}</h1>
            <p className="mb-6 text-sm text-slate-600">
                {data.assignment.status === 'ditutup' ? (
                    <>Tugas sudah ditutup. Kamu tetap bisa melihat dan mengunduh hasil kerjamu.</>
                ) : (
                    <>Tenggat: <Waktu iso={data.assignment.ditutup_pada.toISOString()} />.</>
                )}
            </p>

            {hasil.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    Kamu belum mengumpulkan tugas ini.
                </div>
            ) : (
                <ul className="space-y-4">
                    {hasil.map(submission => (
                        <li key={submission.id} className="rounded-md border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm text-slate-700">
                                    Dikumpulkan <Waktu iso={submission.dikumpulkan_pada.toISOString()} />
                                    {submission.terlambat && (
                                        <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                                            Terlambat
                                        </span>
                                    )}
                                </div>
                                <a
                                    href={`/api/v1/submissions/${submission.id}/content`}
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                    Unduh .sb3
                                </a>
                            </div>

                            <div className="mt-3 border-t border-slate-100 pt-3">
                                {submission.komentar.length === 0 ? (
                                    <p className="text-sm text-slate-500">Belum ada komentar.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {submission.komentar.map(komentar => (
                                            <li key={komentar.id} className="text-sm">
                                                <span className="font-medium text-slate-700">
                                                    {komentar.penulis.nama}
                                                </span>{' '}
                                                <span className="text-xs text-slate-400">
                                                    <Waktu iso={komentar.dibuat_pada.toISOString()} />
                                                </span>
                                                <p className="text-slate-700">{komentar.isi}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="mt-3">
                                    <ReplyForm submissionId={submission.id} path={path} />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Shell>
    );
}
