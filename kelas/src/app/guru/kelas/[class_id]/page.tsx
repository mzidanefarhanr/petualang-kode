import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Shell} from '@/components/Shell';
import {Waktu} from '@/components/Waktu';
import {CopyButton} from '@/components/CopyButton';
import {CreateAssignmentForm, CreateInviteForm, RevokeButton, UpdateAssignmentForm} from '@/components/GuruForms';
import {requireGuruPage} from '@/lib/page-auth';
import {getPool} from '@/lib/db';
import {requireAccess} from '@/lib/access';
import {getClass, listClassMembers} from '@/server/classes';
import {listClassAssignments} from '@/server/assignments';
import {listInvites} from '@/server/invites';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

export default async function KelasPage({params}: {params: Promise<{class_id: string}>}) {
    const {class_id: classId} = await params;
    const session = await requireGuruPage();
    const db = getPool();

    try {
        await requireAccess(db, session, {role: 'guru', classId});
    } catch {
        notFound();
    }

    const [kelas, assignments, invites, members] = await Promise.all([
        getClass(db, classId, session.user.id),
        listClassAssignments(db, classId),
        listInvites(db, classId),
        listClassMembers(db, classId)
    ]);

    if (!kelas) {
        notFound();
    }

    const jumlahMurid = members.length;

    return (
        <Shell nav={[{href: '/guru', label: 'Kelas saya'}]}>
            <Link href="/guru" className="text-sm text-slate-500 hover:text-blue-900">
                &larr; Kembali ke daftar kelas
            </Link>
            <h1 className="mb-1 mt-2 text-xl font-semibold text-blue-900">{kelas.nama}</h1>
            <p className="mb-6 text-sm text-slate-600">{kelas.school ?? 'Tanpa sekolah'}</p>

            <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Tugas</h2>
                {assignments.length === 0 ? (
                    <p className="mb-3 text-sm text-slate-600">Belum ada tugas di kelas ini.</p>
                ) : (
                    <ul className="mb-3 space-y-2">
                        {assignments.map(tugas => (
                            <li key={tugas.id} className="rounded-md border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <div className="font-medium text-slate-800">{tugas.judul}</div>
                                        <div className="text-sm text-slate-600">
                                            Dibuka <Waktu iso={tugas.dibuka_pada.toISOString()} /> — ditutup{' '}
                                            <Waktu iso={tugas.ditutup_pada.toISOString()} />
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            {tugas.jumlah_kumpul} dari {jumlahMurid} murid sudah mengumpulkan
                                        </div>
                                    </div>
                                    <Link
                                        href={`/guru/kelas/${classId}/tugas/${tugas.id}`}
                                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        Lihat nilai
                                    </Link>
                                </div>
                                <div className="mt-3 border-t border-slate-100 pt-3">
                                    <UpdateAssignmentForm
                                        classId={classId}
                                        assignmentId={tugas.id}
                                        dibukaPada={tugas.dibuka_pada.toISOString()}
                                        ditutupPada={tugas.ditutup_pada.toISOString()}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Buat tugas</h3>
                    <CreateAssignmentForm classId={classId} />
                </div>
            </section>

            <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Undangan</h2>
                {invites.length === 0 ? (
                    <p className="mb-3 text-sm text-slate-600">Belum ada undangan.</p>
                ) : (
                    <ul className="mb-3 space-y-2">
                        {invites.map(invite => {
                            const tautan = `${appUrl}/join/${invite.kode}`;
                            const aktif = !invite.dicabut_pada && invite.berlaku_sampai > new Date();
                            return (
                                <li
                                    key={invite.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-4"
                                >
                                    <div className="text-sm text-slate-700">
                                        <div className="font-mono text-slate-800">{invite.kode}</div>
                                        <div className="text-slate-600">
                                            Berlaku sampai <Waktu iso={invite.berlaku_sampai.toISOString()} /> —{' '}
                                            dipakai {invite.dipakai}
                                            {invite.maks_pemakaian !== null ? ` dari ${invite.maks_pemakaian}` : ''}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {invite.dicabut_pada
                                                ? 'Dicabut'
                                                : invite.berlaku_sampai > new Date()
                                                  ? 'Aktif'
                                                  : 'Kedaluwarsa'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CopyButton value={tautan} />
                                        {aktif && <RevokeButton classId={classId} inviteId={invite.id} />}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div className="rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Buat undangan</h3>
                    <CreateInviteForm classId={classId} />
                </div>
            </section>

            <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Murid ({jumlahMurid})</h2>
                {members.length === 0 ? (
                    <p className="text-sm text-slate-600">Belum ada murid. Bagikan tautan undangan di atas.</p>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                <th className="py-2">Nama</th>
                                <th className="py-2">Nama pengguna</th>
                                <th className="py-2">Bergabung</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.id} className="border-b border-slate-100">
                                    <td className="py-2 text-slate-800">{member.nama}</td>
                                    <td className="py-2 font-mono text-slate-600">{member.username}</td>
                                    <td className="py-2 text-slate-600">
                                        <Waktu iso={member.bergabung_pada.toISOString()} tanggal />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </Shell>
    );
}
