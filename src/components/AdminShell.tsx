import Link from 'next/link';
import {SignOutButton} from './SignOutButton';

export function AdminShell({
    adminName,
    active,
    children
}: {
    adminName?: string | null;
    active: 'kelas' | 'siswa' | 'pelajaran' | 'media';
    children: React.ReactNode;
}) {
    const navItems = [
        {key: 'kelas', href: '/admin', label: 'Kelas & Invite'},
        {key: 'siswa', href: '/admin/siswa', label: 'Akun Siswa'},
        {key: 'pelajaran', href: '/admin/pelajaran', label: 'Pelajaran & Stage'},
        {key: 'media', href: '/admin/media', label: 'Pustaka Media'}
    ] as const;

    return (
        <div className="min-h-screen" style={{background: 'var(--cream)'}}>
            <header className="pk-nav">
                <div className="pk-wrap pk-nav-row">
                    <div className="flex items-center gap-6">
                        <Link href="/admin" className="pk-nav-logo">
                            Petualang<span>Kode</span>
                        </Link>
                        <nav className="flex items-center gap-2" aria-label="Navigasi Admin">
                            {navItems.map(item => (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                                        active === item.key
                                            ? 'bg-[#F5A623] text-[#1a1a2e]'
                                            : 'text-white/85 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                            <img
                                src="/mascot/pose-ui/08-ikon-kepala-avatar.jpg"
                                alt="Avatar Admin"
                                className="h-8 w-8 rounded-full border-2 border-[#F5A623] object-cover"
                            />
                            <span className="hidden sm:inline">{adminName || 'Admin'}</span>
                        </div>
                        <SignOutButton />
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
    );
}
