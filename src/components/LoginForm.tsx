'use client';

import {useState} from 'react';
import {signIn} from 'next-auth/react';
import {useRouter} from 'next/navigation';

export function LoginForm({
    initialTab = 'student',
    nextPath
}: {
    initialTab?: 'student' | 'admin';
    nextPath?: string;
}) {
    const [tab, setTab] = useState<'student' | 'admin'>(initialTab);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        const data = new FormData(event.currentTarget);

        const result =
            tab === 'admin'
                ? await signIn('admin', {
                      email: String(data.get('email') || ''),
                      password: String(data.get('password') || ''),
                      redirect: false
                  })
                : await signIn('student', {
                      username: String(data.get('username') || ''),
                      password: String(data.get('password') || ''),
                      redirect: false
                  });

        setLoading(false);
        if (!result || result.error) {
            setError(
                tab === 'admin'
                    ? 'Email atau kata sandi Admin salah. Silakan periksa kembali.'
                    : 'Nama pengguna atau kata sandi salah. Coba tanya ke gurumu ya.'
            );
            return;
        }

        if (nextPath && nextPath.startsWith('/')) {
            router.push(nextPath);
        } else {
            router.push(tab === 'admin' ? '/admin' : '/kelas');
        }
        router.refresh();
    }

    return (
        <div>
            <div className="mb-5 flex gap-2" role="tablist" aria-label="Pilih peran masuk">
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'student'}
                    onClick={() => {
                        setTab('student');
                        setError('');
                    }}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
                        tab === 'student'
                            ? 'bg-[#04a5ad] text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    Siswa
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'admin'}
                    onClick={() => {
                        setTab('admin');
                        setError('');
                    }}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
                        tab === 'admin'
                            ? 'bg-[#1e2d5a] text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    Pengajar (Admin)
                </button>
            </div>

            {tab === 'student' && (
                <div
                    className="mb-4 rounded-xl border px-3.5 py-2.5 text-xs font-bold"
                    style={{
                        background: 'rgba(4, 165, 173, 0.08)',
                        borderColor: 'rgba(4, 165, 173, 0.25)',
                        color: 'var(--teal-deeper)'
                    }}
                >
                    Gunakan <strong>nama pengguna</strong> dan <strong>kata sandi/PIN</strong> yang
                    dibuatkan oleh gurumu.
                </div>
            )}

            <form onSubmit={handleSubmit} method="POST" className="space-y-4">
                {tab === 'admin' ? (
                    <div>
                        <label
                            htmlFor="login-email"
                            className="mb-1 block text-sm font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Email Admin
                        </label>
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            required
                            autoComplete="username"
                            spellCheck={false}
                            enterKeyHint="next"
                            onChange={() => error && setError('')}
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus-visible:border-[#04a5ad] focus-visible:outline-none"
                            placeholder="admin@example.test"
                        />
                    </div>
                ) : (
                    <div>
                        <label
                            htmlFor="login-username"
                            className="mb-1 block text-sm font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Nama Pengguna Siswa
                        </label>
                        <input
                            id="login-username"
                            name="username"
                            type="text"
                            required
                            minLength={3}
                            autoComplete="username"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            enterKeyHint="next"
                            onChange={() => error && setError('')}
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus-visible:border-[#04a5ad] focus-visible:outline-none"
                            placeholder="contoh: kelinci01"
                        />
                    </div>
                )}

                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <label
                            htmlFor="login-password"
                            className="block text-sm font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Kata Sandi / PIN
                        </label>
                        <button
                            type="button"
                            aria-pressed={showPassword}
                            onClick={() => setShowPassword(prev => !prev)}
                            className="text-xs font-extrabold text-[#037d84] hover:underline"
                        >
                            {showPassword ? 'Sembunyikan' : 'Lihat sandi'}
                        </button>
                    </div>
                    <input
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        enterKeyHint="done"
                        onChange={() => error && setError('')}
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus-visible:border-[#04a5ad] focus-visible:outline-none"
                    />
                </div>

                {error && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-bold text-rose-700"
                    >
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl px-5 py-3 text-base font-black text-white shadow-sm transition hover:opacity-95"
                    style={{
                        background: tab === 'admin' ? 'var(--navy)' : 'var(--coral)',
                        boxShadow:
                            tab === 'admin' ? '0 4px 0 #111a38' : '0 4px 0 var(--coral-dark)'
                    }}
                >
                    {loading ? 'Membuka…' : tab === 'admin' ? 'Masuk sebagai Admin →' : 'Masuk Belajar →'}
                </button>
            </form>
        </div>
    );
}
