import Link from 'next/link';
import {logoutAction} from '@/app/actions';

/*
 * Bingkai halaman: bilah atas tipis + isi.
 */
export function Shell({
    children,
    nav
}: {
    children: React.ReactNode;
    nav?: {href: string; label: string}[];
}) {
    return (
        <div className="min-h-screen">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="font-semibold text-blue-900">
                            Scratch Kelas
                        </Link>
                        <nav className="flex items-center gap-4 text-sm">
                            {(nav ?? []).map(item => (
                                <Link key={item.href} href={item.href} className="text-slate-600 hover:text-blue-900">
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <form action={logoutAction}>
                        <button type="submit" className="text-sm text-slate-600 hover:text-blue-900">
                            Keluar
                        </button>
                    </form>
                </div>
            </header>
            <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
    );
}
