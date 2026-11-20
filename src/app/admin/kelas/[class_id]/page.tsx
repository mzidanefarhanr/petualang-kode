import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AdminClassDetailClient} from '@/components/AdminClassDetailClient';
import {AdminShell} from '@/components/AdminShell';
import {getPool} from '@/lib/db';
import {requireAdminPage} from '@/lib/page-auth';
import {getAdminClassDetail} from '@/server/classes';
import {listAdminLessons} from '@/server/lessons';
import {listAdminStudents} from '@/server/students';

export const dynamic = 'force-dynamic';

export default async function AdminClassDetailPage({
    params
}: {
    params: Promise<{class_id: string}>;
}) {
    const {class_id} = await params;
    const session = await requireAdminPage();
    const db = getPool();

    let detail: Awaited<ReturnType<typeof getAdminClassDetail>>;
    try {
        detail = await getAdminClassDetail(db, session.user.id, class_id);
    } catch {
        notFound();
    }

    const [allStudents, lessons, activeSessRes] = await Promise.all([
        listAdminStudents(db, session.user.id),
        listAdminLessons(db, session.user.id),
        db.query(
            `select id from live_sessions where class_id = $1 and status = 'active' limit 1`,
            [class_id]
        )
    ]);
    const activeSessionId = (activeSessRes.rows[0]?.id as string | undefined) ?? null;

    return (
        <AdminShell adminName={session.user.name} active="kelas">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Link
                        href="/admin"
                        className="text-xs font-extrabold hover:underline"
                        style={{color: 'var(--teal-dark)'}}
                    >
                        ← Kembali ke Daftar Kelas
                    </Link>
                    <h1 className="mt-1 text-2xl font-black" style={{color: 'var(--navy)'}}>
                        {detail.kelas.nama}
                    </h1>
                    {detail.kelas.deskripsi && (
                        <p className="text-sm font-semibold text-slate-500">
                            {detail.kelas.deskripsi}
                        </p>
                    )}
                </div>
            </div>

            <AdminClassDetailClient
                classId={detail.kelas.id}
                kelasNama={detail.kelas.nama}
                members={detail.siswa.map(s => ({
                    id: s.id,
                    nama: s.nama,
                    username: s.username,
                    bergabung_pada: new Date(s.bergabung_pada).toISOString()
                }))}
                invites={detail.undangan.map(u => ({
                    id: u.id,
                    kode: u.kode,
                    berlaku_sampai: new Date(u.berlaku_sampai).toISOString(),
                    dicabut_pada: u.dicabut_pada ? new Date(u.dicabut_pada).toISOString() : null,
                    aktif: Boolean(u.aktif)
                }))}
                allStudents={allStudents.map(s => ({
                    id: s.id,
                    nama: s.nama,
                    username: s.username
                }))}
                lessons={lessons.map(l => ({
                    id: l.id,
                    judul: l.judul,
                    jumlah_stage: l.jumlah_stage
                }))}
                activeSessionId={activeSessionId}
            />
        </AdminShell>
    );
}
