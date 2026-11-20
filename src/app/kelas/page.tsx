import Link from 'next/link';
import {HeroJoinCodeForm} from '@/components/LandingInteractive';
import {SignOutButton} from '@/components/SignOutButton';
import {getPool} from '@/lib/db';
import {requireStudentPage} from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function StudentClassesPage() {
    const session = await requireStudentPage('/kelas');
    const {rows: classes} = await getPool().query(
        `select c.id, c.nama, c.deskripsi, a.nama as admin_nama
         from class_members cm
         join classes c on c.id = cm.class_id
         join admins a on a.id = c.admin_id
         where cm.student_id = $1
           and c.diarsipkan_pada is null
         order by cm.bergabung_pada desc`,
        [session.user.id]
    );

    return (
        <main className="min-h-screen" style={{background: 'var(--cream)'}}>
            <header className="pk-nav">
                <div className="pk-wrap pk-nav-row">
                    <Link href="/" className="pk-nav-logo">
                        Petualang<span>Kode</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                            <img
                                src="/mascot/pose-ui/08-ikon-kepala-avatar.jpg"
                                alt="Avatar Siswa"
                                className="h-8 w-8 rounded-full border-2 border-white object-cover"
                            />
                            <span>{session.user.name}</span>
                        </div>
                        <SignOutButton />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-4xl px-6 py-10">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black" style={{color: 'var(--navy)'}}>
                            Halo, {session.user.name}!
                        </h1>
                        <p className="text-sm font-semibold text-slate-600">
                            Pilih kelasmu di bawah untuk mengikuti sesi live bersama guru.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
                    <section>
                        <h2 className="mb-3 text-base font-extrabold" style={{color: 'var(--navy)'}}>
                            Kelas yang Kamu Ikuti
                        </h2>
                        {classes.length === 0 ? (
                            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600">
                                Kamu belum masuk ke kelas mana pun. Masukkan kode kelas dari gurumu
                                di sebelah kanan ya!
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {classes.map(kelas => (
                                    <li
                                        key={kelas.id}
                                        className="flex items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs"
                                    >
                                        <div>
                                            <div
                                                className="text-lg font-black"
                                                style={{color: 'var(--navy)'}}
                                            >
                                                {kelas.nama}
                                            </div>
                                            <div className="text-xs font-bold text-slate-500">
                                                Pengajar: {kelas.admin_nama}
                                            </div>
                                        </div>
                                        <Link
                                            href={`/kelas/${kelas.id}/live`}
                                            className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-white"
                                            style={{
                                                background: 'var(--teal)',
                                                boxShadow: '0 3px 0 var(--teal-deeper)'
                                            }}
                                        >
                                            Buka Ruang Live →
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section
                        className="rounded-2xl p-5 text-white"
                        style={{background: 'var(--teal)'}}
                    >
                        <h2 className="mb-2 text-base font-black">Punya Kode Kelas Baru?</h2>
                        <HeroJoinCodeForm />
                    </section>
                </div>
            </div>
        </main>
    );
}
