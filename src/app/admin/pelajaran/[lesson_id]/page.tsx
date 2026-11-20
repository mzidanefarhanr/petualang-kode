import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AdminLessonDetailClient} from '@/components/AdminLessonDetailClient';
import {AdminShell} from '@/components/AdminShell';
import {getPool} from '@/lib/db';
import {requireAdminPage} from '@/lib/page-auth';
import {getAdminLessonDetail} from '@/server/lessons';
import {listAdminMedia} from '@/server/media';

export const dynamic = 'force-dynamic';

export default async function AdminLessonDetailPage({
    params
}: {
    params: Promise<{lesson_id: string}>;
}) {
    const {lesson_id} = await params;
    const session = await requireAdminPage();
    const db = getPool();

    let detail: Awaited<ReturnType<typeof getAdminLessonDetail>>;
    try {
        detail = await getAdminLessonDetail(db, session.user.id, lesson_id);
    } catch {
        notFound();
    }

    const mediaAssets = await listAdminMedia(db, session.user.id);

    return (
        <AdminShell adminName={session.user.name} active="pelajaran">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Link
                        href="/admin/pelajaran"
                        className="text-xs font-extrabold hover:underline"
                        style={{color: 'var(--teal-dark)'}}
                    >
                        ← Kembali ke Daftar Pelajaran
                    </Link>
                    <h1 className="mt-1 text-2xl font-black" style={{color: 'var(--navy)'}}>
                        {detail.lesson.judul}
                    </h1>
                    {detail.lesson.deskripsi && (
                        <p className="text-sm font-semibold text-slate-500">
                            {detail.lesson.deskripsi}
                        </p>
                    )}
                </div>
            </div>

            <AdminLessonDetailClient
                lessonId={detail.lesson.id}
                stages={detail.stages.map(s => ({
                    id: s.id,
                    urutan: s.urutan,
                    judul: s.judul,
                    tipe: s.tipe,
                    config: (s.config || {}) as Record<string, unknown>
                }))}
                mediaAssets={mediaAssets}
            />
        </AdminShell>
    );
}
