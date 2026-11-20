import Link from 'next/link';
import {LoginForm} from '@/components/LoginForm';

export default async function MasukPage({
    searchParams
}: {
    searchParams: Promise<{tab?: string; next?: string}>;
}) {
    const params = await searchParams;
    const initialTab = params.tab === 'admin' ? 'admin' : 'student';
    const nextPath = typeof params.next === 'string' ? params.next : undefined;

    return (
        <main className="min-h-screen" style={{background: 'var(--cream)'}}>
            <header className="pk-nav">
                <div className="pk-wrap pk-nav-row">
                    <Link href="/" className="pk-nav-logo">
                        Petualang<span>Kode</span>
                    </Link>
                    <Link href="/" className="text-sm font-extrabold text-white/85 hover:text-white">
                        ← Kembali ke Beranda
                    </Link>
                </div>
            </header>

            <div className="mx-auto grid max-w-4xl items-center gap-8 px-6 py-12 md:grid-cols-[1fr_1.15fr]">
                {/* Maskot menyapa */}
                <div
                    className="flex flex-col items-center rounded-3xl p-6 text-center text-white shadow-lg"
                    style={{background: 'var(--teal)'}}
                >
                    <img
                        src="/mascot/pose-ui/07-pose-menyapa-onboarding.jpg"
                        alt="Kelinci Penjelajah menyapa"
                        className="h-52 w-52 rounded-2xl object-cover"
                    />
                    <h2 className="mt-4 text-xl font-black">Halo, Petualang!</h2>
                    <p className="mt-1 text-sm font-semibold text-white/90">
                        Siapkan nama pengguna dan kata sandi dari gurumu, lalu mari mulai misi hari
                        ini bersama teman-teman.
                    </p>
                </div>

                {/* Form Masuk */}
                <div className="rounded-3xl border-2 border-slate-200/80 bg-white p-7 shadow-sm">
                    <h1 className="text-2xl font-black" style={{color: 'var(--navy)'}}>
                        Masuk ke Petualang Kode
                    </h1>
                    <p className="mb-6 mt-1 text-sm font-semibold" style={{color: 'var(--muted)'}}>
                        Pilih peranmu di bawah ini untuk melanjutkan.
                    </p>
                    <LoginForm initialTab={initialTab} nextPath={nextPath} />
                </div>
            </div>
        </main>
    );
}
