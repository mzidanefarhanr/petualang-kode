import Link from 'next/link';
import {auth} from '@/auth';
import {JoinClassClient} from '@/components/JoinClassClient';
import {getPool} from '@/lib/db';
import {getPublicInviteByCode, type PublicInviteInfo} from '@/server/invites';

export const dynamic = 'force-dynamic';

export default async function JoinKodePage({
    params
}: {
    params: Promise<{kode: string}>;
}) {
    const {kode} = await params;
    const session = await auth();

    let invite: PublicInviteInfo | null = null;
    try {
        invite = await getPublicInviteByCode(getPool(), kode);
    } catch {
        invite = null;
    }

    return (
        <main className="min-h-screen" style={{background: 'var(--cream)'}}>
            <header className="pk-nav">
                <div className="pk-wrap pk-nav-row">
                    <Link href="/" className="pk-nav-logo">
                        Petualang<span>Kode</span>
                    </Link>
                    <Link href="/" className="text-sm font-extrabold text-white/85 hover:text-white">
                        ← Beranda
                    </Link>
                </div>
            </header>

            <div className="mx-auto max-w-xl px-6 py-12">
                {!invite || !invite.aktif ? (
                    <div className="rounded-3xl border-2 border-slate-200 bg-white p-8 text-center shadow-sm">
                        <img
                            src="/mascot/pose-ui/05-pose-berpikir-debugging.jpg"
                            alt="Kelinci Penjelajah berpikir"
                            className="mx-auto h-36 w-36 rounded-full border-4 border-[#1e2d5a] object-cover"
                        />
                        <h1 className="mt-4 text-2xl font-black" style={{color: 'var(--navy)'}}>
                            Kode Kelas Tidak Berlaku
                        </h1>
                        <p className="mt-2 text-sm font-semibold text-slate-600">
                            Tautan atau kode undangan <strong>{kode.toUpperCase()}</strong> sudah
                            tidak berlaku atau tidak ditemukan. Minta kode baru ke gurumu ya.
                        </p>
                        <Link
                            href="/"
                            className="mt-6 inline-block rounded-xl px-6 py-3 text-sm font-extrabold text-white"
                            style={{background: 'var(--navy)'}}
                        >
                            Kembali ke Beranda
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-sm">
                        <div className="mb-6 flex items-center gap-4">
                            <img
                                src="/mascot/pose-ui/07-pose-menyapa-onboarding.jpg"
                                alt="Kelinci Penjelajah"
                                className="h-20 w-20 rounded-full border-4 border-[#1e2d5a] object-cover"
                            />
                            <div>
                                <span
                                    className="inline-block rounded-full px-3 py-0.5 text-xs font-extrabold text-white"
                                    style={{background: 'var(--teal)'}}
                                >
                                    Kode Kelas: {invite.kode}
                                </span>
                                <h1 className="mt-1 text-2xl font-black" style={{color: 'var(--navy)'}}>
                                    {invite.kelas_nama}
                                </h1>
                                <p className="text-xs font-bold text-slate-500">
                                    Dipandu oleh {invite.admin_nama}
                                </p>
                            </div>
                        </div>

                        <JoinClassClient
                            kode={invite.kode}
                            kelasNama={invite.kelas_nama}
                            adminNama={invite.admin_nama}
                            currentRole={session?.user?.role}
                            currentStudentName={session?.user?.name}
                        />
                    </div>
                )}
            </div>
        </main>
    );
}
